import * as THREE from 'three';

/* Real star field: Yale Bright Star Catalogue (5th rev. ed., NASA HEASARC/ADC), 6,300+ stars to V 6.2,
   placed by their true right ascension and declination, coloured by temperature and dimmed by magnitude.
   y is the celestial north pole. Replaces any random "decorative" stars. */
let data: Promise<number[]> | null = null;
const load = () => (data ??= fetch(import.meta.env.BASE_URL + 'data/stars.json').then((r) => r.json()).then((j) => j.stars as number[]).catch(() => []));

function tempRGB(k: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, k)) / 100; // Tanner Helland black-body approximation
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.1 : 288.1 * Math.pow(t - 60, -0.0755);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5 * Math.log(t - 10) - 305;
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return [c(r), c(g), c(b)];
}

export function realStars(radius: number, size: number, attenuation = true): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, sizeAttenuation: attenuation, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  pts.name = 'real-stars';
  load().then((s) => {
    const n = s.length / 4; if (!n) return;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const ra = (s[4 * i] * Math.PI) / 180, dec = (s[4 * i + 1] * Math.PI) / 180, v = s[4 * i + 2];
      pos.set([radius * Math.cos(dec) * Math.cos(ra), radius * Math.sin(dec), -radius * Math.cos(dec) * Math.sin(ra)], 3 * i);
      const b = Math.min(1, Math.max(0.12, Math.pow(10, -0.4 * (v - 1.5)) * 1.6)); // brighter stars glow more
      const [r, g, bl] = tempRGB(s[4 * i + 3]);
      col.set([r * b, g * b, bl * b], 3 * i);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
  });
  return pts;
}
