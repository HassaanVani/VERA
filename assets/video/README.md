# VERA video graphics

Three matching 16:9 graphics, rendered at **3840 × 2160**. Use the PNG files directly in a video editor; the SVG files are editable masters with an embedded Manrope font.

| Asset | Intended use |
| --- | --- |
| `vera-thumbnail.png` / `.svg` | Centered original VERA mark and product name; thumbnail or opening frame. |
| `vera-full-name.png` / `.svg` | **Verified Exam and Revision Architect** title card, highlighting V / E / R / A. |
| `vera-ai-pipeline.png` / `.svg` | Architecture graphic distinguishing Meta model passes, student approval, supported deterministic checks, optional figures, and bounded repair. |

Design brief: midnight black (`#030609`), light blue (`#75c8ff`), high contrast type, the exact nested-V paths from `components/Brand.tsx`, and restrained line work. These are original code-native vector graphics; no image model, external image service, or paid Meta request was used to create them. They do not include third-party course materials or official Meta logos.

The pipeline follows `lib/pipeline.ts`, `lib/exam-images.ts`, and `lib/image-provider.ts`. Multiple Spark steps are separate calls to the configured model family, not different expert models. Figure generation is optional; precise diagrams can use SVG. The vision inspection is provisional model review. Repairs rerun checks at most twice; unresolved blocking errors prevent practice. Unsupported reasoning is not automatically verified. Feedback and self-scoring retain their separate labels in the application; this diagram summarizes generation rather than the entire assessment lifecycle.

Suggested narration: “Spark reads the evidence and proposes a plan I approve. It generates the exam, then solves it again with the key withheld. VERA runs supported code checks and compares the solutions. Optional figures use Muse Image with a visual review. Problems trigger up to two repair cycles; unresolved blocking errors stop practice.”

Regenerate from the project root with Node 22.13 or newer:

```powershell
node scripts/create-video-graphics.mjs
```

Requires the project's Playwright dependency and installed Google Chrome. Regeneration overwrites this set. It does not start the app, access course data, or call any model API. Manrope is bundled under the SIL Open Font License; see `../../public/fonts/OFL-Manrope.txt`.
