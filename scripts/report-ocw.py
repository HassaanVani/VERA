"""Publish metadata and denominators, never raw OCW or student response packets."""
import argparse
import hashlib
import json
import sqlite3
import statistics
from pathlib import Path


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def summary(development, final, feedback, reference, database):
    ledger = sqlite3.connect(database)
    usage = ledger.execute("select job_id,coalesce(cost,reserved),status from usage").fetchall()
    candidate = read("fixtures/ocw-cross-subject/candidate.json")
    cohorts = []
    courses = ["linear-algebra", "microeconomics", "psychology", "history"]
    for folder in (development, final):
        report = read(folder / "report.json")
        audit = read(folder / "independent-audit.json")
        owned_jobs = set()
        records = []
        for run in report["runs"]:
            if run["candidate"] == "direct-meta":
                owned_jobs.add(f"{report['batch']}:{run['course']}:{run['repeat']-1}:direct")
            else:
                owned_jobs.update(a["jobId"] for a in run.get("repairHistory", []))
            artifact = run.get("artifact", {})
            records.append({"course": run["course"], "candidate": run["candidate"], "repeat": run["repeat"], "latencyMs": run["latencyMs"], "accountedCost": run["cost"], "softwareChecksPassed": bool(artifact.get("ready")) and not run.get("error"), "error": run.get("error"), "repairAttempts": artifact.get("repairAttempts"), "issueCodes": [i["code"] for i in artifact.get("issues", [])], "metrics": run.get("metrics")})
        owned_jobs.update(f"{report['batch']}:{course}:alignment" for course in courses)
        own_usage = [r for r in usage if r[0] in owned_jobs]
        aggregates = []
        for name in ("direct-meta", "vera"):
            selected = [r for r in records if r["candidate"] == name]
            aggregates.append({"candidate": name, "attempts": len(selected), "softwareChecksPassed": sum(r["softwareChecksPassed"] for r in selected), "meanLatencyMsFailuresIncluded": statistics.mean(r["latencyMs"] for r in selected), "accountedGenerationCost": sum(r["accountedCost"] for r in selected)})
        cohorts.append({"batch": report["batch"], "phase": report["phase"], "attempts": len(records), "aggregates": aggregates, "perCourse": {course: {name: {"passed": sum(r["softwareChecksPassed"] for r in records if r["candidate"] == name and r["course"] == course), "attempts": sum(r["candidate"] == name and r["course"] == course for r in records)} for name in ("direct-meta", "vera")} for course in courses}, "records": records, "independentAudit": {k: v for k, v in audit.items() if k != "rows"}, "accountedCostIncludingAlignmentByJobId": sum(r[1] for r in own_usage), "callsIncludingRetriesAndAlignment": len(own_usage), "provisionalAlignment": [{k: v for k, v in a.items() if k != "judgment"} for a in read(folder / "alignment.json")], "limitations": report["limitations"]})
    controls = read(feedback / "report.json")
    control_audit = read(feedback / "independent-source-audit.json")
    control_jobs = {a["jobId"] for course in controls["reports"] for a in course["artifacts"]}
    reference_result = read(reference / "result.json")
    limit = ledger.execute("select cap,baseline from spending_limits where id='ocw-cross-subject-v2-additional-20usd'").fetchone()
    total = sum(r[1] for r in usage)
    return {
        "version": 1, "date": "2026-11-03", "method": "Exploratory OCW development followed by a frozen cross-subject candidate; no fine-tuning", "candidateSha256": hashlib.sha256(Path("fixtures/ocw-cross-subject/candidate.json").read_bytes()).hexdigest(), "candidateFilesMatch": {f: hashlib.sha256(Path(f).read_bytes()).hexdigest() == h for f, h in candidate["files"].items()}, "cohorts": cohorts,
        "feedback": {"cases": control_audit["cases"], "scoringBoundariesPassed": control_audit["scoringBoundariesPassed"], "objectiveKeysChecked": control_audit["objectiveKeysChecked"], "objectiveKeysPassed": control_audit["objectiveKeysPassed"], "perCourse": [{"course": r["course"], "controls": len(r["rows"]), "suggestionsPublished": len(r["suggestions"]), "error": r.get("error"), "scoresUnchanged": all(row["scoreUnchanged"] for row in r["rows"])} for r in controls["reports"]], "accountedCostByJobId": sum(r[1] for r in usage if r[0] in control_jobs), "limitation": control_audit["limitation"]},
        "supplementalReference": {"kind": reference_result["manifest"]["kind"], "referenceAgreement": reference_result.get("referenceAgreement"), "nonQuarantinedAgreement": reference_result.get("nonQuarantinedAgreement"), "quarantined": reference_result["manifest"]["quarantined"], "accountedCost": reference_result.get("accountedCost"), "limitation": reference_result["manifest"]["limitation"]},
        "spending": {"additionalCapUsd": limit[0], "baselineUsd": limit[1], "accountedAdditionalUsd": total - limit[1], "accountedLifetimeUsd": total, "uncertainOrReservedCalls": sum(r[2] != "settled" for r in usage), "reserveUsd": 30, "note": "Charges reconciled by persisted job IDs. The development and feedback processes overlapped; their raw before/after ledger-window totals overlap and must not be added together. This is token/reservation accounting, not a billing-dashboard reconciliation."},
        "interpretation": ["Final software readiness was 12/12 for VERA and 10/12 for direct generation on these selected packets.", "Passing claim checks does not establish full solution correctness, factual entailment, equal difficulty, semantic originality or improved learning.", "Model-rated assessment alignment is provisional; history is a writing-support benchmark without an official key.", "The supplemental reference solve is separate from generation; a disputed official-key item remains visible and was quarantined before that solve.", "Raw PDFs, extracted source text, full prompts and student/model responses remain local and are excluded from this public summary."]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--development", default="development-2026-11-03")
    parser.add_argument("--final", default="final-2026-11-03")
    parser.add_argument("--feedback", default="feedback-controls-2026-11-03")
    parser.add_argument("--database", default=".vera/budget.sqlite")
    parser.add_argument("--out", default="output/ocw-cross-subject/summary.json")
    args = parser.parse_args()
    value = summary(Path("output/ocw-cross-subject") / args.development, Path("output/ocw-cross-subject") / args.final, Path("output/ocw-feedback") / args.feedback, Path("output/ocw-reference") / args.final, args.database)
    with Path(args.out).open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write("\n")
    print(json.dumps({"cohorts": [{"phase": c["phase"], "attempts": c["attempts"], "costByJobId": c["accountedCostIncludingAlignmentByJobId"]} for c in value["cohorts"]], "spending": value["spending"]}, indent=2))
