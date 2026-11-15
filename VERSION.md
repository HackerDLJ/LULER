# LULER v4.0.0 · Realistic Sun lighting

Built 2026-11-15 03:42 UTC.

Custom lighting shader on the Cesium terrain (derivative normals, crater bump detail, float-precision fix) so the true Sun position shades the surface, with soft shadows.

This is the actual compiled website as it was at this milestone (index.html + assets/index-DgzmiiLt.js), packaged with the NASA site data, textures and 3D models it loads. The source code for every feature is on the `main` branch (v7.0.0 and later).

## Run it

```bash
git checkout v4.0.0
python3 -m http.server 8080   # then open http://localhost:8080
```
