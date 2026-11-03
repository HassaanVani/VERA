"""Recompute control scores independently. Written interpretations remain ungraded."""
import importlib.util
import json
import re
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("audit_ocw", Path(__file__).with_name("audit-ocw.py"))
arithmetic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(arithmetic)


def audit(folder):
    root = Path(folder)
    report = json.loads((root / "report.json").read_text(encoding="utf-8"))
    frozen = json.loads(Path(".vera/evaluations/ocw-cross-subject/frozen.json").read_text(encoding="utf-8"))
    rows = []
    for course in report["reports"]:
        for case, result in zip(course["cases"], course["rows"]):
            question, response = case["question"], case["response"]
            grade = None
            key_valid = None
            if question["type"] == "numeric":
                claim = next(c for c in question["claims"] if c["kind"] == "calculation")
                expected = arithmetic.numeric(claim["expression"])
                key_valid = expected == arithmetic.numeric(str(question["numeric"]["value"]))
                value = response.strip().replace(" dollars", " USD")
                unit = question["numeric"]["unit"]
                grade = False
                if not unit or value.lower().endswith(" " + unit.lower()):
                    expression = value[:-(len(unit) + 1)] if unit else value
                    if re.fullmatch(r"[0-9.eE+*/()^\s-]+", expression):
                        try:
                            grade = arithmetic.numeric(expression) == expected
                        except (ValueError, SyntaxError, ZeroDivisionError):
                            grade = False
            elif question["type"] == "multiple-choice":
                # This controlled item asks which literal word occurs on the slide.
                # Its reference check is source presence, not a claim of semantic expertise.
                packet = next(p["packet"] for p in frozen["packets"] if p["course"] == course["course"] and p["phase"] == "development")
                ref = question["evidence"][0]
                document = next(d for d in packet["documents"] if d["id"] == ref["documentId"])
                page = next(p for p in document["pages"] if p["number"] == ref["page"])
                matching = [i for i, option in enumerate(question["options"]) if re.search(r"\b" + re.escape(option) + r"\b", page["text"], re.IGNORECASE)]
                if len(matching) != 1:
                    raise ValueError("Literal source-word control lacks a unique source-backed answer")
                correct_option = matching[0]
                key_valid = question["answer"] == chr(65 + correct_option)
                grade = response == chr(65 + correct_option)
            rows.append({"course": course["course"], "question": question["number"], "category": case["category"], "independentAutomaticGrade": grade, "matchesApplication": grade == result["actualAutomatic"], "keyValid": key_valid, "writtenInterpretationVerified": False})
    summary = {"cases": len(rows), "scoringBoundariesPassed": sum(r["matchesApplication"] for r in rows), "objectiveKeysChecked": sum(r["keyValid"] is not None for r in rows), "objectiveKeysPassed": sum(r["keyValid"] is True for r in rows), "rows": rows, "limitation": "Independent arithmetic and a literal source-word control; not expert validation of prose correctness, conceptual feedback or learning outcomes."}
    with (root / "independent-source-audit.json").open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(summary, stream, indent=2)
        stream.write("\n")
    return summary


if __name__ == "__main__":
    result = audit(sys.argv[1])
    print(json.dumps({k: v for k, v in result.items() if k != "rows"}, indent=2))
