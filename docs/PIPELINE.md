# Listing generation and language feedback

The photo-first flow has no example-entry or style-learning prerequisite. Capture intent, manual edits, feedback and approval persist on the device and synchronize in the background. Firestore commands derive ownership from authenticated identity and verify expected versions.

## Real provider

Deployed Functions call Vertex AI Gemini through the runtime service account, using normalized JPEG photos, seller context and remembered language instructions. The default model is `gemini-2.5-flash`; `VINTAGE_AI_MODEL` configures an explicitly selected replacement. Requests use the global Vertex endpoint, a 90-second timeout and bounded output. Structured responses undergo runtime validation; photo observation references must belong to the request. Model confidence is subjective uncertainty, not a calibrated probability.

[Vertex REST quickstart](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart) and [structured output](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output) document the API used by the adapter.

`functions/generator.mjs` contains no sample output. There is no fallback generator. A provider failure retains the draft and produces a recoverable error after three attempts. Workers claim a lease before inference and persist successful results for resumption. A crash between inference and result persistence can still repeat a charged request; this is bounded retry, not exactly-once external billing.

## Feedback and concurrency

`language/state` under the owner account stores up to 20 explicit instructions, each up to 1,000 characters. Applying feedback pins the displayed title/description and instruction sequence, queues a real revision, and remembers the instruction for future generation. A repeated identical instruction replaces its previous entry. Later instructions take precedence. Forget removes a remembered instruction from subsequent requests; in-flight requests retain their pinned inputs.

Revision changes only title and description. It never changes price, attributes or photos. The completion transaction checks that the proposal and wording still match the pinned source. Newer manual edits win and the UI explains that feedback can be reapplied. Approval is blocked while revision is pending and validates the exact current copy, photos, chosen price and model provenance. Old fixture proposals cannot be approved and must be regenerated.

## Pricing

No recommendation is supplied until market evidence is implemented. The seller enters an asking price in GBP, represented as integer pence. Approval requires that price. There is no £48 default, invented market source, sale probability or revenue curve.

## Verification and deployment

`npm run test:e2e` owns a loopback-only AI test server plus Auth, Firestore, Storage and Functions emulators. `tests/fixtures/ai-server.mjs` is outside the Functions deployment directory. The runtime rejects its test endpoint unless both the Functions emulator flag and demo project are present. CI validates rules, worker/revision contracts and browser flows in both appearances. Deterministic tests do not establish model quality.

`scripts/configure-pipeline.mjs` enables Vertex AI and grants the dedicated runtime account `roles/aiplatform.user`, preserving existing IAM bindings. Review deployments use live Firebase and real Vertex AI. Backend digest changes must be reviewed against shared previews before updating the repository deployment digest. Source/prompt changes affect old previews' shared backend; obsolete sample clients must reload the new deployment.
