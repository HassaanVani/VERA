"""Independent Fraction/AST checks; never equate a numeric claim with a whole exam grade."""
import ast
import json
import sys
import unicodedata
from fractions import Fraction
from pathlib import Path


def polynomial(expression):
    if len(expression) > 300:
        raise ValueError("Expression too long")
    tree = ast.parse(expression.replace("^", "**").replace("−", "-"), mode="eval")
    if sum(1 for _ in ast.walk(tree)) > 200:
        raise ValueError("Expression too complex")

    def add(a, b, sign=1):
        result = dict(a)
        for power, value in b.items():
            result[power] = result.get(power, 0) + sign * value
        return {p: v for p, v in result.items() if v}

    def multiply(a, b):
        result = {}
        for p, v in a.items():
            for q, w in b.items():
                if p + q > 6:
                    raise ValueError("Degree exceeds six")
                result[p + q] = result.get(p + q, 0) + v * w
        return {p: v for p, v in result.items() if v}

    def visit(node):
        if isinstance(node, ast.Expression):
            return visit(node.body)
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            value = Fraction(str(node.value))
            if abs(value) > 10**15:
                raise ValueError("Value out of bounds")
            return {0: value} if value else {}
        if isinstance(node, ast.Name) and node.id == "x":
            return {1: Fraction(1)}
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            return {p: (-v if isinstance(node.op, ast.USub) else v) for p, v in visit(node.operand).items()}
        if isinstance(node, ast.BinOp):
            left, right = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Add):
                return add(left, right)
            if isinstance(node.op, ast.Sub):
                return add(left, right, -1)
            if isinstance(node.op, ast.Mult):
                return multiply(left, right)
            if isinstance(node.op, ast.Div) and set(right) == {0}:
                return {p: v / right[0] for p, v in left.items()}
            if isinstance(node.op, ast.Pow) and set(right).issubset({0}):
                exponent = right.get(0, Fraction(0))
                if exponent.denominator != 1 or not 0 <= exponent <= 6:
                    raise ValueError("Unsupported power")
                result = {0: Fraction(1)}
                for _ in range(int(exponent)):
                    result = multiply(result, left)
                return result
        raise ValueError("Unsupported notation")
    return visit(tree)


def numeric(expression):
    result = polynomial(expression)
    if not set(result).issubset({0}):
        raise ValueError("Numeric expression has variables")
    return result.get(0, Fraction(0))


def normalize(s):
    return " ".join(unicodedata.normalize("NFKC", s).split())


def audit(directory):
    folder = Path(directory)
    report = json.loads((folder / "report.json").read_text(encoding="utf-8"))
    rows = []
    for run in report["runs"]:
        artifact = run.get("artifact")
        row = {"course": run["course"], "candidate": run["candidate"], "repeat": run["repeat"], "generated": bool(artifact), "claims": [], "openReasoningVerified": False}
        if artifact:
            for question in artifact["exam"]["questions"]:
                for index, claim in enumerate(question.get("claims", [])):
                    if claim["kind"] not in ("calculation", "expression"):
                        continue
                    result = {"question": question["number"], "claim": index, "kind": claim["kind"]}
                    try:
                        if claim["kind"] == "calculation":
                            computed = numeric(claim["expression"])
                            proposed = Fraction(str(claim["answer"]))
                            result.update(computed=str(computed), passed=abs(computed - proposed) <= max(Fraction("1e-8"), abs(proposed) * Fraction("1e-8")))
                        else:
                            left, right = polynomial(claim["left"]), polynomial(claim["right"])
                            result.update(passed=left == right, exact=True)
                    except (ValueError, SyntaxError, ZeroDivisionError, OverflowError) as error:
                        result.update(unsupported=str(error), passed=None)
                    row["claims"].append(result)
        rows.append(row)
    checked = [claim for row in rows for claim in row["claims"] if claim["passed"] is not None]
    summary = {"method": "Independent Python AST and exact Fraction arithmetic", "rows": rows, "checkedClaims": len(checked), "passedClaims": sum(c["passed"] for c in checked), "failedClaims": sum(not c["passed"] for c in checked), "unsupportedClaims": sum(c["passed"] is None for row in rows for c in row["claims"]), "limitation": "Checks structured mathematical claims, not their relevance, prose reasoning, difficulty, factual entailment or essay quality."}
    destination = folder / "independent-audit.json"
    with destination.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(summary, stream, indent=2)
        stream.write("\n")
    return summary


if __name__ == "__main__":
    result = audit(sys.argv[1])
    print(json.dumps({k: v for k, v in result.items() if k != "rows"}, indent=2))
