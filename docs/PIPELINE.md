# Examples, generation and approval

Milestones 3–6 extend the photo-first flow with pasted examples, durable sample generation, editable review and immutable approval. The generated concepts in `UX_DESIGN.md` remain the visual references. No software screenshots replace those concepts.

## Storage and command boundary

All data lives under `workspaces/{workspace}/accounts/{uid}`. Capture descriptors/events retain their existing contract. New owner-readable paths are:

- `style/state`: examples, version, profile provenance and durable learning stage.
- `listings/{id}/pipeline/state`: generation input, version, proposal, edits, selected price and approved snapshot.
- `workflowEvents/{eventId}` and `listings/{id}/workflowEvents/{eventId}`: immutable versioned workflow events. The server writes each event atomically with its current projection; `reduceWorkflow` reconstructs that projection and rejects version gaps.
- `operations/{commandId}`: authenticated request hash, pinned inputs, durable stage, attempts and status.

Only the callable handler and workers can write these paths. Rules allow owner reads and reject client-authored proposals/profiles/approvals, mutations and cross-user access. `submitCommand` derives the UID from verified Firebase Auth, validates the request schema and expected version, and atomically claims a UUID. Reusing a UUID with different content is rejected. A repeated delivery returns the existing logical result without changing versions.

Simple edits complete inside that transaction. Learning and generation create queued operations. A Firestore creation trigger runs durable stages; stage state, projection and deterministic event ID commit together. Eventarc retries interrupted executions. Five failed executions produce a recoverable failure state. A user retry creates a new explicit attempt; changing examples supersedes an older learning result. No browser lifetime or artificial timer controls execution.

## Device persistence and concurrent work

A separate IndexedDB queue retains pipeline intent before navigation reports it saved. A distinct local-saving state covers the transaction itself; a document reload warns while bytes have not yet committed. Once committed, reload is safe without waiting for the network. UI projections apply queued edits immediately; network delivery runs independently. IndexedDB read/write transactions serialize queue mutations across tabs, and BroadcastChannel announces changes. A Web Lock serializes network delivery and transfers automatically when a tab closes. Unsent keystrokes coalesce without changing a request already entering delivery. Stable IDs make duplicate delivery from tabs safe.

Capture uploads and capture events must sync before a queued generation command is submitted. Its original photo IDs and context remain pinned; later edits are inputs for a later proposal. The worker resolves immutable photo metadata from acknowledged events, verifies original digests and records the input fingerprint, capture version and exact style/example version. Opening Keep editing does not cancel work, and completion never redirects another screen.

Every field edit checks the previously displayed field value as well as workflow version. Example edits compare the previous example set. A conflict preserves local edits and explains how to review the latest version; choosing that action explicitly discards unconfirmed changes for the conflicting item or example set and restores its saved values. Other items keep their queued changes. Other accounts never see it. Offline sign-out counts pipeline work among device-only changes.

Approval first persists the exact displayed title, description, attributes, ordered photos and integer-pence price in the local queue. The UI shows Approval pending immediately. The server verifies workflow version, capture version, generation input version and the canonical submitted snapshot. Only server confirmation displays Approved. Repeated approval is idempotent; subsequent changes cannot mutate the approved snapshot. Read-only full text and clipboard/manual-copy recovery both use that snapshot.

## Photo processing and cleanup

`normalizeOriginal` preserves originals and creates `analysis-v1` JPEGs, oriented and bounded to 1600 pixels. HEIC uses server `heic-decode`, with dimensions checked before pixel expansion; ordinary formats use Sharp's input-pixel limit. SHA-256 verifies the source. Writes use generation preconditions, so retry cannot replace an existing derivative. Generation also ensures its pinned derivatives exist before producing a proposal.

A daily job examines at most 200 objects and retains a pagination cursor. Only unreferenced objects older than 30 days are deleted, with generation preconditions. Any photo referenced by a capture event is retained, including removed photos needed for Undo or pinned proposals. The job never deletes Auth accounts or another workspace wholesale. This deliberately conservative policy favors recovery over immediate storage reclamation.

## Sample boundary and money

`FixtureListingGenerator` loads a checked-in, schema-validated proposal. It is restricted to `demo-vintage` and `vintage-review-anicolao`; other project IDs fail initialization. The source photo used in deterministic journeys is `static/images/wardrobe.png`; seller input and fixture proposal are explicitly separate. Real uploads/examples are persisted and inspectable, but the sample text is not inferred from them and does not claim seller-style personalization.

GBP is the sample currency, represented as integer pence. Input permits at most two decimal places. The £48 initial price is labelled sample, not a valuation. Market asking/sold records, source dates, expected sale range, probability, revenue and time-to-sale are unavailable. There is no fabricated curve or evidence source. Real providers and validated pricing remain milestone 7.

## Verification

`npm run test:e2e` owns Auth, Firestore, Storage and Functions emulators on the local demo project. It runs rules and pipeline tests, warms the unauthenticated callable boundary, then runs the built SPA browser scenarios. In-test actions/assertions remain bounded to 2,000 ms. The longer whole-scenario budget permits the complete journey without relaxing any individual wait. `npm run lint:e2e` checks forbidden sleeps and timeout overrides.

Backend tests cover schemas, HEIC originals, idempotency, stage resumption, profile invalidation, conflicting edits, exact approval and replay. Browser coverage includes partial examples, offline submission/reload, deletion/undo, item/account returns, evidence focus, cross-tab conflicts, appearance changes, offline approval and manual copy. Screenshot baselines are test evidence, not UX designs.

Live previews use the designated Firebase project with real Auth, Firestore, Storage and deployed Functions. They require separate live checks and reviewer Google/phone confirmation. The deployment digest includes rules and every Functions source/lockfile; updating it follows compatibility review. Existing capture contracts remain unchanged, and added paths remain owner-readable/server-authored.

References: [Firebase callable authentication](https://firebase.google.com/docs/functions/callable), [retry semantics](https://firebase.google.com/docs/functions/retries), [Sharp image processing](https://sharp.pixelplumbing.com/api-operation/), [HEIC decoder](https://github.com/catdad-experiments/heic-decode).
