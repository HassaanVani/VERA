import { materialProblems } from "./supporting-material";
import type {
  Exam,
  Packet,
  Question,
  Scenario,
  Verification,
} from "./contracts";
import { excludedFromModel } from "./source-policy";

export const CHECKER_VERSION = "vera-checkers/2.1";
export const capabilities = [
  {
    id: "arithmetic",
    scope: "Finite arithmetic with +, −, *, /, integer powers and parentheses",
  },
  {
    id: "polynomial",
    scope:
      "One-variable polynomial identities through degree six; division by constants only",
  },
  {
    id: "numeric-answer",
    scope:
      "Numeric answers with explicit tolerances and matching units; no implicit unit conversion",
  },
  {
    id: "source-location",
    scope:
      "Document/page existence and quote presence; does not establish entailment",
  },
  {
    id: "matrix-2x2",
    scope:
      "Real 2×2 matrix products, determinants, traces and eigenpair residuals",
  },
] as const;

// A bounded parser, never JavaScript evaluation. Coefficients are increasing powers of x.
export function polynomial(input: string): number[] {
  if (input.length > 300) throw new Error("Expression exceeds 300 characters.");
  const source = input.replace(/−/g, "-").replace(/\s+/g, "");
  const tokens =
    source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[x()+*/^\-]/gi) ?? [];
  if (
    tokens.join("").toLowerCase() !== source.toLowerCase() ||
    tokens.length > 150 ||
    !tokens.length
  )
    throw new Error("Unsupported expression notation.");
  let i = 0;
  const trim = (v: number[]) => {
    while (v.length > 1 && v.at(-1) === 0) v.pop();
    if (
      v.length > 7 ||
      v.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e15)
    )
      throw new Error("Expression outside checker bounds.");
    return v;
  };
  const add = (a: number[], b: number[], sign = 1) =>
    trim(
      Array.from(
        { length: Math.max(a.length, b.length) },
        (_, j) => (a[j] ?? 0) + sign * (b[j] ?? 0),
      ),
    );
  const multiply = (a: number[], b: number[]) => {
    const out = Array(a.length + b.length - 1).fill(0);
    a.forEach((x, j) =>
      b.forEach((y, k) => {
        out[j + k] += x * y;
      }),
    );
    return trim(out);
  };
  function atom(): number[] {
    const t = tokens[i++];
    if (t === "(") {
      const v = sum();
      if (tokens[i++] !== ")") throw new Error("Unmatched parentheses.");
      return v;
    }
    if (t?.toLowerCase() === "x") return [0, 1];
    if (t === undefined || !/^(?:\d|\.)/.test(t))
      throw new Error("Expected a number, x, or parentheses.");
    return trim([Number(t)]);
  }
  function power(): number[] {
    let v = atom();
    if (tokens[i] === "^") {
      i++;
      const exponent = Number(tokens[i++]);
      if (!Number.isInteger(exponent) || exponent < 0 || exponent > 6)
        throw new Error("Power must be an integer from zero through six.");
      const base = v;
      v = [1];
      for (let n = 0; n < exponent; n++) v = multiply(v, base);
    }
    return v;
  }
  function unary(): number[] {
    if (tokens[i] === "+") {
      i++;
      return unary();
    }
    if (tokens[i] === "-") {
      i++;
      return unary().map((n) => -n);
    }
    return power();
  }
  function product(): number[] {
    let v = unary();
    while (tokens[i] === "*" || tokens[i] === "/") {
      const op = tokens[i++],
        rhs = unary();
      if (op === "*") v = multiply(v, rhs);
      else {
        if (rhs.length !== 1 || rhs[0] === 0)
          throw new Error("Only division by nonzero constants is supported.");
        v = trim(v.map((n) => n / rhs[0]));
      }
    }
    return v;
  }
  function sum(): number[] {
    let v = product();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const op = tokens[i++];
      v = add(v, product(), op === "+" ? 1 : -1);
    }
    return v;
  }
  const value = sum();
  if (i !== tokens.length) throw new Error("Unexpected expression token.");
  return value;
}
export function arithmetic(expression: string) {
  const p = polynomial(expression);
  if (p.length !== 1)
    throw new Error("Numeric expressions cannot contain variables.");
  return p[0];
}
export const approximately = (
  a: number,
  b: number,
  absolute = 1e-8,
  relative = 1e-8,
) => Math.abs(a - b) <= Math.max(absolute, relative * Math.abs(b));
// SI quantities can be much smaller than 1e-8 (for example capacitance).
// A fixed absolute floor would incorrectly accept zero or a wrong exponent.
export const calculationClose = (a: number, b: number) =>
  Math.abs(a - b) <=
  Math.max(Number.MIN_VALUE, 1e-9 * Math.max(Math.abs(a), Math.abs(b)));
const normalize = (s: string) =>
  s.normalize("NFKC").replace(/\s+/g, " ").trim();
export function referenceExists(
  packet: Packet,
  ref: { documentId: string; page: number },
) {
  return packet.documents.some(
    (d) =>
      d.id === ref.documentId &&
      d.pages.some((p) => p.number === ref.page && !excludedFromModel(p)),
  );
}
const canonicalUnit = (s: string) =>
  ({
    meters: "m",
    meter: "m",
    seconds: "s",
    second: "s",
    dollars: "usd",
    $: "usd",
    dimensionless: "",
    unitless: "",
    "": "",
  })[s.trim().toLowerCase()] ?? s.trim().toLowerCase().replace(/\s/g, "");
export function numericGrade(
  q: Question,
  response: string,
): boolean | undefined {
  if (!q.numeric) return undefined;
  const normalized = response
    .trim()
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\\\((.*?)\\\)/g, "$1")
    .replace(/\\frac\{([\d.+\-]+)\}\{([\d.+\-]+)\}/g, "($1)/($2)");
  const match = normalized.match(/^([\d.eE+\-*/^()\s]+)(.*?)$/);
  if (!match || canonicalUnit(match[2]) !== canonicalUnit(q.numeric.unit))
    return false;
  try {
    return approximately(
      arithmetic(match[1]),
      q.numeric.value,
      q.numeric.absoluteTolerance,
      q.numeric.relativeTolerance,
    );
  } catch {
    return false;
  }
}
export const choiceQuestion = (q: Pick<Question, "type">) =>
  q.type === "multiple-choice";
export function automaticGrade(
  q: Question,
  response: string,
): boolean | undefined {
  if (choiceQuestion(q)) return response === q.answer;
  if (q.type === "numeric") return numericGrade(q, response);
  return undefined;
}

type Context = { packet?: Packet; scenario?: Scenario; exam?: Exam };
type Claim = Question["claims"][number];
type Result = Pick<Verification, "result" | "artifact" | "limitation">;
type Verifier = {
  method: string;
  accepts: (claim: Claim) => boolean;
  check: (claim: Claim, context: Context) => Result;
};
const outcome = (
  ok: boolean,
  artifact: string,
  limitation: string,
): Result => ({ result: ok ? "passed" : "failed", artifact, limitation });
const registry: Verifier[] = [
  {
    method: "exhibit-consistency",
    accepts: (c) => c.kind === "exhibit-cell" || c.kind === "coordinate",
    check: (c, { exam }) => {
      if (c.kind === "exhibit-cell") {
        const exhibit = exam?.exhibits?.find(
            (e) => e.id === c.exhibitId && e.kind === "table",
          ),
          actual = exhibit?.rows[c.row]?.[c.column];
        return outcome(
          actual === c.value,
          JSON.stringify({ actual, proposed: c.value }),
          "Checks a cited table cell, not whether the question interprets it correctly.",
        );
      }
      if (c.kind === "coordinate") {
        const point = exam?.exhibits
          ?.find((e) => e.id === c.exhibitId && e.kind === "diagram")
          ?.points.find((p) => p.label === c.label);
        return outcome(
          !!point && approximately(point.x, c.x) && approximately(point.y, c.y),
          JSON.stringify({ actual: point, proposed: c }),
          "Checks coordinates against the shared diagram data, not conceptual reasoning.",
        );
      }
      throw new Error("Claim mismatch");
    },
  },
  {
    method: "arithmetic",
    accepts: (c) => c.kind === "calculation",
    check: (c) => {
      if (c.kind !== "calculation") throw new Error("Claim mismatch");
      const computed = arithmetic(c.expression);
      return outcome(
        calculationClose(computed, c.answer),
        `${c.expression} = ${computed}; proposed ${c.answer} ${c.unit}`,
        "Checks this calculation only, not whether its formula answers the question or its units are physically valid.",
      );
    },
  },
  {
    method: "polynomial",
    accepts: (c) => c.kind === "expression",
    check: (c) => {
      if (c.kind !== "expression") throw new Error("Claim mismatch");
      const a = polynomial(c.left),
        b = polynomial(c.right),
        ok = Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
          approximately(a[i] ?? 0, b[i] ?? 0),
        ).every(Boolean);
      return outcome(
        ok,
        JSON.stringify({ leftCoefficients: a, rightCoefficients: b }),
        "Bounded polynomial coefficient comparison using floating-point tolerances; not a general proof checker.",
      );
    },
  },
  {
    method: "source-location",
    accepts: (c) => c.kind === "source",
    check: (c, { packet }) => {
      if (c.kind !== "source" || !packet)
        return {
          result: "unsupported",
          artifact: "No source packet supplied",
          limitation: "Source checking requires the original packet.",
        };
      const page = packet.documents
        .find((d) => d.id === c.evidence.documentId)
        ?.pages.find((p) => p.number === c.evidence.page);
      return outcome(
        !!page &&
          !excludedFromModel(page) &&
          normalize(page.text).includes(normalize(c.quote)),
        `${c.evidence.documentId}, page ${c.evidence.page}: ${c.quote}`,
        "Quote presence does not verify the claim's meaning, interpretation, or completeness.",
      );
    },
  },
  {
    method: "matrix-2x2",
    accepts: (c) =>
      ["image", "eigenpair", "determinant", "trace"].includes(c.kind),
    check: (c, { scenario: s }) => {
      if (!s)
        return {
          result: "failed",
          artifact: "Claim names an absent matrix scenario",
          limitation: "Matrix claims require shared matrix data.",
        };
      const mul = (v: number[]) =>
        s.matrix.map((row) => row[0] * v[0] + row[1] * v[1]);
      let ok = false,
        computed: unknown;
      if (c.kind === "image") {
        computed = mul(c.input);
        ok = (computed as number[]).every((v, i) =>
          approximately(v, c.answer[i]),
        );
      }
      if (c.kind === "eigenpair") {
        computed = mul(c.vector);
        ok =
          c.vector.some((v) => v !== 0) &&
          (computed as number[]).every((v, i) =>
            approximately(v, c.value * c.vector[i]),
          );
      }
      if (c.kind === "determinant") {
        computed =
          s.matrix[0][0] * s.matrix[1][1] - s.matrix[0][1] * s.matrix[1][0];
        ok = approximately(computed as number, c.answer);
      }
      if (c.kind === "trace") {
        computed = s.matrix[0][0] + s.matrix[1][1];
        ok = approximately(computed as number, c.answer);
      }
      return outcome(
        ok,
        JSON.stringify({ computed, claim: c }),
        "Checks the structured matrix claim, not every written step or the question's interpretation.",
      );
    },
  },
];
export function verifyExam(exam: Exam, context: Context): Verification[] {
  return exam.questions.flatMap((q) => {
    const results: Verification[] = q.claims.map((claim, index) => {
      const checker = registry.find((v) => v.accepts(claim));
      let result: Result = {
        result: "unsupported",
        artifact: "No registered checker",
        limitation: "Not automatically verified.",
      };
      try {
        if (checker) result = checker.check(claim, { ...context, exam });
      } catch (e) {
        result = {
          result: "unsupported",
          artifact: e instanceof Error ? e.message : "Unsupported notation",
          limitation:
            "Not automatically verified; checker bounds or notation were exceeded.",
        };
      }
      return {
        question: q.number,
        claim: index,
        method: checker?.method ?? "unsupported",
        checkerVersion: CHECKER_VERSION,
        ...result,
      };
    });
    for (const exhibit of (exam.exhibits ?? []).filter(
      (e) => q.exhibitIds.includes(e.id) && (e.drawing || e.source),
    )) {
      const problems = materialProblems(exhibit, context.packet);
      results.push({
        question: q.number,
        claim: null,
        method: exhibit.source ? "source-excerpt" : "diagram-structure",
        result: problems.length ? "failed" : "passed",
        artifact: JSON.stringify({ exhibitId: exhibit.id, problems }),
        checkerVersion: "supporting-material-1",
        limitation: exhibit.source
          ? "Verifies literal page text and location, not authenticity or historical interpretation."
          : "Checks geometry references and bounded data, not conceptual relevance or every answer.",
      });
    }
    if (q.responseDiagram)
      results.push({
        question: q.number,
        claim: null,
        method: "vector-response-grading",
        result: "unsupported",
        artifact:
          "Vector coordinates and explanation are recorded; no automatic grading of the student's construction.",
        checkerVersion: "vector-response/1",
        limitation:
          "Response bounds are checked, but those checks do not determine whether the drawn vector answers the question. Self-score against the rubric after submission.",
      });
    results.push({
      question: q.number,
      claim: null,
      method: "written-reasoning",
      result: "unsupported",
      artifact: "No automatic conceptual proof or essay-grade verification",
      checkerVersion: CHECKER_VERSION,
      limitation:
        "Model review is provisional. Passing individual claims does not verify the entire answer.",
    });
    return results;
  });
}
