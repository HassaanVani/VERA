# Diagrams and uploaded source passages

## Meta-generated illustrations

Live version-2 plans expose **Diagram rendering**: subject-appropriate selection, Muse Image, or precise SVG. A preference edit invalidates approval like other plan edits. Saved authored examples retain their existing figures. Precise mode rejects raster specifications and does not invoke image generation for them.

A synthetic `kind:"image"` exhibit supplies private `illustration:{prompt,description}` metadata and empty points/columns/rows. At most two figures may be requested per exam. Muse Image receives the figure specification rather than question stems/options, which reduced unwanted question-text rendering in the live trial. The accessible description and question text must preserve essential givens. React displays the private PNG at its actual aspect ratio, plus a text description and visible AI-review/verification limits. Raster images are not a replacement for precise coordinate verification.

Generated image records and each repair remain local. Unchanged same-job figures are cached; changed dependent questions/specifications invalidate the fingerprint. A disputed or uncertain visual review blocks readiness. Images, private briefs and review artifacts are distinct from public exam metadata. A resolving local image URL proves availability, not visual correctness. See [Muse integration](META.md) and the [retained pilot results](MUSE-IMAGE-TRIAL.md).

New version-2 generation can request precise applied-math diagrams and retrieved passages. The interface shows only the current question's referenced exhibits. Existing matrix exams and point-only diagrams remain readable; historical verification records are not recomputed on read.

## Structured diagrams

An exhibit with `kind:"diagram"` supplies labeled `{label,x,y}` points and optionally:

```json
{
  "axes": "cartesian",
  "description": "Given positions and relationships, without solving the problem.",
  "segments": [{"from":"O","to":"A","arrow":true,"label":"Displacement"}],
  "paths": [{"points":["O","A","B"],"closed":true,"label":"Boundary"}],
  "circles": [{"center":"A","radius":1.5,"label":"Buffer"}]
}
```

The model generates data; React renders SVG. No model-authored SVG, HTML, scripts or external image URLs are executed. Limits are 40 points, 24 segments, 12 paths, 8 circles and coordinate/radius magnitudes up to one million. Axes may be `none`. Open paths are sampled polylines, not analytic function plots. Scaling uses the same units on both axes and includes entire circles. Essential coordinates, links, radii and a description are available as text beneath the figure.

Checks cover finite coordinates, unique labels, existing endpoints/centers, sufficient distinct path vertices, positive radii and known answer-bearing labels. These checks do not prove geometric theorems, detect every overlapping label or crossing polygon, or establish that the chosen diagram supports a correct solution. Arithmetic/coordinate claims and provisional independent solving remain separate.

## Local source retrieval

The generator ranks permitted uploaded text chunks using the approved subject, objectives, topics and cited pages. Up to eight passages are persisted as `Retrieved source passages` artifacts, then supplied as untrusted evidence alongside the permitted packet. Long unpunctuated OCR text receives bounded literal slices. This is local keyword retrieval, not a web archive search or an embedding index. Page text still needs readable extraction; retrieval does not repair OCR errors.

A source exhibit uses `kind:"passage"`, `synthetic:false`, `source:{documentId,page}` and a literal excerpt in `content`. Validation requires an existing permitted page and normalized-whitespace substring match. Solution documents, generated references and pages flagged by the rights-notice policy cannot supply these excerpts. Invented or paraphrased material must be labeled synthetic. The page viewer opens the cited original without discarding the current answer or plan edits.

`source-excerpt` passing means location and literal wording were checked. It does not authenticate a document, verify its claims, establish representativeness, or certify an interpretation. Historical reasoning remains self-scored and visibly unsupported by automatic reasoning checks.

## Repair and provenance

Within the existing two-cycle limit, version-2 repair can replace an existing exhibit identified by a blocking `exhibits.N` issue. It cannot add/remove exhibits or change an unaffected exhibit. Before/replacement artifacts are stored. All deterministic checks and independent solving run again after repair; unresolved blocking errors prevent practice. Legacy matrix scenarios remain immutable. Invalid schema output remains a recoverable job failure rather than entering the renderer.

## Try the original example

Open **Explore a saved example → Explore diagrams & documents**. Review and approve the plan, then generate the saved demonstration. It contains a triangle, arrow and circular buffer, plus a clearly fictional petition. Numeric answers use checked arithmetic; the petition response is self-scored. Loading this example makes no model calls and is not evidence of model quality.

Browser checks: `node scripts/browser-illustrated.mjs` against an isolated credential-disabled `VERA_TEST_WORKSPACE=1` server. Configure Playwright with the same environment variables as the other browser runners.

An explicitly paid capability probe is available as `npx tsx scripts/probe-supporting-material.ts --live`. It uses original material, isolated records, the existing shared development ledger and persistent $20 campaign cap. Its additional local ceiling is $1, including room for bounded retries. It refuses to run without the existing campaign cap or matching checked model/pricing. Artifacts stay in ignored `output/supporting-material-probe/`. This is one capability probe, not a paired quality evaluation or student study.

The November 3 [public capability result](../fixtures/supporting-material/probe-2026-11-03.json) retained three provider calls and zero repairs: a six-point diagram with an arrow, triangle and circle, plus one literal passage. Ten bounded verification records passed and three written-reasoning records remained unsupported. Recorded cost was $0.0397425 over 60.3 seconds. These counts describe individual checks, not a fully verified exam.

The earlier frozen OCW comparison predates these engine changes. Reproduce that candidate from commit `606bab7`; do not relabel its results as validation of the new diagram/retrieval engine.
