import importlib.util
import unittest
from pathlib import Path
from fractions import Fraction

spec = importlib.util.spec_from_file_location("audit_ocw", Path(__file__).resolve().parents[1] / "scripts" / "audit-ocw.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class IndependentArithmetic(unittest.TestCase):
    def test_fractions_and_precedence(self):
        self.assertEqual(audit.numeric("-2^2+1/3"), Fraction(-11, 3))

    def test_polynomial_identity(self):
        self.assertEqual(audit.polynomial("(x+1)^2"), audit.polynomial("x^2+2*x+1"))

    def test_wrong_intermediate_step(self):
        self.assertNotEqual(audit.polynomial("2*x+3*x"), audit.polynomial("6*x"))

    def test_rejects_code_and_out_of_scope_expressions(self):
        for expression in ("__import__('os')", "x/(x+1)", "x^7", "1/0"):
            with self.assertRaises((ValueError, ZeroDivisionError)):
                audit.polynomial(expression)


if __name__ == "__main__":
    unittest.main()
