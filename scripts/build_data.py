"""Precompute everything the web app needs.

Per site: hourly Sun/Earth azimuth/elevation (2027-01-01 .. 2028-12-31 UTC) and terrain horizon masks for
mast heights x 9 position offsets (centre + 8 points on a 100 m ring). Browser computes all metrics.
Sky blob layout: sunAz u16 (x100), sunEl float32, earthAz u16 (x100), earthEl float32 (elevations are float so that
high Sun/Earth at non-polar sites cannot overflow).
Outputs web/public/data/{manifest.json, common.json, <id>.sky.json, <id>.hz.json} (base64 payloads).
"""
import base64
import json
import math
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from engine import ephem, terrain
from engine.horizon import horizon_profile, site_height
from engine.sites import SITES
from engine.catalog import CATALOG
from engine import horizon_global as hg

RAW = "data/raw"
OUT = "web/public/data"
N_AZ = 720
MASTS = [0.0, 2.0, 5.0, 10.0]
RING_M = 100.0
OFFSETS = [(0.0, 0.0)] + [(RING_M * math.cos(math.radians(a)), RING_M * math.sin(math.radians(a))) for a in range(0, 360, 45)]
START, STOP, STEP_S = "2027-01-01 00:00:00 UTC", "2028-12-31 23:00:00 UTC", 3600.0
R = 1737400.0


def write_blob(stem, data):
    """Binary payloads are stored as {"b64": ...} JSON so any static host serves them."""
    with open(os.path.join(OUT, stem + ".json"), "w") as f:
        json.dump({"b64": base64.b64encode(data).decode("ascii")}, f)


def shift(lat, lon, dx_east, dy_north):
    return lat + math.degrees(dy_north / R), lon + math.degrees(dx_east / (R * math.cos(math.radians(lat))))


def horizon_composite(w80, w20, lat, lon, mast):
    win, px, cx, cy = w80
    h80, e80 = horizon_profile(win, px, cx, cy, 1.0, 0.0, lat, lon, mast, N_AZ, px, 100000.0)
    h = h80
    if w20 is not None:
        win, px, cx, cy = w20
        h20, _ = horizon_profile(win, px, cx, cy, 1.0, 0.0, lat, lon, mast, N_AZ, px, 60000.0)
        h = np.maximum(h80, np.where(np.isnan(h20), -90.0, h20))
    return h, float(100 * e80.mean())


def main():
    os.makedirs(OUT, exist_ok=True)
    ephem.load_kernels(RAW)
    et = ephem.et_range(START, STOP, STEP_S)
    n = len(et)
    mm80, mm20 = terrain.memmap(RAW, "80m"), terrain.memmap(RAW, "20m")
    manifest = dict(
        generated_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        start_utc="2027-01-01T00:00:00Z", step_s=STEP_S, n=n, n_az=N_AZ, masts_m=MASTS,
        offsets_m=[[round(a, 3), round(b, 3)] for a, b in OFFSETS], ring_m=RING_M,
        data_sources=dict(
            ephemeris="NASA/NAIF SPICE: DE440s planetary ephemeris, lunar orientation moon_pa_de440_200625.bpc + moon_de440_250416.tf (MOON_ME frame), LT+S",
            terrain="NASA LRO/LOLA global GDR LDEM_64 (non-polar sites, horizon to 150 km); polar GDR LDEM_80S_80M (far field, 100 km) and LDEM_85S_20M (near field, 60 km) from the PDS Geosciences Node",
            validation="JPL Horizons observer ephemeris (see docs/validation.md)"),
        sites=[])
    G = np.asarray(hg.memmap(RAW))
    ALL = [dict(s, group="Polar candidate regions", mission="Provisional region centre", year=None, accuracy="provisional", polar=True) for s in SITES]
    ALL += [dict(id=i, name=n, lat=la, lon=lo, group=g, mission=m, year=y, accuracy=a, polar=False) for (i, n, la, lo, g, m, y, a) in CATALOG]
    common_done = False
    for s in ALL:
        t0 = time.time()
        lat, lon = s["lat"], s["lon"]
        if s["polar"]:
            w80 = terrain.load_window(mm80, "80m", lat, lon, 110.0)
            w20 = terrain.load_window(mm20, "20m", lat, lon, 60.0)
            win, px, cx, cy = w80
            h_site = float(site_height(win, px, cx, cy, 1.0, 0.0, lat, lon))
        else:
            h_site = float(hg._h(G, lat, lon % 360.0))
        hz = np.zeros((len(MASTS), len(OFFSETS), N_AZ), dtype=np.int16)
        edge = 0.0
        for mi, mast in enumerate(MASTS):
            for oi, (dx, dy) in enumerate(OFFSETS):
                la, lo = shift(lat, lon, dx, dy)
                if s["polar"]:
                    h, e = horizon_composite(w80, w20, la, lo, mast)
                else:
                    h, e = hg.horizon_global(G, la, lo, mast, N_AZ, 250.0, 150000.0), 0.0
                if np.isnan(h).any():
                    raise RuntimeError("NaN horizon for %s mast %s offset %s" % (s["id"], mast, (dx, dy)))
                hz[mi, oi] = np.round(h * 100.0).astype(np.int16)
                edge = max(edge, e)
        sky = ephem.sky_series(lat, lon, 2.0, et)
        if not common_done:
            write_blob("common", np.round(sky["sun_r_deg"] * 10000).astype("<u2").tobytes()
                       + np.round(sky["earth_r_deg"] * 10000).astype("<u2").tobytes())
            common_done = True
        write_blob(s["id"] + ".sky",
                   np.round(sky["sun_az"] * 100).astype("<u2").tobytes()
                   + sky["sun_el"].astype("<f4").tobytes()
                   + np.round(sky["earth_az"] * 100).astype("<u2").tobytes()
                   + sky["earth_el"].astype("<f4").tobytes())
        write_blob(s["id"] + ".hz", hz.astype("<i2").tobytes())
        manifest["sites"].append(dict(id=s["id"], name=s["name"], lat=lat, lon=lon, height_m=round(h_site, 1),
                                      max_horizon_deg=float(hz[1, 0].max() / 100.0), edge_hit_pct_80m=round(edge, 1),
                                      group=s["group"], mission=s["mission"], year=s["year"], accuracy=s["accuracy"],
                                      terrain="LOLA 80 m + 20 m polar" if s["polar"] else "LOLA global 64 ppd (~470 m)",
                                      provisional=bool(s["polar"])))
        print("%-24s h=%7.1f m  max horizon %5.2f deg  (%.0fs)" % (s["name"], h_site, hz[1, 0].max() / 100.0, time.time() - t0), flush=True)
    json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
    print("done:", n, "hours,", len(ALL), "sites")


if __name__ == "__main__":
    main()
