from decimal import Decimal

from app.services.pricing_service import price_for_tier, tier_for_sold

BASE, CAP = Decimal("100"), 100


def price(sold, cap=CAP, base=BASE, inc=25, step=20):
    return price_for_tier(base, inc, tier_for_sold(sold, cap, step))


def test_spec_table():
    # Straight from the Eventra spec
    expected = {0: "100.00", 19: "100.00", 20: "125.00", 39: "125.00", 40: "156.25",
                59: "156.25", 60: "195.31", 79: "195.31", 80: "244.14", 99: "244.14"}
    for sold, want in expected.items():
        assert price(sold) == Decimal(want), sold


def test_boundaries_are_exact():
    assert tier_for_sold(19, 100, 20) == 0
    assert tier_for_sold(20, 100, 20) == 1
    assert tier_for_sold(39, 100, 20) == 1
    assert tier_for_sold(40, 100, 20) == 2


def test_capacity_not_multiple_of_five():
    # capacity 30 -> a tier every 6 tickets
    assert tier_for_sold(5, 30, 20) == 0
    assert tier_for_sold(6, 30, 20) == 1
    # capacity 7 -> step of 1.4 tickets: 2 tickets is below 2.8 (tier 1), 3 tickets reaches tier 2
    assert tier_for_sold(1, 7, 20) == 0
    assert tier_for_sold(2, 7, 20) == 1
    assert tier_for_sold(3, 7, 20) == 2


def test_free_and_rounding():
    assert price(50, base=Decimal("0")) == Decimal("0.00")
    assert price_for_tier(Decimal("33.33"), 25, 1) == Decimal("41.66")  # 41.6625 -> half-up
