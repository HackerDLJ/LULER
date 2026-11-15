"""Power and communication metrics from sky positions and a horizon mask."""
import numpy as np


def mask_at(horizon_deg, az_deg):
    """Interpolate a periodic horizon profile (evenly spaced in azimuth)."""
    n = len(horizon_deg)
    grid = np.arange(n) * 360.0 / n
    return np.interp(az_deg % 360.0, grid, horizon_deg, period=360.0)


def disc_fraction(center_el, mask_el, radius):
    """Visible fraction of a disc of angular radius `radius` whose centre is at
    `center_el`, above a straight horizon at `mask_el` (all degrees)."""
    x = np.clip((np.asarray(center_el) - np.asarray(mask_el)) / np.asarray(radius), -1.0, 1.0)
    return (np.arccos(-x) + x * np.sqrt(1.0 - x * x)) / np.pi


def longest_run(flags, dt_hours):
    """Longest consecutive run of True, in hours."""
    best = cur = 0
    for f in flags:
        cur = cur + 1 if f else 0
        best = max(best, cur)
    return best * dt_hours


def site_metrics(sky, horizon_deg, dt_hours, earth_min_el_deg=0.0):
    sun_mask = mask_at(horizon_deg, sky["sun_az"])
    earth_mask = mask_at(horizon_deg, sky["earth_az"])
    sun_frac = disc_fraction(sky["sun_el"], sun_mask, sky["sun_r_deg"])
    sun_up = sky["sun_el"] > sun_mask
    earth_up = sky["earth_el"] > np.maximum(earth_mask, 0.0) + earth_min_el_deg
    both = sun_up & earth_up
    dark = sun_frac < 0.01
    return {
        "power_index_pct": 100.0 * float(sun_frac.mean()),   # mean illuminated fraction of the Sun's disc
        "sun_up_pct": 100.0 * float(sun_up.mean()),
        "earth_up_pct": 100.0 * float(earth_up.mean()),
        "both_pct": 100.0 * float(both.mean()),
        "longest_dark_h": longest_run(dark, dt_hours),
        "longest_sunlit_h": longest_run(~dark, dt_hours),
        "longest_comm_gap_h": longest_run(~earth_up, dt_hours),
    }
