# Meta integration

Documentation checked on October 28, 2026:

- [Overview and available model identifiers](https://dev.meta.ai/docs/overview)
- [JSON-schema structured output](https://dev.meta.ai/docs/structured-output)
- [Image understanding](https://dev.meta.ai/docs/image-understanding)
- [PDF/file handling and limits](https://dev.meta.ai/docs/file-handling)
- [Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits)

## Contract and request shape

`AssessmentProvider.structured<T>` takes an application-owned Zod schema, stage name, untrusted evidence prompt, local image attachments, job ID, and abort signal. `MetaProvider` adapts it to `POST https://api.meta.ai/v1/chat/completions` using Bearer `MODEL_API_KEY` auth. It sends `response_format.type=json_schema`, a named `json_schema.schema`, text blocks, and base64 `image_url` blocks. It uses `max_completion_tokens` and rejects non-`stop` finish reasons. The application parses every response against its own schema and runs domain checks afterwards.

No Google schema types, SDK, authentication, model identifiers, file storage, or fallback chain are used. There is no silent vendor fallback. Changing `META_MODEL` is an explicit configuration change; run the probe again. The default identifier is a documented candidate, not an assertion of this account's access or its performance.

Meta supports direct PDFs, with documented text/image page limits. VERA deliberately extracts and renders locally and attaches page images in explicit order. This preserves source-page mapping, detects overlaps locally, and avoids accidentally relying on unseen pages in a long PDF. VERA's 40-page application limit is below the documented 50-image request limit. A per-call spending ceiling can require an even smaller packet.

## Data use

VERA permits Standard mode and refuses identifiers containing `contributor`. Meta's documentation states that Standard-mode content is not used to train Meta models. This is not a zero-retention claim. Verify the account's current terms and settings before processing private course materials. The app uses inline image inputs, not persistent Files API uploads. Local uploads and rendered pages stay outside `public/`.

## Budget

The configured Spark Standard-mode rates are USD 1.25/M input and USD 4.25/M output tokens, rechecked November 3, 2026. Caching discounts are ignored conservatively. Recheck current pricing and update the environment rates when changing models; a more expensive model must not inherit cheaper rates.

Each request reserves a conservative token ceiling using UTF-8 input bytes, schema size, an image allowance, and the configurable output cap (16,000 tokens by default, including internal reasoning). A configurable per-call ceiling defaults to USD 0.50. SQLite transactions enforce USD 90 development and USD 30 demo buckets, USD 120 combined. The remaining USD 30 reserve cannot be selected as a bucket.

Successful calls settle against reported token usage. Calls with missing usage, ambiguous transport failures, interrupted responses, or possible server-side work keep their reservation as uncertain. Explicit non-retryable HTTP rejections settle at zero. Retries reserve separately. The ledger is an application estimate, not a replacement for the Meta billing dashboard; reconcile unknown charges manually before larger batches.

Each call has a 90-second deadline; a complete job has an 8-minute deadline. HTTP 429/5xx have at most three attempts with jittered backoff and a 15-second maximum retry wait. Network interruptions fail conservatively rather than blindly duplicating a possibly billed call. Cancellation aborts the request but cannot guarantee the upstream provider has stopped billing.

## Current validation status

Provider request shapes, schema rejection, missing credentials, Standard-mode enforcement, usage accounting, transport interruption, and truncated output are exercised with mocked transport tests. Actual account access, mathematical image understanding, model selection, latency, and quality require `npm run probe` and the live evaluation. The initial October 28 environment did not expose a key; the November 3 live and cross-subject results below supersede that pending state.

## November 3 live validation

The text/JSON and mathematical-image probes passed on the user's account. A real MIT OpenCourseWare source packet exposed truncation with the original 9,000-token cap and model-selected reasoning. All six initial attempts are retained. The provider now defaults to explicit low reasoning and a configurable 16,000-token output limit; reservations account for that configured ceiling. Set META_REASONING_EFFORT or VERA_MAX_OUTPUT_TOKENS to change them within validated bounds. The per-call spending cap, 90-second deadline, and development allocation still apply. Non-stop output remains rejected and its finish reason is included in the recovery message.

Meta's [reasoning documentation](https://dev.meta.ai/docs/reasoning) explains that reasoning tokens share the output-token allowance. The frozen follow-up comparison completed all six exams; independent arithmetic and the limitations are recorded in [MIT-EVALUATION.md](MIT-EVALUATION.md). Passing a probe or numerical checks is not a full correctness guarantee.

Workers and CLI evaluation/probe commands use @next/env to load .env and .env.local with Next.js precedence. Credentials remain server-side and ignored by Git. .env.example contains no credential.


## Cross-subject execution and shared accounting

New live analysis uses required schema-version-2 provenance and supports subject-appropriate choice, numeric, short-answer, worked-response and essay items. The adapter remains vendor-independent at the application boundary; source material remains untrusted evidence. Generation attaches uncertain mathematical page images; source pages carrying explicit rights-exclusion notices are omitted from future model input. Model feedback checks saved-answer excerpts, criterion indices and permitted source references before publication, and never changes scores.

App and evaluation records can live in separate SQLite databases, but reservations now use one budget.sqlite selected by VERA_BUDGET_DIR. Historical app and MIT-evaluation usage rows are imported by ID. A persistent additional-campaign limit prevents restarting a process or choosing another output batch from resetting the USD 20 allowance. A two-process reservation race is tested. The active campaign recorded USD 2.672849 additional usage; complete attribution and verification limits are in [OCW-EVALUATION.md](OCW-EVALUATION.md).

Public workspace responses omit raw upstream diagnostics as well as answer-bearing data. Private diagnostics and full stage artifacts remain in ignored local records. Do not deploy this loopback-only prototype as a public service without a separate account/access-control design.
