"""Independent arithmetic audit; uses Python fractions, not VERA's TS validators.

No symbolic natural-language proof is automatically marked correct. No numeric
check count is presented as a grade on the MIT exam.
"""
import ast
import json
import sys
from fractions import Fraction as F
from pathlib import Path


def matrix(rows):
    return [[F(str(value)) for value in row] for row in rows]


def determinant(rows):
    work = matrix(rows)
    result = F(1)
    for col in range(len(work)):
        pivot = next((row for row in range(col, len(work)) if work[row][col]), None)
        if pivot is None:
            return F(0)
        if pivot != col:
            work[pivot], work[col] = work[col], work[pivot]
            result = -result
        value = work[col][col]
        result *= value
        for row in range(col + 1, len(work)):
            factor = work[row][col] / value
            for entry in range(col + 1, len(work)):
                work[row][entry] -= factor * work[col][entry]
    return result


def rank(rows):
    work = matrix(rows)
    if not work:
        return 0
    pivot_row = 0
    for col in range(len(work[0])):
        pivot = next((row for row in range(pivot_row, len(work)) if work[row][col]), None)
        if pivot is None:
            continue
        work[pivot_row], work[pivot] = work[pivot], work[pivot_row]
        divisor = work[pivot_row][col]
        work[pivot_row] = [v / divisor for v in work[pivot_row]]
        for row in range(pivot_row + 1, len(work)):
            factor = work[row][col]
            work[row] = [a - factor * b for a, b in zip(work[row], work[pivot_row])]
        pivot_row += 1
        if pivot_row == len(work):
            break
    return pivot_row


def apply(rows, vector):
    return [sum((F(str(a)) * F(str(b)) for a, b in zip(row, vector)), F(0)) for row in rows]


def close(a, b):
    a, b = F(str(a)), F(str(b))
    return abs(a - b) <= F(1, 100_000_000) * max(F(1), abs(a), abs(b))


def eigenpair(rows, vector, value):
    return len(vector) == len(rows) and any(F(str(v)) for v in vector) and all(close(actual, F(str(value)) * F(str(v))) for actual, v in zip(apply(rows, vector), vector))


def polynomial_value(expression, n):
    """Evaluate only a tiny arithmetic AST; never evaluate model-produced code."""
    def visit(node):
        if isinstance(node, ast.Expression):
            return visit(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, int):
            return F(node.value)
        if isinstance(node, ast.Name) and node.id == "n":
            return F(n)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            return -visit(node.operand) if isinstance(node.op, ast.USub) else visit(node.operand)
        if isinstance(node, ast.BinOp):
            left, right = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return left / right
            if isinstance(node.op, ast.Pow) and right.denominator == 1 and abs(right) <= 20:
                return left ** int(right)
        raise ValueError("Unsupported arithmetic expression")
    return visit(ast.parse(expression, mode="eval"))


def verify_generation(report):
    audit_file = Path(__file__).resolve().parents[1] / "fixtures" / "mit-ocw" / "source-matrix-audit.json"
    known_matrices = json.loads(audit_file.read_text(encoding="utf-8"))["matrices"]
    results = []
    for attempt in report["attempts"]:
        artifact = attempt.get("artifact")
        row = {"repeat": attempt["repeat"], "candidate": attempt["candidate"], "generated": bool(artifact), "scenarioChecks": [], "claims": []}
        if artifact:
            scenario = artifact["scenario"]
            a = scenario["matrix"]
            row["matrix"] = a
            row["postHocSourceMatrixMatches"] = [{"source": known["source"], "page": known["page"]} for known in known_matrices if matrix(a) == matrix(known["matrix"])]
            row["postHocAnswerHintLabels"] = [vector["label"] for vector in scenario["vectors"] if "eigen" in vector["label"].lower() or "invariant" in vector["label"].lower()]
            row["determinant"] = str(determinant(a))
            for index, pair in enumerate(scenario["eigenpairs"]):
                row["scenarioChecks"].append({"eigenpair": index + 1, "passed": eigenpair(a, pair["vector"], pair["value"])})
            for question in artifact["exam"]["questions"]:
                for index, claim in enumerate(question["claims"]):
                    kind = claim["kind"]
                    if kind == "determinant":
                        passed = close(determinant(a), claim["answer"])
                    elif kind == "trace":
                        passed = close(sum(F(str(a[i][i])) for i in range(len(a))), claim["answer"])
                    elif kind == "image":
                        passed = all(close(x, y) for x, y in zip(apply(a, claim["input"]), claim["answer"]))
                    elif kind == "eigenpair":
                        passed = eigenpair(a, claim["vector"], claim["value"])
                    else:
                        passed = False
                    row["claims"].append({"question": question["number"], "claim": index + 1, "kind": kind, "passed": bool(passed)})
        results.append(row)
    return results


def verify_heldout(solve):
    if not solve.get("result"):
        return {"status": "no_output", "error": solve.get("error"), "checks": []}
    numeric = solve["result"]["numeric"]
    a = [2, 1, 3]
    expected_projection = [[F(x * y, 14) for y in a] for x in a]
    checks = []

    def check(name, fn):
        try:
            checks.append({"name": name, "passed": bool(fn())})
        except (ValueError, KeyError, IndexError, TypeError, ZeroDivisionError, SyntaxError) as error:
            checks.append({"name": name, "passed": False, "error": str(error)})

    check("1a: exact orthogonal projection matrix", lambda: matrix(numeric["projectionMatrix"]) == expected_projection)
    check("1b: column-space basis", lambda: len(numeric["columnBasis"]) == 1 and len(numeric["columnBasis"][0]) == 3 and rank(numeric["columnBasis"]) == 1 and all(F(str(v)) == 0 for v in apply([[1, -2, 0], [3, 0, -2]], numeric["columnBasis"][0])))
    check("1b: two independent nullspace basis vectors", lambda: len(numeric["nullBasis"]) == 2 and all(len(v) == 3 for v in numeric["nullBasis"]) and rank(numeric["nullBasis"]) == 2 and all(apply([a], v) == [0] for v in numeric["nullBasis"]))
    check("1c: eigenvalues with multiplicities", lambda: sorted(F(v) for v in numeric["projectionEigenvalues"]) == [0, 0, 1])
    check("1c: trace", lambda: F(numeric["projectionTrace"]) == 1)
    check("3a: determinant identity at n=1 through 8 (finite spot checks, not proof)", lambda: all(polynomial_value(numeric["detAnExpression"], n) == determinant([[0 if i == j else -1 for j in range(n)] for i in range(n)]) for n in range(1, 9)))
    check("3b: inverse A4 first entry", lambda: F(numeric["inverseA4FirstEntry"]) == F(2, 3))
    family = [[0 if i == j else -1 for j in range(3)] for i in range(3)]
    vectors = numeric["eigenvalueOneVectorsA3"]
    check("3c: two independent orthogonal eigenvectors for eigenvalue 1", lambda: len(vectors) == 2 and rank(vectors) == 2 and all(eigenpair(family, v, 1) for v in vectors) and sum(F(x) * F(y) for x, y in zip(vectors[0], vectors[1])) == 0)
    check("3d: remaining eigenvalue/eigenvector", lambda: F(numeric["otherEigenvalueA3"]) == -2 and eigenpair(family, numeric["otherEigenvectorA3"], -2))
    return {"status": "numeric_checks_only", "checks": checks, "passed": sum(item["passed"] for item in checks), "total": len(checks), "notAnExamGrade": True, "ungraded": "Symbolic least-squares/QR formulas, completeness of proofs, explanations, and rubric-based partial credit require reference review."}


def main():
    batch = Path(sys.argv[1]).resolve()
    report = json.loads((batch / "report.json").read_text(encoding="utf-8"))
    results = {"method": "Independent Python Fraction Gaussian elimination and eigenpair residuals", "generation": verify_generation(report)}
    if (batch / "heldout-solve.json").exists():
        results["heldout"] = verify_heldout(json.loads((batch / "heldout-solve.json").read_text(encoding="utf-8")))
    (batch / "independent-arithmetic.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"generationClaims": sum(len(row["claims"]) for row in results["generation"]), "failedGenerationClaims": sum(not claim["passed"] for row in results["generation"] for claim in row["claims"]), "heldout": results.get("heldout")}))


if __name__ == "__main__":
    main()
