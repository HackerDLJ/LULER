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

## 5. Sun AND Earth vs JPL Horizons, two sites, four dates (2026-11-15)
Horizons API, observer = coord@301 (geodetic), QUANTITIES=4 (apparent az/el, airless), compared with the
values shipped in web/public/data/<site>.sky.json (az stored at 0.01 deg resolution).
Connecting ridge (-89.4632, -137.49 E, 1943 m):
  Earth 2027-01-21 00:00  Horizons 135.921280 /  3.842962   LULER 135.92 /  3.8433
  Earth 2027-01-28 12:00  Horizons 144.795637 / -6.966813   LULER 144.80 / -6.9665
  Earth 2027-02-03 23:00  Horizons 138.177815 / -4.608282   LULER 138.18 / -4.6080
  Earth 2027-06-15 06:00  Horizons 143.253893 / -7.351062   LULER 143.25 / -7.3508
  Sun   (same times)      Horizons 157.238639/0.062005, 66.241252/0.524549, 347.618324/0.691340, 186.579903/-1.726107
                          LULER    157.24/0.0620, 66.24/0.5245, 347.62/0.6913, 186.58/-1.7261
Apollo 11 (0.67416, 23.47314 E, -1926 m):
  Earth Horizons 258.078079/64.302298, 289.539674/72.882598, 278.589304/66.930110, 289.196872/71.301407
        LULER    258.08/64.3022,    289.54/72.8825,    278.59/66.9300,    289.20/71.3013
  Sun   Horizons 251.712350/86.076034, 269.745754/-4.729388, 274.321999/-83.324993, 88.648516/64.382824
        LULER    251.71/86.0760,    269.75/-4.7294,    274.32/-83.3250,    88.65/64.3828
Result: elevation differences <= 0.0004 deg for the Earth and <= 0.0001 deg for the Sun; azimuths agree to the
0.01 deg storage resolution. Earth motion (libration) is as accurate as the Sun's. No correction needed.

## Open items
- Region-centre coordinates are provisional (from NASA's 2025 Lunar Surface Data Book as quoted by a public repo).
- "Shackleton rim" centre: 0% Earth, 9% sunlit, horizon mean 12 deg: on an inner slope. Check against official site list.
- Compare annual illumination with a published NASA/LOLA illumination product.
