"""Hillshaded south-polar base map (NASA LOLA 80 m) + downsampled height grid.
300 km x 300 km around the pole, 400 m/px. Output: web/public/map/base.png, heights.json(b64 int16 decametres)."""
import base64, json, sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine.terrain import memmap, GRIDS
from PIL import Image
RAW="data/raw"; OUT="web/public/map"
mm = memmap(RAW, "80m"); g = GRIDS["80m"]
half = int(150000/g["px"]); c = int(g["c"])
h = np.asarray(mm[c-half:c+half, c-half:c+half], dtype=np.float32)*0.5   # metres, 3750x3750
gy, gx = np.gradient(h, g["px"])
# sun from low angle (azimuth 315 deg, elevation 12 deg) for relief shading
az, el = np.radians(315), np.radians(12)
sx, sy, sz = np.sin(az)*np.cos(el), np.cos(az)*np.cos(el), np.sin(el)
nx, ny, nz = -gx, gy, np.ones_like(gx)          # image y grows south->down; north up
nl = np.sqrt(nx**2+ny**2+nz**2)
shade = np.clip((nx*sx+ny*sy+nz*sz)/nl, 0, 1)
f = 5; n = shade.shape[0]//f*f
def down(a): return a[:n,:n].reshape(n//f,f,n//f,f).mean(axis=(1,3))
s = down(shade); hh = down(h)
rel = (hh-hh.min())/(hh.max()-hh.min())
img = np.clip(0.15+0.85*s,0,1)*(0.75+0.25*rel)
Image.fromarray((img*255).astype(np.uint8)).save(f"{OUT}/base.png")
print("size", s.shape, "height range m", float(hh.min()), float(hh.max()))
q = np.round(hh/10).astype("<i2")
json.dump({"n": int(q.shape[0]), "px_m": g["px"]*f, "unit_m": 10, "b64": base64.b64encode(q.tobytes()).decode()}, open(f"{OUT}/heights.json","w"))
