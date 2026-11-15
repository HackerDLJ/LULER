"""Terrain horizon masks from LOLA south-polar stereographic grids.

For a site (lat, lon) and an observer height, march along each azimuth over
the DEM and keep the highest elevation angle seen above the local horizontal.
The geometry is exact on the lunar reference sphere (no flat-Moon shortcut),
so lunar curvature is included automatically.

DEM heights are metres relative to the sphere of radius R_MOON_M (1737.4 km),
which is the LOLA datum.
"""
import math

import numpy as np
from numba import njit

R_MOON_M = 1737400.0


@njit(cache=True)
def _bilinear(dem, col, row):
    h, w = dem.shape
    if col < 0.0 or row < 0.0 or col > w - 1.001 or row > h - 1.001:
        return np.nan
    c0 = int(col)
    r0 = int(row)
    fc = col - c0
    fr = row - r0
    v00 = dem[r0, c0]
    v01 = dem[r0, c0 + 1]
    v10 = dem[r0 + 1, c0]
    v11 = dem[r0 + 1, c0 + 1]
    if np.isnan(v00) or np.isnan(v01) or np.isnan(v10) or np.isnan(v11):
        return np.nan
    return (v00 * (1.0 - fc) + v01 * fc) * (1.0 - fr) + (v10 * (1.0 - fc) + v11 * fc) * fr


@njit(cache=True)
def _project_south(lat, lon, px, cx, cy, lon_sign, lon_rot):
    """South polar stereographic, true scale at the pole. lat/lon in radians.
    Returns fractional (col, row). Orientation (lon_sign, lon_rot) is set from
    the PDS label and verified against known terrain before use."""
    colat = math.pi / 2.0 + lat
    rho = 2.0 * R_MOON_M * math.tan(colat / 2.0)
    ang = lon_sign * lon + lon_rot
    x = rho * math.sin(ang)
    y = rho * math.cos(ang)
    return cx + x / px, cy - y / px


@njit(cache=True)
def site_height(dem, px, cx, cy, lon_sign, lon_rot, lat_deg, lon_deg):
    col, row = _project_south(math.radians(lat_deg), math.radians(lon_deg), px, cx, cy, lon_sign, lon_rot)
    return _bilinear(dem, col, row)


@njit(cache=True)
def horizon_profile(dem, px, cx, cy, lon_sign, lon_rot,
                    lat_deg, lon_deg, mast_m, n_az, step_m, max_range_m):
    """Return (horizon_deg[n_az], hit_edge[n_az]).

    horizon_deg[k] is the terrain elevation angle (deg above local horizontal)
    at azimuth k*360/n_az, clockwise from north. hit_edge[k] is True if the ray
    left the DEM before max_range_m (coverage limit, not a real horizon)."""
    lat1 = math.radians(lat_deg)
    lon1 = math.radians(lon_deg)
    col0, row0 = _project_south(lat1, lon1, px, cx, cy, lon_sign, lon_rot)
    h_site = _bilinear(dem, col0, row0)
    out = np.full(n_az, np.nan)
    edge = np.zeros(n_az, dtype=np.bool_)
    if np.isnan(h_site):
        return out, edge
    r_obs = R_MOON_M + h_site + mast_m
    sin1 = math.sin(lat1)
    cos1 = math.cos(lat1)
    nsteps = int(max_range_m / step_m)
    for k in range(n_az):
        az = 2.0 * math.pi * k / n_az
        caz = math.cos(az)
        saz = math.sin(az)
        best = -math.pi / 2.0
        for i in range(1, nsteps + 1):
            delta = (i * step_m) / R_MOON_M
            sind = math.sin(delta)
            cosd = math.cos(delta)
            sin2 = sin1 * cosd + cos1 * sind * caz
            if sin2 > 1.0:
                sin2 = 1.0
            elif sin2 < -1.0:
                sin2 = -1.0
            lat2 = math.asin(sin2)
            lon2 = lon1 + math.atan2(saz * sind * cos1, cosd - sin1 * sin2)
            col, row = _project_south(lat2, lon2, px, cx, cy, lon_sign, lon_rot)
            ht = _bilinear(dem, col, row)
            if np.isnan(ht):
                edge[k] = True
                break
            r_t = R_MOON_M + ht
            th = math.atan2(r_t * cosd - r_obs, r_t * sind)
            if th > best:
                best = th
        out[k] = math.degrees(best)
    return out, edge
