"""Curated landing sites (public mission records; planetocentric latitude, east longitude, degrees).
Coordinates are the published landing-site values and are APPROXIMATE for recent missions: verify each against the
mission's NASA/agency page (and LROC/NSSDCA) before the final submission. `accuracy` records how well known each is."""
CATALOG = [
    # id, name, lat, lon, group, mission, year, accuracy
    ("apollo-11", "Apollo 11", 0.67416, 23.47314, "Apollo", "Apollo 11 (Tranquility Base)", 1969, "LRO-refined"),
    ("apollo-12", "Apollo 12", -3.01239, -23.42157, "Apollo", "Apollo 12 (Ocean of Storms)", 1969, "LRO-refined"),
    ("apollo-14", "Apollo 14", -3.64530, -17.47136, "Apollo", "Apollo 14 (Fra Mauro)", 1971, "LRO-refined"),
    ("apollo-15", "Apollo 15", 26.13239, 3.63386, "Apollo", "Apollo 15 (Hadley-Apennine)", 1971, "LRO-refined"),
    ("apollo-16", "Apollo 16", -8.97301, 15.50019, "Apollo", "Apollo 16 (Descartes)", 1972, "LRO-refined"),
    ("apollo-17", "Apollo 17", 20.19080, 30.77168, "Apollo", "Apollo 17 (Taurus-Littrow)", 1972, "LRO-refined"),
    ("im-1-odysseus", "IM-1 Odysseus", -80.1304, 1.4381, "CLPS / commercial", "Intuitive Machines IM-1", 2024, "approx"),
    ("im-2-athena", "IM-2 Athena", -84.80, 29.20, "CLPS / commercial", "Intuitive Machines IM-2", 2025, "approx"),
    ("blue-ghost-1", "Blue Ghost M1", 18.56, 61.81, "CLPS / commercial", "Firefly Blue Ghost Mission 1", 2025, "approx"),
    ("chandrayaan-3", "Chandrayaan-3 Shiv Shakti", -69.3733, 32.3189, "Other agencies", "ISRO Chandrayaan-3", 2023, "approx"),
    ("slim", "SLIM", -13.3157, 25.2523, "Other agencies", "JAXA SLIM", 2024, "approx"),
    ("change-3", "Chang'e-3", 44.1214, -19.5116, "Other agencies", "CNSA Chang'e-3", 2013, "approx"),
    ("change-4", "Chang'e-4", -45.4561, 177.5991, "Other agencies", "CNSA Chang'e-4 (far side)", 2019, "approx"),
    ("change-5", "Chang'e-5", 43.0576, -51.9161, "Other agencies", "CNSA Chang'e-5", 2020, "approx"),
    ("change-6", "Chang'e-6", -41.6385, -153.9852, "Other agencies", "CNSA Chang'e-6 (far side)", 2024, "approx"),
    # Upcoming CLPS targets named on NASA's CLPS deliveries page (region centres, approximate)
    ("reiner-gamma", "Reiner Gamma (CP-11)", 7.5, -59.0, "CLPS / commercial", "CLPS CP-11, Intuitive Machines (planned)", None, "region, approx"),
    ("gruithuisen-domes", "Gruithuisen Domes (CP-21)", 36.6, -39.5, "CLPS / commercial", "CLPS CP-21, Firefly Blue Ghost 3 (planned)", None, "region, approx"),
    ("schrodinger-basin", "Schrodinger Basin (CS-11)", -75.0, 132.4, "CLPS / commercial", "CLPS CS-11 (planned)", None, "region, approx"),
]
