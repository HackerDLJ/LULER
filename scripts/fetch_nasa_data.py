#!/usr/bin/env python3
"""Download the NASA data for the Lunar Landing Site Navigator.

Standard library only. Resumable: run it again if a download is interrupted.
All sources are NASA servers (PDS Geosciences Node, NAIF/JPL, JPL Horizons).

Usage:
    python3 scripts/fetch_nasa_data.py            # core set (~620 MB)
    python3 scripts/fetch_nasa_data.py --extra    # also LOLA 87.5S 10 m (~460 MB)
    python3 scripts/fetch_nasa_data.py --probe    # only test Horizons, download nothing
"""
import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
RAW = os.path.join(ROOT, "data", "raw")

PDS = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/"
CYL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/"
NAIF = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"

# (url, destination under data/raw, expected size in bytes or None)
CORE = [
    (NAIF + "lsk/naif0012.tls", "spice/naif0012.tls", None),
    (NAIF + "pck/pck00011.tpc", "spice/pck00011.tpc", None),
    (NAIF + "pck/moon_pa_de440_200625.bpc", "spice/moon_pa_de440_200625.bpc", None),
    (NAIF + "fk/satellites/moon_de440_250416.tf", "spice/moon_de440_250416.tf", None),
    (NAIF + "spk/planets/de440s.bsp", "spice/de440s.bsp", None),
    (PDS + "ldem_80s_80m.lbl", "lola/ldem_80s_80m.lbl", None),
    (PDS + "ldem_80s_80m.img", "lola/ldem_80s_80m.img", 115520000),
    (PDS + "ldem_85s_20m.lbl", "lola/ldem_85s_20m.lbl", None),
    (PDS + "ldem_85s_20m.img", "lola/ldem_85s_20m.img", 460136448),
]
EXTRA = [
    (PDS + "ldem_875s_10m.lbl", "lola/ldem_875s_10m.lbl", None),
    (PDS + "ldem_875s_10m.img", "lola/ldem_875s_10m.img", 460136448),
]

GLOBAL = [
    (CYL + "ldem_64.lbl", "lola/ldem_64.lbl", None),
    (CYL + "ldem_64.img", "lola/ldem_64.img", 530841600),   # 64 px/deg, ~473 m at equator
]

# NASA PGDA 5 m/pixel LOLA DEMs for six south-pole landing sites (Barker et al. 2021); sizes unknown -> no size check
PGDA = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/"
SITES5M = [(PGDA + f"Site{n}/Site{n}_final_adj_5mpp_{k}.tif", f"lola5m/Site{n}_{k}.tif", None)
           for n in ("01", "04", "07", "11", "20", "23") for k in ("surf", "toterr", "slp")]

# NASA SVS CGI Moon Kit (item 4720): LROC WAC natural-colour mosaic, 16-bit sRGB, 16k wide, centred on 0 deg longitude
MOONKIT = [("https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_16k.tif", "moonkit/lroc_color_16bit_srgb_16k.tif", None)]

CTX = ssl.create_default_context()  # never disable verification


def human(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return "%.1f %s" % (n, unit)
        n /= 1024.0


def download(url, rel, expected, tries=6):
    dest = os.path.join(RAW, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if expected and os.path.exists(dest) and os.path.getsize(dest) == expected:
        print("  already complete: %s" % rel)
        return True
    for attempt in range(1, tries + 1):
        have = os.path.getsize(dest) if os.path.exists(dest) else 0
        if expected and have > expected:
            os.remove(dest)
            have = 0
        req = urllib.request.Request(url, headers={"User-Agent": "spaceapps-lunar-navigator/1.0"})
        if have:
            req.add_header("Range", "bytes=%d-" % have)
        try:
            with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
                status = getattr(r, "status", 200)
                mode = "ab" if (have and status == 206) else "wb"
                if mode == "wb":
                    have = 0
                total = have + int(r.headers.get("Content-Length") or 0)
                done = have
                t0 = time.time()
                with open(dest, mode) as f:
                    while True:
                        chunk = r.read(1 << 20)
                        if not chunk:
                            break
                        f.write(chunk)
                        done += len(chunk)
                        if total:
                            sys.stdout.write("\r  %s  %s / %s  (%d%%)   " % (
                                rel, human(done), human(total), 100 * done // total))
                            sys.stdout.flush()
            sys.stdout.write("\n")
            size = os.path.getsize(dest)
            if expected and size != expected:
                print("  size mismatch for %s: got %d expected %d" % (rel, size, expected))
                continue
            print("  ok: %s (%s, %.0fs)" % (rel, human(size), time.time() - t0))
            return True
        except urllib.error.HTTPError as e:
            if e.code == 416:  # range not satisfiable: file is already complete
                print("  ok (already complete): %s" % rel)
                return True
            print("\n  HTTP %s for %s (attempt %d/%d)" % (e.code, url, attempt, tries))
        except ssl.SSLError as e:
            print("\n  TLS error: %s\n  Fix your Python certificates; do not disable verification." % e)
            return False
        except Exception as e:  # network hiccup: retry
            print("\n  %s (attempt %d/%d)" % (e, attempt, tries))
        time.sleep(min(30, 3 * attempt))
    return False


def probe_horizons():
    """Small Moon-surface-observer query: Sun az/el at a south pole site, to test access and syntax."""
    params = {
        "format": "json",
        "COMMAND": "'10'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": "'-171.87,-89.7668,0'",
        "START_TIME": "'2026-11-15 00:00'",
        "STOP_TIME": "'2026-11-15 06:00'",
        "STEP_SIZE": "'1 h'",
        "QUANTITIES": "'4'",
        "CSV_FORMAT": "'YES'",
    }
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(params)
    out = os.path.join(RAW, "horizons_probe.json")
    os.makedirs(RAW, exist_ok=True)
    try:
        with urllib.request.urlopen(url, timeout=60, context=CTX) as r:
            body = r.read().decode("utf-8", "replace")
        with open(out, "w") as f:
            f.write(body)
        data = json.loads(body)
        text = data.get("result", "")
        print("Horizons reachable. Saved %s" % os.path.relpath(out, ROOT))
        print("--- first lines of result ---")
        print("\n".join(text.splitlines()[:40]))
        return True
    except Exception as e:
        print("Horizons probe failed: %s" % e)
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--extra", action="store_true", help="also download LOLA 87.5S 10 m")
    ap.add_argument("--global", dest="glob", action="store_true", help="also download LOLA global 64 ppd (~530 MB)")
    ap.add_argument("--sites5m", action="store_true", help="also download PGDA 5 m LOLA DEMs (surface, error, slope) for 6 polar sites")
    ap.add_argument("--moonkit", action="store_true", help="also download the NASA SVS CGI Moon Kit colour map (LROC WAC, 16k)")
    ap.add_argument("--probe", action="store_true", help="only test Horizons access")
    args = ap.parse_args()

    print("Project root: %s" % ROOT)
    ok = probe_horizons()
    if args.probe:
        sys.exit(0 if ok else 1)

    files = CORE + (EXTRA if args.extra else []) + (GLOBAL if args.glob else []) + (SITES5M if args.sites5m else []) + (MOONKIT if args.moonkit else [])
    failed = []
    for i, (url, rel, expected) in enumerate(files, 1):
        print("[%d/%d] %s" % (i, len(files), rel))
        if not download(url, rel, expected):
            failed.append(rel)
    print()
    if failed:
        print("FAILED: " + ", ".join(failed))
        print("Run the same command again to resume.")
        sys.exit(1)
    print("All downloads complete. Data is ready.")


if __name__ == "__main__":
    main()
