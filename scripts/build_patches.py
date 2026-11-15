"""Local terrain patches for the 3D view: 257x257 heights (metres, int16) around each site, from NASA LOLA.
Polar sites: LDEM_80S_80M, 40 km square (156 m/px). Other sites: LDEM_64 global, 120 km square (469 m/px).
Output: web/public/data/<id>.dem.json  {n, px_m, b64}"""
import base64, json, math, os, sys
import numpy as np
from numba import njit
from scipy.ndimage import map_coordinates
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine import horizon_global as hg, terrain
from engine.sites import SITES
from engine.catalog import CATALOG
R = 1737400.0; N = 257; OUT = "web/public/data"

@njit(cache=True)
def patch_global(g, lat, lon, half_m, n):
    out = np.empty((n, n)); lat1 = math.radians(lat); lon1 = math.radians(lon)
    sl, cl = math.sin(lat1), math.cos(lat1)
    for r in range(n):
        for c in range(n):
            e = (c / (n - 1) - 0.5) * 2 * half_m
            nn = (0.5 - r / (n - 1)) * 2 * half_m
            dist = math.hypot(e, nn)
            if dist < 1e-6:
                out[r, c] = hg._h(g, lat, lon % 360.0); continue
            th = math.atan2(e, nn); d = dist / R
            s2 = sl * math.cos(d) + cl * math.sin(d) * math.cos(th)
            lat2 = math.asin(min(1.0, max(-1.0, s2)))
            lon2 = lon1 + math.atan2(math.sin(th) * math.sin(d) * cl, math.cos(d) - sl * s2)
            out[r, c] = hg._h(g, math.degrees(lat2), math.degrees(lon2) % 360.0)
    return out

def _sample(mm, key, lat, lon, half_m, n, margin):
    g = terrain.GRIDS[key]; px = g["px"]; size = g["n"]
    col0, row0 = terrain.pole_pixel(lat, lon, px, g["c"])
    lam = math.radians(lon); colat = math.radians(90.0 + lat); k = 1.0 / math.cos(colat / 2) ** 2
    e = (np.arange(n) / (n - 1) - 0.5) * 2 * half_m
    nn = (0.5 - np.arange(n) / (n - 1)) * 2 * half_m
    E, Nn = np.meshgrid(e, nn)
    dx = (E * math.cos(lam) + Nn * math.sin(lam)) * k / px
    dy = (-E * math.sin(lam) + Nn * math.cos(lam)) * k / px
    c0, r0 = max(int(col0) - margin, 0), max(int(row0) - margin, 0)
    c1, r1 = min(int(col0) + margin, size), min(int(row0) + margin, size)
    win = np.asarray(mm[r0:r1, c0:c1], dtype=np.float32) * 0.5
    return map_coordinates(win, [row0 - dy - r0, col0 + dx - c0], order=1, mode="constant", cval=np.nan)


def patch_polar(mm80, mm20, lat, lon, half_m, n):
    """20 m grid where it exists (south of 85S), 80 m grid elsewhere."""
    h20 = _sample(mm20, "20m", lat, lon, half_m, n, 1500)
    h80 = _sample(mm80, "80m", lat, lon, half_m, n, 400)
    return np.where(np.isnan(h20), h80, h20), float(np.isnan(h20).mean() * 100)


def main():
    G = np.asarray(hg.memmap("data/raw")); mm = terrain.memmap("data/raw", "80m"); mm20 = terrain.memmap("data/raw", "20m")
    items = [(s["id"], s["lat"], s["lon"], True) for s in SITES] + [(c[0], c[2], c[3], False) for c in CATALOG]
    for sid, lat, lon, polar in items:
        half = 20000.0 if polar else 60000.0
        n = 513 if polar else N
        if polar:
            h, miss = patch_polar(mm, mm20, lat, lon, half, n)
        else:
            h, miss = patch_global(G, lat, lon, half, n), 0.0
        q = np.round(h).astype("<i2")
        json.dump({"n": n, "px_m": 2 * half / (n - 1), "b64": base64.b64encode(q.tobytes()).decode()}, open(f"{OUT}/{sid}.dem.json", "w"))
        print(f"{sid:24s} relief {h.min():8.0f} .. {h.max():8.0f} m  centre {h[n//2, n//2]:8.0f}  80m-fallback {miss:.0f}%", flush=True)
if __name__ == "__main__":
    main()
