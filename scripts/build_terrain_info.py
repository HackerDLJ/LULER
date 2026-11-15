"""Per-site terrain facts (elevation, slope, relief, data source) and, for the six south-pole sites covered by
NASA PGDA's 5 m LOLA DEMs (Barker et al. 2021), a fine 4 km x 4 km terrain patch at 10 m spacing.
Outputs web/public/data/terrain.json and web/public/data/<id>.fine.json."""
import base64, json, math, os, sys
import numpy as np
import tifffile
from scipy.ndimage import map_coordinates
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine import horizon_global as hg, terrain
from engine.sites import SITES
from engine.catalog import CATALOG
from scripts.build_patches import _sample, patch_global  # noqa
R = 1737400.0
OUT = "web/public/data"
PGDA = {"connecting-ridge": "01", "shackleton-rim": "04", "peak-near-shackleton": "07", "de-gerlache-rim": "11", "leibnitz-beta-plateau": "20", "malapert-massif": "23"}


def slope_relief(h, spacing):
    n = h.shape[0]; c = n // 2
    de = (h[c, c + 1] - h[c, c - 1]) / (2 * spacing); dn = (h[c - 1, c] - h[c + 1, c]) / (2 * spacing)
    gy, gx = np.gradient(h, spacing)
    sl = np.degrees(np.arctan(np.hypot(gx, gy)))
    return float(math.degrees(math.atan(math.hypot(de, dn)))), float(np.nanmean(sl)), float(np.nanmax(sl)), float(np.nanmax(h) - np.nanmin(h))


def tif(path):
    t = tifffile.TiffFile(path); p = t.pages[0]
    sc = p.tags["ModelPixelScaleTag"].value; tp = p.tags["ModelTiepointTag"].value
    return p.asarray(), sc[0], tp[3], tp[4]


def fine_grid(arr, px, x0, y0, lat, lon, half, n):
    """Sample a north-up local east/north grid from a south-polar-stereographic GeoTIFF (x = rho sin lon, y = rho cos lon)."""
    colat = math.radians(90.0 + lat); lam = math.radians(lon)
    rho = 2 * R * math.tan(colat / 2); k = 1.0 / math.cos(colat / 2) ** 2
    xs, ys = rho * math.sin(lam), rho * math.cos(lam)
    e = (np.arange(n) / (n - 1) - 0.5) * 2 * half; nn = (0.5 - np.arange(n) / (n - 1)) * 2 * half
    E, N = np.meshgrid(e, nn)
    xm = xs + (E * math.cos(lam) + N * math.sin(lam)) * k
    ym = ys + (-E * math.sin(lam) + N * math.cos(lam)) * k
    return map_coordinates(arr, [(y0 - ym) / px - 0.5, (xm - x0) / px - 0.5], order=1, mode="constant", cval=np.nan)


def main():
    G = np.asarray(hg.memmap("data/raw")); mm80 = terrain.memmap("data/raw", "80m"); mm20 = terrain.memmap("data/raw", "20m")
    out = {}
    items = [(s["id"], s["lat"], s["lon"], True) for s in SITES] + [(c[0], c[2], c[3], False) for c in CATALOG]
    for sid, lat, lon, polar in items:
        if polar:
            sp = 20.0; n = 101  # +-1 km at the native 20 m spacing
            h = _sample(mm20, "20m", lat, lon, sp * (n - 1) / 2, n, 400)
            if np.isnan(h).any():
                sp = 80.0; h = _sample(mm80, "80m", lat, lon, sp * (n - 1) / 2, n, 200)
            src = "NASA LRO LOLA polar grid LDEM_85S_20M" if sp == 20 else "NASA LRO LOLA polar grid LDEM_80S_80M"
            mesh = "3D mesh: 40 km square at 78 m spacing"
        else:
            sp = 473.8; n = 21  # +-4.7 km at the native 64 px/deg spacing
            h = patch_global(G, lat, lon, sp * (n - 1) / 2, n)
            src = "NASA LRO LOLA global grid LDEM_64 (64 px/deg)"
            mesh = "3D mesh: 120 km square at 469 m spacing"
        s0, smean, smax, relief = slope_relief(h, sp)
        d = dict(elev_m=round(float(h[n // 2, n // 2]), 1), slope_deg=round(s0, 2), slope_baseline_m=round(2 * sp), slope_mean_deg=round(smean, 2), slope_max_deg=round(smax, 2),
                 relief_m=round(relief), area_km=round(sp * (n - 1) / 1000, 1), source=src, resolution_m=round(sp), mesh=mesh)
        if sid in PGDA:
            k = PGDA[sid]
            arr, px, x0, y0 = tif(f"data/raw/lola5m/Site{k}_surf.tif")
            nf = 401; f = fine_grid(arr, px, x0, y0, lat, lon, 2000.0, nf)
            c = nf // 2
            if np.isfinite(f).all():
                loc = f[c - 5:c + 6, c - 5:c + 6]  # +-50 m
                gy, gx = np.gradient(fine_grid(arr, px, x0, y0, lat, lon, 50.0, 21), 5.0)
                sl5 = np.degrees(np.arctan(np.hypot(gx, gy)))
                zerr = float(fine_grid(tif(f"data/raw/lola5m/Site{k}_toterr.tif")[0], px, x0, y0, lat, lon, 50.0, 21)[10, 10])
                d["fine"] = dict(src=f"NASA PGDA 5 m LOLA DEM, Site{k} (Barker et al. 2021)", px_m=5, slope_center_deg=round(float(sl5[10, 10]), 2), slope_mean_50m_deg=round(float(sl5.mean()), 2),
                                 slope_max_50m_deg=round(float(sl5.max()), 2), relief_50m_m=round(float(loc.max() - loc.min()), 1), z_err_m=round(zerr, 2), elev_m=round(float(f[c, c]), 1),
                                 patch="inner 4 km square at 10 m spacing")
                q = np.round((f - f[c, c]) * 10).astype("<i2")
                json.dump({"n": nf, "px_m": 10.0, "scale": 0.1, "b64": base64.b64encode(q.tobytes()).decode()}, open(f"{OUT}/{sid}.fine.json", "w"))
                print(f"  fine ok: 5 m DEM centre {f[c, c]:.1f} m vs grid {d['elev_m']} m, 5 m slope {d['fine']['slope_center_deg']} deg, z err {zerr:.2f} m")
            else:
                print("  fine patch has gaps; skipped", float(np.isnan(f).mean()))
        out[sid] = d
        print(f"{sid:24s} elev {d['elev_m']:8.1f} m  slope {d['slope_deg']:5.2f} deg over {d['slope_baseline_m']} m  relief {d['relief_m']} m in {d['area_km']} km", flush=True)
    json.dump(out, open(f"{OUT}/terrain.json", "w"), indent=1)

main()
