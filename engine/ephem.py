"""Sun and Earth azimuth/elevation at a lunar surface site, from NASA NAIF SPICE.

Frame: MOON_ME (Mean Earth / Polar Axis), the same frame LOLA grids and JPL
Horizons use. Corrections: light time + stellar aberration (LT+S).
Kernels (all NASA/NAIF): naif0012.tls, pck00011.tpc, moon_de440_250416.tf,
moon_pa_de440_200625.bpc, de440s.bsp.
"""
import math
import os

import numpy as np
import spiceypy as sp

R_MOON_KM = 1737.4
R_SUN_KM = 695700.0     # IAU nominal solar radius
R_EARTH_KM = 6371.0     # mean Earth radius (angular size only)

KERNELS = [
    "naif0012.tls",
    "pck00011.tpc",
    "moon_de440_250416.tf",
    "moon_pa_de440_200625.bpc",
    "de440s.bsp",
]


def load_kernels(raw_dir):
    sp.kclear()
    for k in KERNELS:
        sp.furnsh(os.path.join(raw_dir, "spice", k))


def et_range(start_utc, stop_utc, step_s):
    et0 = sp.str2et(start_utc)
    et1 = sp.str2et(stop_utc)
    n = int(math.floor((et1 - et0) / step_s)) + 1
    return et0 + step_s * np.arange(n)


def _enu_basis(lat, lon):
    sl, cl = math.sin(lat), math.cos(lat)
    so, co = math.sin(lon), math.cos(lon)
    east = np.array([-so, co, 0.0])
    north = np.array([-sl * co, -sl * so, cl])
    up = np.array([cl * co, cl * so, sl])
    return east, north, up


def sky_series(lat_deg, lon_deg_east, height_m, et, frame="MOON_ME", abcorr="LT+S"):
    """Return dict with az/el (deg) and distance (km) for SUN and EARTH."""
    lat, lon = math.radians(lat_deg), math.radians(lon_deg_east)
    east, north, up = _enu_basis(lat, lon)
    site = (R_MOON_KM + height_m / 1000.0) * up
    out = {"et": np.asarray(et)}
    for name, key in (("SUN", "sun"), ("EARTH", "earth")):
        pos, _ = sp.spkpos(name, np.asarray(et), frame, abcorr, "MOON")
        rel = np.asarray(pos) - site
        e, n, u = rel @ east, rel @ north, rel @ up
        dist = np.sqrt(e * e + n * n + u * u)
        out[key + "_az"] = np.degrees(np.arctan2(e, n)) % 360.0
        out[key + "_el"] = np.degrees(np.arcsin(u / dist))
        out[key + "_dist_km"] = dist
    out["sun_r_deg"] = np.degrees(np.arcsin(R_SUN_KM / out["sun_dist_km"]))
    out["earth_r_deg"] = np.degrees(np.arcsin(R_EARTH_KM / out["earth_dist_km"]))
    return out
