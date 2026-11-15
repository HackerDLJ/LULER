# Validation log (working notes, all numbers from real runs)

## 1. Sun position: our SPICE calculation vs JPL Horizons
Site: -89.7668 lat, -171.87 E lon, height 0 m. Times: 2026-11-15 00:00-06:00 UTC, hourly (7 points).
Horizons settings: observer table, CENTER='coord@301', apparent az/el, airless.
Result: |difference| in azimuth and elevation <= 0.00001 deg at all 7 points
(example 00:00 UTC: Horizons 286.29510 / 1.62180, SPICE 286.29509 / 1.62180).
Method: SPICE spkpos, frame MOON_ME, LT+S, kernels naif0012.tls, pck00011.tpc, moon_de440_250416.tf,
moon_pa_de440_200625.bpc, de440s.bsp. (Horizons uses DE441; we use DE440s.)
TODO: widen to all sites x several dates x Earth (script to run on the Mac).

## 2. Terrain map orientation (LOLA LDEM_80S_80M, south polar stereographic)
Label: pole at pixel 3799.5 (line and sample), 80 m/px, true scale at pole, frame "Mean Earth/Polar Axis of DE421".
Tested 8 orientations; (lon_sign=+1, lon_rot=0) is the only one where Malapert (+4791 m) and
Nobile rim 1 (+5942 m) are both high. Deepest points found near known craters:
Faustini -3365 m at (-87.242, 76.70E) vs crater (-87.3, 77.0E); Haworth -4021 m at (-87.493, -12.30E);
Shoemaker -4246 m at (-88.460, 58.09E); Shackleton -2842 m at (-89.734, 122.04E).
Caveat: terrain frame is DE421-based, ephemeris frame is DE440-based; expected offset is small but not yet quantified.

## 3. Horizon engine unit tests (synthetic ring ridge, exact analytic answer)
5 tests pass: horizon angle within 0.01 deg of analytic value, rotational symmetry, mast height lowers horizon,
edge-of-map flag, Sun disc visible-fraction formula.

## 4. Position sensitivity (real DEM, 20 m, 1 year, 2 m mast) -- supports the uncertainty feature
Peak near Shackleton (-88.8110, 123.6901E; site is 4 m below local max within 1 km):
sunlit 64.6% at the region centre; 49.9-83.0% for shifts of 100 m; 46.5-76.1% for shifts of 200 m.
Earth visibility unchanged (43.8%).

## Open items
- Region-centre coordinates are provisional (from NASA's 2025 Lunar Surface Data Book as quoted by a public repo).
- "Shackleton rim" centre: 0% Earth, 9% sunlit, horizon mean 12 deg: on an inner slope. Check against official site list.
- Compare annual illumination with a published NASA/LOLA illumination product.
