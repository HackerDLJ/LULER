"""Real lunar surface imagery for the 3D views, from the NASA SVS CGI Moon Kit (LROC WAC natural-colour mosaic).
Outputs web/public/map/moon.jpg (4096x2048 globe texture) and web/public/data/<id>.tex.jpg (512x512, non-polar sites).
The Moon Kit map is equirectangular, centred on 0 deg longitude, north up."""
import json, math, os, sys
import numpy as np
import tifffile
from PIL import Image
from scipy.ndimage import map_coordinates
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine.catalog import CATALOG
R = 1737400.0
a = tifffile.imread("data/raw/moonkit/lroc_color_16bit_srgb_16k.tif")
print("read", a.shape, a.dtype, flush=True)
img = np.empty(a.shape, np.uint8)
for i in range(0, a.shape[0], 512):
    img[i:i + 512] = (a[i:i + 512] >> 8).astype(np.uint8)
del a
H, W, _ = img.shape
g = img.reshape(H // 4, 4, W // 4, 4, 3).mean(axis=(1, 3)).astype(np.uint8)
Image.fromarray(g).save("web/public/map/moon.jpg", quality=88)
print("globe", g.shape, flush=True)
N = 512; half = 60000.0
e = (np.arange(N) / (N - 1) - 0.5) * 2 * half; nn = (0.5 - np.arange(N) / (N - 1)) * 2 * half
E_, N_ = np.meshgrid(e, nn); dist = np.hypot(E_, N_); th = np.arctan2(E_, N_); d = dist / R
for c in CATALOG:
    sid, lat, lon = c[0], c[2], c[3]
    la, lo = math.radians(lat), math.radians(lon)
    s2 = math.sin(la) * np.cos(d) + math.cos(la) * np.sin(d) * np.cos(th)
    lat2 = np.arcsin(np.clip(s2, -1, 1)); lon2 = lo + np.arctan2(np.sin(th) * np.sin(d) * math.cos(la), np.cos(d) - math.sin(la) * s2)
    row = (90.0 - np.degrees(lat2)) / 180.0 * H - 0.5
    col = ((np.degrees(lon2) + 180.0) % 360.0) / 360.0 * W - 0.5
    out = np.stack([map_coordinates(img[:, :, k], [row, col], order=1, mode="wrap") for k in range(3)], axis=-1)
    Image.fromarray(out.astype(np.uint8)).save(f"web/public/data/{sid}.tex.jpg", quality=88)
    print(sid, out.mean().round(1), flush=True)
