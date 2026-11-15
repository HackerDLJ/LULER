import math

import numpy as np

from engine.horizon import R_MOON_M, horizon_profile
from engine.metrics import disc_fraction, longest_run

PX = 100.0
N = 3001
CX = CY = (N - 1) / 2.0
H, D0, W = 500.0, 20000.0, 1500.0   # ring ridge: height, distance from pole, width


def ridge_height(d):
    return H * np.exp(-(((d - D0) / W) ** 2))


def make_dem():
    cols, rows = np.meshgrid(np.arange(N), np.arange(N))
    x = (cols - CX) * PX
    y = (CY - rows) * PX
    rho = np.hypot(x, y)
    colat = 2.0 * np.arctan(rho / (2.0 * R_MOON_M))
    return ridge_height(R_MOON_M * colat).astype(np.float32)


def expected_horizon(mast):
    d = np.linspace(100.0, 60000.0, 600000)
    delta = d / R_MOON_M
    r_t = R_MOON_M + ridge_height(d)
    th = np.arctan2(r_t * np.cos(delta) - (R_MOON_M + mast), r_t * np.sin(delta))
    return math.degrees(th.max())


def test_ring_ridge_seen_from_pole():
    dem = make_dem()
    hz, edge = horizon_profile(dem, PX, CX, CY, 1.0, 0.0, -90.0, 0.0, 2.0, 360, PX, 50000.0)
    assert not edge.any()
    assert abs(hz.mean() - expected_horizon(2.0)) < 0.01
    assert hz.std() < 0.01          # ring is rotationally symmetric


def test_mast_height_lowers_horizon():
    dem = make_dem()
    lo, _ = horizon_profile(dem, PX, CX, CY, 1.0, 0.0, -90.0, 0.0, 0.0, 36, PX, 50000.0)
    hi, _ = horizon_profile(dem, PX, CX, CY, 1.0, 0.0, -90.0, 0.0, 20.0, 36, PX, 50000.0)
    assert (hi < lo).all()


def test_edge_flag_when_range_exceeds_dem():
    dem = make_dem()
    _, edge = horizon_profile(dem, PX, CX, CY, 1.0, 0.0, -90.0, 0.0, 2.0, 36, PX, 400000.0)
    assert edge.all()


def test_disc_fraction_known_values():
    assert abs(float(disc_fraction(0.0, 0.0, 0.27)) - 0.5) < 1e-9
    assert float(disc_fraction(1.0, 0.0, 0.27)) == 1.0
    assert float(disc_fraction(-1.0, 0.0, 0.27)) == 0.0


def test_longest_run():
    assert longest_run([0, 1, 1, 0, 1, 1, 1, 0], 2.0) == 6.0
