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

The configured Spark Standard-mode rates are USD 1.25/M input and USD 4.25/M output tokens, checked October 28, 2026. Caching discounts are ignored conservatively. Recheck current pricing and update the environment rates when changing models; a more expensive model must not inherit cheaper rates.

Each request reserves a conservative token ceiling using UTF-8 input bytes, schema size, an image allowance, and the 9,000-token output cap. A configurable per-call ceiling defaults to USD 0.50. SQLite transactions enforce USD 90 development and USD 30 demo buckets, USD 120 combined. The remaining USD 30 reserve cannot be selected as a bucket.

Successful calls settle against reported token usage. Calls with missing usage, ambiguous transport failures, interrupted responses, or possible server-side work keep their reservation as uncertain. Explicit non-retryable HTTP rejections settle at zero. Retries reserve separately. The ledger is an application estimate, not a replacement for the Meta billing dashboard; reconcile unknown charges manually before larger batches.

Each call has a 90-second deadline; a complete job has an 8-minute deadline. HTTP 429/5xx have at most three attempts with jittered backoff and a 15-second maximum retry wait. Network interruptions fail conservatively rather than blindly duplicating a possibly billed call. Cancellation aborts the request but cannot guarantee the upstream provider has stopped billing.

## Current validation status

Provider request shapes, schema rejection, missing credentials, Standard-mode enforcement, usage accounting, transport interruption, and truncated output are exercised with mocked transport tests. Actual account access, mathematical image understanding, model selection, latency, and quality require `npm run probe` and the live evaluation. The build environment did not expose a key, so those results remain pending.
