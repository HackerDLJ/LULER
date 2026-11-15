"""First end-to-end run: horizon masks + Sun/Earth sky for candidate sites -> metrics."""
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from engine import ephem, terrain
from engine.horizon import horizon_profile
from engine.metrics import site_metrics

RAW = "data/raw"
# PROVISIONAL: region centres as reported from NASA's 2025 Lunar Surface Data Book by a public
# student repo. Replace with the official list from the challenge page.
SITES = [
    ("Connecting ridge", -89.4632, -137.49000),
    ("Shackleton rim", -89.7668, -171.87000),
    ("Peak near Shackleton", -88.8110, 123.69010),
    ("de Gerlache rim", -88.6834, -67.93210),
    ("Nobile rim 1", -85.4381, 37.36667),
    ("Leibnitz beta plateau", -85.4266, 31.74276),
    ("Malapert massif", -85.9948, -0.23578),
]
MAST = float(os.environ.get("MAST_M", "2.0"))
N_AZ = 1440


def composite_horizon(mm80, mm20, lat, lon, mast):
    """80 m grid for the far field (100 km), 20 m grid for the near field where it covers; take the higher."""
    out = {}
    w = terrain.load_window(mm80, "80m", lat, lon, 110.0)
    win, px, cx, cy = w
    hz80, edge80 = horizon_profile(win, px, cx, cy, 1.0, 0.0, lat, lon, mast, N_AZ, px, 100000.0)
    out["h80"], out["edge80"] = hz80, edge80
    w20 = terrain.load_window(mm20, "20m", lat, lon, 60.0)
    if w20 is not None:
        win, px, cx, cy = w20
        hz20, edge20 = horizon_profile(win, px, cx, cy, 1.0, 0.0, lat, lon, mast, N_AZ, px, 60000.0)
        out["h20"], out["edge20"] = hz20, edge20
    return out


def main():
    ephem.load_kernels(RAW)
    et = ephem.et_range("2027-01-01 00:00:00 UTC", "2028-12-31 23:00:00 UTC", 3600.0)
    mm80 = terrain.memmap(RAW, "80m")
    mm20 = terrain.memmap(RAW, "20m")
    rows = []
    for name, lat, lon in SITES:
        t0 = time.time()
        hz = composite_horizon(mm80, mm20, lat, lon, MAST)
        h80 = hz["h80"]
        h20 = hz.get("h20")
        use20 = h20 is not None and not np.isnan(h20).any()
        horizon = np.maximum(h80, np.where(np.isnan(h20), -90, h20)) if use20 else h80
        sky = ephem.sky_series(lat, lon, MAST, et)
        m = site_metrics(sky, horizon, 1.0)
        m80 = site_metrics(sky, h80, 1.0)
        rows.append(dict(site=name, lat=lat, lon=lon, mast_m=MAST, metrics=m,
                         sensitivity_80m_only=m80, max_horizon_deg=float(np.nanmax(horizon)),
                         edge_hit_80m_pct=float(100 * hz["edge80"].mean())))
        print(f"{name:22s} sunlit {m['sun_up_pct']:5.1f}%  power {m['power_index_pct']:5.1f}%  Earth {m['earth_up_pct']:5.1f}%  "
              f"both {m['both_pct']:5.1f}%  longest dark {m['longest_dark_h']:6.0f} h  longest comm gap {m['longest_comm_gap_h']:6.0f} h  "
              f"[80m-only sunlit {m80['sun_up_pct']:5.1f}%]  edge80 {rows[-1]['edge_hit_80m_pct']:.0f}%  ({time.time()-t0:.0f}s)")
    json.dump(rows, open("data/processed/first_run.json", "w"), indent=1)


if __name__ == "__main__":
    main()
