"""Load LOLA polar GDR grids (PDS3 .IMG, int16, height = DN * 0.5 m above the 1737.4 km sphere).

Projection facts verified here (not assumed): south polar stereographic, true
scale at the pole, orientation lon_sign=+1, lon_rot=0, pole at pixel
(LINE/SAMPLE_PROJECTION_OFFSET) in zero-based pixel coordinates. Checked against
the deepest points of Shackleton, Shoemaker, Faustini and Haworth and the
heights of Malapert and Nobile (see docs/validation.md).
"""
import math
import os

import numpy as np

from engine.horizon import R_MOON_M

GRIDS = {
    "80m": dict(file="ldem_80s_80m.img", n=7600, px=80.0, c=3799.5),
    "20m": dict(file="ldem_85s_20m.img", n=15168, px=20.0, c=7583.5),
}
SCALE = 0.5   # metres per DN (PDS label SCALING_FACTOR)


def memmap(raw_dir, key):
    g = GRIDS[key]
    return np.memmap(os.path.join(raw_dir, "lola", g["file"]), dtype="<i2", mode="r", shape=(g["n"], g["n"]))


def pole_pixel(lat_deg, lon_deg, px, c):
    rho = 2.0 * R_MOON_M * math.tan((math.pi / 2.0 + math.radians(lat_deg)) / 2.0)
    a = math.radians(lon_deg)
    return c + rho * math.sin(a) / px, c - rho * math.cos(a) / px


def load_window(mm, key, lat_deg, lon_deg, half_km):
    """Float32 height window (metres) around a site, with the pole's pixel position
    expressed in the window's own coordinates. Returns None if the site is outside."""
    g = GRIDS[key]
    col, row = pole_pixel(lat_deg, lon_deg, g["px"], g["c"])
    if not (0 <= col < g["n"] - 1 and 0 <= row < g["n"] - 1):
        return None
    n = int(half_km * 1000.0 / g["px"])
    c0, r0 = max(int(col) - n, 0), max(int(row) - n, 0)
    c1, r1 = min(int(col) + n + 1, g["n"]), min(int(row) + n + 1, g["n"])
    win = np.asarray(mm[r0:r1, c0:c1], dtype=np.float32) * SCALE
    return win, g["px"], g["c"] - c0, g["c"] - r0
