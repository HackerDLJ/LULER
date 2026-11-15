"""Hourly sub-solar and sub-Earth points on the Moon (MOON_ME, LT+S) for the globe view.
Output web/public/data/globe.json: int16 x100 deg, order sunLon, sunLat, earthLon, earthLat (lon -180..180)."""
import base64, json, os, sys
import numpy as np
import spiceypy as sp
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine import ephem
ephem.load_kernels("data/raw")
et = ephem.et_range("2027-01-01 00:00:00 UTC", "2028-12-31 23:00:00 UTC", 3600.0)
out = []
for body in ("SUN", "EARTH"):
    pos, _ = sp.spkpos(body, np.asarray(et), "MOON_ME", "LT+S", "MOON")
    pos = np.asarray(pos); r = np.linalg.norm(pos, axis=1)
    lon = np.degrees(np.arctan2(pos[:, 1], pos[:, 0])); lat = np.degrees(np.arcsin(pos[:, 2] / r))
    print(body, "lat range", lat.min().round(2), lat.max().round(2), "lon range", lon.min().round(1), lon.max().round(1))
    out += [np.round(lon * 100).astype("<i2").tobytes(), np.round(lat * 100).astype("<i2").tobytes()]
json.dump({"n": len(et), "b64": base64.b64encode(b"".join(out)).decode()}, open("web/public/data/globe.json", "w"))
