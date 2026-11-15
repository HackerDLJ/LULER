"""Horizon mask for ANY lunar site from the LOLA global 64 ppd grid (equirectangular, ~473 m/px at equator).

Exact spherical geometry: rays follow great circles from the site; elevation of each terrain point is measured
in the site's local frame including lunar curvature. Grid facts verified against the PDS label and extremes
(max +10.75 km at 5.4N 201.4E, min -9.1 km at 70.4S 187.5E; see docs/validation.md).
"""
import math
import numpy as np
from numba import njit

R = 1737400.0
PPD = 64.0
NR, NC = 11520, 23040
ROW0, COL0 = 5759.5, 11519.5


def memmap(raw_dir):
    import os
    return np.memmap(os.path.join(raw_dir, "lola", "ldem_64.img"), dtype="<i2", mode="r", shape=(NR, NC))


@njit(cache=True)
def _h(g, lat, lon):
    r = ROW0 - lat * PPD
    c = COL0 + (lon - 180.0) * PPD
    c = c % NC
    if r < 0.0: r = 0.0
    if r > NR - 1.001: r = NR - 1.001
    r0 = int(r); c0 = int(c); fr = r - r0; fc = c - c0
    c1 = (c0 + 1) % NC
    v = (g[r0, c0] * (1 - fc) + g[r0, c1] * fc) * (1 - fr) + (g[r0 + 1, c0] * (1 - fc) + g[r0 + 1, c1] * fc) * fr
    return v * 0.5


@njit(cache=True)
def horizon_global(g, lat_deg, lon_deg, mast_m, n_az, step_m, max_range_m):
    lat1 = math.radians(lat_deg); lon1 = math.radians(lon_deg)
    h0 = _h(g, lat_deg, lon_deg) + mast_m
    out = np.empty(n_az); edge = np.zeros(n_az, dtype=np.uint8)
    nstep = int(max_range_m / step_m)
    sl, cl = math.sin(lat1), math.cos(lat1)
    for k in range(n_az):
        th = 2.0 * math.pi * k / n_az
        st, ct = math.sin(th), math.cos(th)
        best = -90.0
        for i in range(1, nstep + 1):
            d = i * step_m / R
            sd, cd = math.sin(d), math.cos(d)
            s2 = sl * cd + cl * sd * ct
            lat2 = math.asin(min(1.0, max(-1.0, s2)))
            lon2 = lon1 + math.atan2(st * sd * cl, cd - sl * s2)
            h = _h(g, math.degrees(lat2), math.degrees(lon2) % 360.0)
            dz = (R + h) * cd - (R + h0)
            dx = (R + h) * sd
            e = math.degrees(math.atan2(dz, dx))
            if e > best: best = e
        out[k] = best
    return out
