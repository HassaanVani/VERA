import importlib.util
import unittest
from fractions import Fraction
from pathlib import Path

spec = importlib.util.spec_from_file_location("verify_mit", Path(__file__).resolve().parents[1] / "scripts" / "verify-mit.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class ExactAuditTests(unittest.TestCase):
    def test_determinants_with_pivots_and_singular_matrices(self):
        self.assertEqual(audit.determinant([[0, 2], [3, 4]]), -6)
        self.assertEqual(audit.determinant([[1, 2, 3], [0, 4, 5], [0, 0, 6]]), 24)
        self.assertEqual(audit.determinant([[1, 2], [2, 4]]), 0)

    def test_fractional_matrix_and_rank(self):
        self.assertEqual(audit.determinant([["1/2", 0], [0, "2/3"]]), Fraction(1, 3))
        self.assertEqual(audit.rank([[1, -1, 0], [1, 1, -2]]), 2)

    def test_eigenpairs_require_nonzero_vectors_and_correct_dimension(self):
        self.assertTrue(audit.eigenpair([[3, 1], [1, 3]], [1, 1], 4))
        self.assertFalse(audit.eigenpair([[3, 1], [1, 3]], [0, 0], 4))
        self.assertFalse(audit.eigenpair([[3, 1], [1, 3]], [1, 1, 5], 4))

    def test_arithmetic_expression_evaluation_excludes_code(self):
        self.assertEqual(audit.polynomial_value("1-n", 4), -3)
        with self.assertRaises(ValueError):
            audit.polynomial_value("__import__('os').getcwd()", 4)

    def test_actual_quiz_family_determinant(self):
        for n in range(1, 9):
            matrix = [[0 if i == j else -1 for j in range(n)] for i in range(n)]
            self.assertEqual(audit.determinant(matrix), 1 - n)


if __name__ == "__main__":
    unittest.main()
