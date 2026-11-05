# Diagrams and uploaded source passages

## Meta-generated illustrations

Live version-2 plans expose **Diagram rendering**: subject-appropriate selection, Muse Image, or precise SVG. A preference edit invalidates approval like other plan edits. Saved authored examples retain their existing figures. Precise mode rejects raster specifications and does not invoke image generation for them.

A synthetic `kind:"image"` exhibit supplies private `illustration:{prompt,description}` metadata and empty points/columns/rows. At most two figures may be requested per exam. Muse Image receives the figure specification rather than question stems/options, which reduced unwanted question-text rendering in the live trial. The accessible description and question text must preserve essential givens. React displays the private PNG at its actual aspect ratio, plus a text description and visible AI-review/verification limits. Raster images are not a replacement for precise coordinate verification.

Generated image records and each repair remain local. Unchanged same-job figures are cached; changed dependent questions/specifications invalidate the fingerprint. A disputed or uncertain visual review blocks readiness. Images, private briefs and review artifacts are distinct from public exam metadata. A resolving local image URL proves availability, not visual correctness. See [Muse integration](META.md) and the [retained pilot results](DIAGRAMS.md).

New requests use Muse Image `size:"auto"`, documented as the default aspect selection, instead of imposing landscape on every figure. The prompt requests compact content-fitting composition and modest safe label margins. This request change is covered by transport tests; it is not evidence that future images will always have good internal whitespace. Existing raster assets remain intact. The image sheet now uses smaller padding and displays the figure before its expandable text description. Full-size access remains available; no automatic crop or stretch removes labels.

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

Precise figures now derive a non-square viewport from their actual geometry, circle extents and label margins, preserving the same coordinate scale on both axes. Axis-free drawings do not automatically include the origin. Display sizing scales both dimensions together, avoiding fixed-height letterboxing.

## Answering on a diagram

A version-2 worked-response slot can select `responseMode:"vector-drawing"` in the question editor. Generation must supply `responseDiagram:{exhibitId,minX,maxX,minY,maxY,maxVectors}` pointing to a referenced precise Cartesian exhibit. Bounds must be ordered, contain the givens/circles and stay within ±10,000; at most six vectors are supported. Expected vectors remain in private solutions/rubrics. A Muse raster cannot substitute for calibrated coordinates.

In practice, the diagram becomes the answer surface in the reading column, rather than appearing again as a detached duplicate. Drag an arrow, tap start/end, or use the four coordinate inputs. Pointer positions round to two decimals; typed inputs keep their precision. The student may remove the last vector or cancel an unfinished one. Only completed vectors and the explanation are saved. Given geometry and response vectors use different colors and have textual coordinate alternatives.

Coordinates and reasoning are versioned inside the existing attempt response string, validated on the server, autosaved and recovered together. Empty drawings remain unanswered; submitted responses are locked. Review renders the saved drawing read-only. `vector-response-grading` remains unsupported: bounds checking does not grade the construction. Written/drawn work is self-scored, and provisional feedback uses a readable coordinate description rather than raw JSON. Arbitrary freehand, handwriting recognition, raster annotation and automatic vector grading are not included.

Try **Explore a saved example → Try vector drawing**. This original two-question example is authored, makes no model calls and does not establish generation quality. The guarded `scripts/browser-vector-response.mjs` exercises the complete drawing workflow on an isolated test server.

## Local source retrieval

The generator ranks permitted uploaded text chunks using the approved subject, objectives, topics and cited pages. Up to eight passages are persisted as `Retrieved source passages` artifacts, then supplied as untrusted evidence alongside the permitted packet. Long unpunctuated OCR text receives bounded literal slices. This is local keyword retrieval, not a web archive search or an embedding index. Page text still needs readable extraction; retrieval does not repair OCR errors.

A source exhibit uses `kind:"passage"`, `synthetic:false`, `source:{documentId,page}` and a literal excerpt in `content`. Validation requires an existing permitted page and normalized-whitespace substring match. Solution documents, generated references and pages flagged by the rights-notice policy cannot supply these excerpts. Invented or paraphrased material must be labeled synthetic. The page viewer opens the cited original without discarding the current answer or plan edits.

`source-excerpt` passing means location and literal wording were checked. It does not authenticate a document, verify its claims, establish representativeness, or certify an interpretation. Historical reasoning remains self-scored and visibly unsupported by automatic reasoning checks.

Before checking new generated passages, deterministic source binding can match whitespace and straight/curly quote variants, then replace the proposal with the **actual original page substring**. Both versions are recorded. Changed words, invented text, excluded pages, wrong references and solution/generated-reference roles are not rescued by this binding. No historical saved exam is rewritten on read. The real-document [humanities capability result](DIAGRAMS.md) exposed and tested this typography issue.

An optional `readingLayout` distinguishes reflowed prose from preserved lineation. `prose` collapses visual PDF line wrapping for reading while leaving stored source content unchanged; `preserve-lines` retains breaks for verse or line-sensitive reading. Legacy exhibits keep their existing line presentation unless explicitly configured. The historical handout is marked as prose, with that presentation-only change recorded.

## Repair and provenance

Within the existing two-cycle limit, version-2 repair can replace an existing exhibit identified by a blocking `exhibits.N` issue. It cannot add/remove exhibits or change an unaffected exhibit. Before/replacement artifacts are stored. All deterministic checks and independent solving run again after repair; unresolved blocking errors prevent practice. Legacy matrix scenarios remain immutable. Invalid schema output remains a recoverable job failure rather than entering the renderer.

## Try the original example

Open **Explore a saved example → Explore diagrams & documents**. Review and approve the plan, then generate the saved demonstration. It contains a triangle, arrow and circular buffer, plus a clearly fictional petition. Numeric answers use checked arithmetic; the petition response is self-scored. Loading this example makes no model calls and is not evidence of model quality.

Browser checks: `node scripts/browser-illustrated.mjs` against an isolated credential-disabled `VERA_TEST_WORKSPACE=1` server. Configure Playwright with the same environment variables as the other browser runners.

An explicitly paid capability probe is available as `npx tsx scripts/probe-supporting-material.ts --live`. It uses original material, isolated records, the existing shared development ledger and persistent $20 campaign cap. Its additional local ceiling is $1, including room for bounded retries. It refuses to run without the existing campaign cap or matching checked model/pricing. Artifacts stay in ignored `output/supporting-material-probe/`. This is one capability probe, not a paired quality evaluation or student study.

The November 3 [public capability result](../fixtures/supporting-material/probe-2026-11-03.json) retained three provider calls and zero repairs: a six-point diagram with an arrow, triangle and circle, plus one literal passage. Ten bounded verification records passed and three written-reasoning records remained unsupported. Recorded cost was $0.0397425 over 60.3 seconds. These counts describe individual checks, not a fully verified exam.

The earlier frozen OCW comparison predates these engine changes. Reproduce that candidate from commit `606bab7`; do not relabel its results as validation of the new diagram/retrieval engine.
