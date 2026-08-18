#!/usr/bin/env python3
"""
QuantumCall bridge v2 — tests des cœurs purs (stdlib unittest, zéro dép).

Ce que ces tests VERROUILLENT (vérifiable sans Gateway ni Supabase) :
  - la signature du bridge == positionSignature du client, bit pour bit
    (piège strike 500.0 → "500") : sans ça, le pic n'est pas partagé ;
  - le calendrier de séance : rth / pre / post / closed + cadences ;
  - l'assemblage des lignes de compte, dont SettledCash ;
  - la dérivation du mid depuis reqPnLSingle.value.

Lancer :  python -m unittest discover -s bridge/v2/tests -v
"""

import os
import sys
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from signature import js_number_str, position_signature, signature_from_contract  # noqa: E402
from session import market_phase, cadence_seconds, is_collecting  # noqa: E402
from collect import build_account_rows  # noqa: E402
from marks import derive_mid  # noqa: E402


def _av(value, currency="USD"):
    """Faux ib_async AccountValue (attributs .value / .currency)."""
    return SimpleNamespace(value=str(value), currency=currency)


def _contract(sec_type, symbol, right="", strike="", expiry=""):
    return SimpleNamespace(
        secType=sec_type, symbol=symbol, right=right,
        strike=strike, lastTradeDateOrContractMonth=expiry, currency="USD",
    )


class TestSignature(unittest.TestCase):
    def test_js_number_str_drops_trailing_zero(self):
        # Le cœur du piège : String(500.0) JS == "500", pas "500.0".
        self.assertEqual(js_number_str(500.0), "500")
        self.assertEqual(js_number_str(500), "500")
        self.assertEqual(js_number_str("500"), "500")
        self.assertEqual(js_number_str(12.5), "12.5")
        self.assertEqual(js_number_str(7.25), "7.25")
        self.assertEqual(js_number_str(""), "")
        self.assertEqual(js_number_str(None), "")

    def test_position_signature_shape(self):
        # ty/st/ex vides → pipes traînants, comme `${..}|${''}|${''}|${''}`.
        self.assertEqual(
            position_signature("AAPL", "Action", "Long"), "AAPL|Action|Long|||"
        )
        self.assertEqual(
            position_signature("NVDA", "Option", "Long", "CALL", "500", "2026-01-16"),
            "NVDA|Option|Long|CALL|500|2026-01-16",
        )

    def test_parity_option_contract(self):
        # Contrat IBKR (strike float 500.0, expiry '20260116') → signature store.
        c = _contract("OPT", "NVDA", right="C", strike=500.0, expiry="20260116")
        self.assertEqual(
            signature_from_contract(c, position_qty=1),
            "NVDA|Option|Long|CALL|500|2026-01-16",
        )

    def test_parity_short_put_and_stock(self):
        put = _contract("OPT", "SPY", right="P", strike=12.5, expiry="2026-03-20")
        self.assertEqual(
            signature_from_contract(put, position_qty=-2),
            "SPY|Option|Short|PUT|12.5|2026-03-20",
        )
        stk = _contract("STK", "AAPL")
        self.assertEqual(signature_from_contract(stk, position_qty=10), "AAPL|Action|Long|||")


class TestSession(unittest.TestCase):
    # 2026-08-19 = mercredi (EDT, UTC-4), hors férié.
    HOL = {"2026-09-07"}  # Labor Day

    def _utc(self, y, mo, d, h, mi=0):
        return datetime(y, mo, d, h, mi, tzinfo=timezone.utc)

    def test_rth(self):
        # 14:00 UTC = 10:00 EDT → séance régulière.
        self.assertEqual(market_phase(self._utc(2026, 8, 19, 14), self.HOL), "rth")

    def test_pre_and_post(self):
        # 08:00 UTC = 04:00 EDT → pré ; 23:00 UTC = 19:00 EDT → post.
        self.assertEqual(market_phase(self._utc(2026, 8, 19, 8), self.HOL), "pre")
        self.assertEqual(market_phase(self._utc(2026, 8, 19, 23), self.HOL), "post")

    def test_closed_weekend_and_holiday(self):
        # 2026-08-22 = samedi.
        self.assertEqual(market_phase(self._utc(2026, 8, 22, 14), self.HOL), "closed")
        # Labor Day (lundi férié) 15:00 UTC = 11:00 EDT → fermé malgré l'heure.
        self.assertEqual(market_phase(self._utc(2026, 9, 7, 15), self.HOL), "closed")

    def test_cadence_and_collecting(self):
        self.assertEqual(cadence_seconds("rth"), 20)
        self.assertEqual(cadence_seconds("pre"), 90)
        self.assertEqual(cadence_seconds("post"), 90)
        self.assertEqual(cadence_seconds("closed"), 300)
        self.assertTrue(is_collecting("rth"))
        self.assertFalse(is_collecting("closed"))


class TestCollect(unittest.TestCase):
    def test_build_account_rows_includes_settled(self):
        summary = {
            "NetLiquidation": _av(10.01, "CHF"),
            "TotalCashValue": _av(10.01, "CHF"),
            "SettledCash": _av(9.50, "CHF"),
            "BuyingPower": _av(10.01, "CHF"),
            "MaintMarginReq": _av(0.0, "CHF"),
            "ExcessLiquidity": _av(10.01, "CHF"),
            "Cushion": _av(1.0, ""),  # ratio, sans devise
        }
        nlv, state = build_account_rows(summary, "2026-08-18T00:00:00+00:00")
        self.assertEqual(nlv["nlv"], 10.01)
        self.assertEqual(nlv["settled_cash"], 9.50)
        self.assertEqual(nlv["currency"], "CHF")
        self.assertEqual(state["cushion"], 1.0)
        self.assertEqual(state["maint_margin"], 0.0)
        self.assertEqual(state["currency"], "CHF")

    def test_missing_tag_is_none_not_zero(self):
        nlv, state = build_account_rows({"NetLiquidation": _av(100, "USD")}, "t")
        self.assertEqual(nlv["nlv"], 100.0)
        self.assertIsNone(nlv["settled_cash"])   # absent → None, jamais un faux 0
        self.assertIsNone(state["cushion"])


class TestMarks(unittest.TestCase):
    def test_derive_mid(self):
        self.assertAlmostEqual(derive_mid(640.0, 1, 100), 6.4)     # option : value/(qty×100)
        self.assertAlmostEqual(derive_mid(-1280.0, -2, 100), 6.4)  # short → abs des deux côtés
        self.assertAlmostEqual(derive_mid(150.0, 10, 1), 15.0)     # action : mult 1

    def test_derive_mid_degenerate(self):
        self.assertIsNone(derive_mid(100, 0, 100))     # qty 0
        self.assertIsNone(derive_mid(None, 1, 100))    # value absente
        self.assertIsNone(derive_mid("x", 1, 100))     # non numérique


if __name__ == "__main__":
    unittest.main(verbosity=2)
