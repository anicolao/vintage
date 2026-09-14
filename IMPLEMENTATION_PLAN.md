# Vintage v0 implementation plan

Baseline: merged `main` at `a014f07`, inspected on 2026-09-12. This document plans the work; unchecked items are not implemented. Update milestone status and link the implementing PRs as work lands.

## Intended outcome

A seller signs in with Google, provides existing listing examples, adds item photos and optional context, receives a personalized listing and evidence-based price proposal, edits it, and approves exactly the result shown. The draft survives reloads. Every screen follows the device's light/dark appearance using the terracotta and linen glass design.

The v0 ends with a saved approved listing and a copy action. Publishing directly to Vinted, automatic account linking, and autonomous repricing are outside this plan.

Source documents:

- [Product scope](./README.md) and [vision](./VISION.md)
- [Technical design](./V0_DESIGN.md)
- [UX design and light/dark mockups](./UX_DESIGN.md)
- [E2E contract](./E2E_GUIDE.md)

The mockups guide composition and visual treatment. They are not screenshot baselines, exact colour measurements, or a substitute for the written behavior and accessibility requirements.

## Current implementation

| Area | Present on main | Work remaining |
| --- | --- | --- |
| Application | Static SvelteKit SPA and one home route | All authenticated routes and listing behavior |
| Appearance | Original ivory/plum home screen | Terracotta/linen tokens, glass components, system light/dark response |
| Authentication | Firebase Auth initialized | Google action, auth observer, session and error flows |
| Persistence | Firestore emulator readiness read | Owned streams, schemas, reducers, subscriptions and writes |
| Backend | Auth and Firestore emulator configuration | Storage, Functions, commands, real provider adapters |
| Security | Public read of one readiness document; other access denied | Validated owner access for domain data and photos |
| Tests | One home scenario, phone and desktop light screenshots | Domain/rules tests, complete flow, dark mode, recovery and isolation |
| Delivery | Nix environment, CI checks/E2E, GitHub Pages previews | Backend deployment, environment configuration, production routing and pilot |

The E2E guide describes future capabilities: Storage/Functions orchestration, unit/rules scripts and automated wait-policy enforcement do not yet exist. Current Playwright starts the Vite development server, not a production build. Reconcile documentation with each implemented milestone.

## Live Firebase is required from the first PR

Every implementation PR must provide a deployed, usable preview connected to live Firebase Authentication, Cloud Firestore and Cloud Storage. Reviewers sign in with a real Google account and use durable cloud data. Firebase setup and deployment are the first increment, not a milestone 8 task. Each later PR deploys the rules, indexes and Functions needed for its feature alongside the frontend.

Emulators remain the environment for deterministic automated tests, rules tests and destructive reset/seed operations. They are never the backend of a review preview. Passing emulator tests alone does not make a PR ready for review.

Use a designated live Firebase project for PR review, with production Firebase services and owner-isolated review data. Record the project ID and deployed revision with each preview. Isolate PRs through dedicated projects or a documented compatible-backend strategy so deploying one branch cannot break another preview or change its data contract. Hosting preview channels alone do not isolate Auth, Firestore, Storage, rules or Functions. Never run emulator reset/seed helpers against the live project.

The AI/market integration schedule remains incremental: before milestone 7, a live review deployment may use explicitly labelled sample proposals through a review-only backend provider. Identity, events, files and command execution must still use live Firebase. Arbitrary uploads must not be presented as genuinely analyzed when only sample output exists. Final seller-facing builds reject sample providers.

## Delivery sequence

Each milestone is a reviewable increment; split it into smaller PRs when necessary. Security and tests ship with the data or behavior they protect.

| Milestone | Depends on | Demonstrable result |
| --- | --- | --- |
| 0. Live Firebase and PR delivery | Existing home | Deployed preview supports real Google sign-in and durable cloud storage |
| 1. Appearance and shared controls | 0 | Live preview follows system appearance with the approved palette |
| 2. Identity and durable draft foundation | 1 | Sign in, create a draft, reload and resume it |
| 3. Photo capture | 2 | Store, order and recover photos and optional context |
| 4. Seller examples and style | 2; history-input decision | Persist examples and a traceable style profile |
| 5. Durable generation using fixtures | 3, 4 | Generate a complete fixed proposal through backend events |
| 6. Review and approval | 5 | Edit, price, approve and copy a complete listing |
| 7. Real generation and pricing | 6; provider/data decisions | Produce and evaluate proposals from real seller inputs |
| 8. Pilot readiness | 7 | Validate and harden the already-deployed complete flow for the pilot |

Milestones 3 and 4 can proceed independently after 2. Resolve integration questions while building the fixture flow; do not let fixtures conceal missing production capabilities. Milestone 6 is a complete review journey on live Firebase with labelled sample generation, backed by deterministic emulator tests; real AI and market evidence remain milestone 7 work.

## Decisions and dependencies

| Decision | Proposed starting point | Resolve by | Evidence needed |
| --- | --- | --- | --- |
| Seller-history input | Seller pastes titles/descriptions or uploads a documented structured export; normalize behind an ingestion adapter | 4 | A real seller can supply representative examples; agreed format and empty-history experience |
| Market evidence | Adapter with source references, retrieval time, currency, item attributes and available outcomes | 7 | A usable source and representative comparable records; distinguish asking prices from completed sales |
| AI provider/model | Server-side multimodal adapter behind the shared proposal schema | 7 | Trial results on representative items, latency/cost measurements and validated structured output |
| Launch market | One agreed locale and currency for the pilot; retain typed currency in every monetary value | 4 for fixtures, 7 for pilot | Seller market and available comparable coverage; GBP in mockups is illustrative |
| Deployment | Firebase Hosting previews with live Auth, Firestore and Storage; deploy backend changes with each feature PR | 0, before the first implementation PR is ready for review | Project/region/bucket configuration, deployment credentials, preview auth domains, PR isolation strategy and successful cloud read/write/reload |
| Photo limits and HEIC support | Explicit file/count limits and server normalization; validate chosen decoder with phone fixtures | 3 | Successful JPEG, PNG, WebP and HEIC uploads, orientation handling, and recoverable invalid-file errors |

Google login establishes Vintage identity; it does not supply Vinted history. Update onboarding copy with the chosen import mechanism before milestone 4. Do not claim an import is occurring without seller input or an implemented integration.

If market outcomes or demand signals cannot support sale probabilities, expected revenue or time-to-sale estimates, show unavailable/insufficient evidence states. Do not invent comparables or render fixture estimates as real analysis. Narrowing the v0 pricing promise requires an explicit product decision and corresponding design update.

## 0. Live Firebase and PR delivery

- [x] Configure the designated live Firebase project, web app, Google authentication provider, Firestore database and Storage bucket. Record project/region configuration and required deployment credentials without committing backend secrets.
- [x] Add explicit live and emulator configurations. A review build must use live Firebase endpoints and fail on missing configuration; remove silent preview-key/readiness fallbacks from that path. E2E authentication and emulator switches must be excluded from live review builds.
- [x] Wire real Google sign-in, sign-out and session restoration on the existing home. Add a minimal owned workspace document, authenticated Firestore reads/writes and narrowly scoped Storage access; no public data-write rules. Milestone 2 extends this foundation into domain event streams.
- [x] Create the Firebase Hosting PR deployment workflow, authorized sign-in domains and SPA route rewrites. Select an isolation strategy before deploying shared backend changes. Include rules/index/backend deployment and a preview URL tied to the PR revision; a static-only Pages preview does not satisfy this gate.
- [x] Install the initial owner rules for Firestore and Storage, and add emulator tests proving both permitted owner operations and rejected cross-user operations before deploying them. Enable later domain paths only when their validation ships.
- [x] Add the environment example and repeatable live smoke-check procedure, using production photo upload and readback.
- [ ] Complete the deployed real Google sign-in and second-account phone smoke check, including workspace write/read after reload and an owned Storage upload/download.
- [x] Define PR-specific review-data cleanup and backend rollback/compatibility procedures. Reviewers must be able to return to the same preview without a local emulator or developer workstation running.

Initial implementation and cloud provisioning were included in [PR #3](https://github.com/anicolao/vintage/pull/3). Automated rules/browser checks pass. The live preview reached the real Google OAuth popup, and the reviewer confirmed an authenticated Storage upload/read/delete on their phone at revision `2f3f7ad` on 2026-09-12: “File uploaded, read back, and deleted successfully.” Explicit confirmation of note persistence after reload and the second-account phone check remains a review gate; see [Firebase setup](./docs/FIREBASE_SETUP.md).

**Done when:** the first implementation PR has a reachable deployed URL, real Google login/session restoration, a verified owner-scoped Firestore round trip and Storage upload/download, and deployed rules that reject another user's access. Its review notes identify the cloud project and revision and include live smoke-check results. This is the prerequisite for all subsequent implementation PRs.

## 1. System appearance and shared controls

- [x] Extract global layout and design tokens from `src/routes/+page.svelte` into shared styles and components.
- [x] Implement light/dark tokens using the system colour-scheme preference from first paint, including native controls. Respond to live system changes without reload or an in-app theme switch.
- [x] Use linen `#F7F0E6`, warm charcoal `#2B2521`, and rust `#984831` in light mode; warm charcoal `#211C19`, linen text, and apricot `#EDB59B` in dark mode. Keep sage for secondary evidence/completion details.
- [x] Build glass cards, buttons, inputs, chips and status treatments with readable opacity, restrained clay/sand glows, visible focus and solid-surface fallbacks. Cover unavailable blur, reduced transparency and reduced motion.
- [x] Keep item photography untinted. Use real UI elements and approved assets, not mockup screenshots as application backgrounds.
- [x] Extend Playwright to phone-light, phone-dark, desktop-light and desktop-dark projects; preserve the existing pinned renderer and zero-pixel threshold.

Production UI corrections and current acceptance evidence are tracked in [Draft foundation](./docs/DRAFT_FOUNDATION.md).

**Done when:** the live Firebase preview still passes sign-in and persistence checks, and the home screen matches the approved visual direction in all four projects; keyboard focus survives an appearance change; text, focus and controls meet the UX contrast/touch-target requirements; fallback surfaces remain usable. Review intentional screenshots before committing them.

## 2. Identity and durable draft foundation

- [x] Separate Firebase initialization, auth state, repositories, event contracts and projections under `src/lib/`; routes render projections and dispatch typed actions.
- [x] Extend the live Google authentication from milestone 0 with cancellation/retry and blocked-popup handling as appropriate. Resolve auth before selecting the sign-in or resume route; detach old subscriptions on account changes.
- [x] Add a deterministic emulator identity using the same auth-observer path. Reject test authentication unless the build is explicitly E2E and every backend endpoint is local.
- [x] Implement current-version event validation, ordering, deduplication, pure reducers and diagnostics. Test acknowledged versus pending timestamps, repeated IDs, unknown events and malformed payloads; reject unsupported schemas.
- [x] Persist stable device identity and allocate client sequences safely across tabs. Make retry delivery idempotent and pending/rejected writes visible.
- [x] Create owner-scoped account and listing descriptors and event streams atomically where needed; add subscriptions and new/resume routes. Define the listing version used by later commands so it covers every relevant write.
- [x] Introduce owner/envelope/payload validation in Firestore rules. Deny cross-user access, event updates/deletes and client-authored privileged events. Add rules tests with both allowed and rejected operations.
- [x] Add the domain unit-test runner and extend milestone 0 rules tests and CI. Keep live review/production configuration separate from emulator tests; deploy new domain rules and indexes with this PR.
- [x] Extend milestone 0 routing to the live draft routes; a direct reload of `/listings/[id]` must serve the SPA and restore the cloud-backed draft.

Production UI corrections and current acceptance evidence are tracked in [Draft foundation](./docs/DRAFT_FOUNDATION.md).

**Done when:** a seller can sign in, create one durable draft, reload its direct URL and resume; repeated actions do not duplicate events; another user cannot read or alter it. Sign-out removes the previous user's state from the UI. Reducer and rule tests demonstrate the ownership and replay contract.

## 3. Photo capture and recovery

Photo entry, uploads, local recovery and optimistic context edits are included in the milestone 1–2 UX correction PR. Server analysis derivatives and generation gating remain outstanding.

- [x] Extend the live Storage setup with the photo repository and owner-scoped photo rules, accepted types and bounded sizes. Deploy these rules with capture; extend automated emulator scripts to include Storage.
- [x] Implement file/camera input, thumbnail progress, image inspection, removal, replacement and accessible reordering. Add optional context and persist edits.
- [x] Upload immutable originals under the designed owner/listing/photo path. Append `photo/uploaded` only after confirmation, recording digest, dimensions, type, byte count and display order.
- [ ] Introduce and deploy Cloud Functions for live photo normalization, with a matching Functions emulator for tests. Preserve originals and create oriented analysis derivatives with stable metadata. Test HEIC decoding rather than relying on browser preview support.
- [x] Define recovery for selected but unfinished files: persist local upload input where supported and request reselection when bytes are unavailable after reload. Preserve acknowledged photos and context in either case; do not promise seamless background upload on mobile.
- [ ] Handle navigation during active uploads, failures, retries and orphaned uploads. Prevent generation until at least one valid photo exists and all selected photos are durably ready.

**Done when:** the photo scenario verifies stored objects, thumbnail order and context after reload, recovery from an interrupted upload, removal/replacement, invalid files and keyboard/touch reordering. Storage tests reject cross-user access and invalid uploads. Add replay and isolation assertions now, not only at release.

## 4. Seller examples and style profile

- [ ] Implement the agreed seller-input flow and normalize examples with source IDs, copy, attributes, currency, price and available outcomes. Define import bounds, validation, duplicate handling and replacement behavior.
- [ ] Extend the event schema with explicit recoverable import failure/retry states. Persist requested/progress/completed states and the versioned style profile with its source references.
- [ ] Use an idempotent server command for ingestion/profile production; establish command claiming and durable work execution for reuse in generation.
- [ ] Implement the learning screen and resume behavior on live Firebase. Use deterministic examples/profile output in emulator tests; until real style generation lands, label any review-only sample profile clearly and persist it through deployed commands.
- [ ] Define empty-history behavior: ask for examples or offer a clearly identified generic draft if accepted as a product adjustment. Never label a generic draft as written in the seller's established style.

**Done when:** supplied examples produce a persisted traceable profile, progress survives reload, retry does not duplicate work, and the UI transitions to capture. Extend the authentication/style scenario and prove another account cannot access the examples or profile.

## 5. Durable generation with deterministic fixtures

- [ ] Define a shared runtime schema for proposals, confidence, evidence, prices and model/input versions. Store money consistently with explicit currency and a documented rounding policy.
- [ ] Complete `generateListing` with auth-derived ownership, command ID and expected-version validation. Atomically claim a command and enqueue durable work; closing the browser must not stop processing.
- [ ] Implement durable stages, retries, failure states and stage-specific idempotent event IDs. Handle duplicate requests, stale versions, worker interruption and late results against changed inputs.
- [ ] Pin photo digests, seller-context version, profile version and input fingerprints for every request. Define how a new generation interacts with existing edits and selected price before exposing regeneration.
- [ ] Build `FixtureListingGenerator` using checked-in item photos, seller examples and a complete proposal. Validate it with the production schema; use controlled stages and clocks, not artificial sleeps.
- [ ] Render progress from subscribed events with live status announcements and recoverable errors. Add a development-only event inspector and redacted fixture export.
- [ ] Deploy the command handlers/workers for live review and verify cloud persistence and recovery with the labelled sample provider. Separately run Auth, Firestore, Storage and Functions emulators through one owned test command; keep real provider calls out of deterministic E2E.

**Done when:** the live preview progresses to a labelled sample proposal through deployed Functions, and emulator tests produce the exact fixture proposal. Both paths survive reload/browser closure, recover from worker failure and reject stale or unauthorized commands. Repeated delivery produces one logical result. The generation and replay scenarios assert persisted events and projections.

## 6. Review, edit, price and approve

- [ ] Render editable title, description, attributes, condition observations and ordered photos. Show confidence/uncertainty and inspectable photo, history and market evidence.
- [ ] Append edits and price choices durably, show save state/errors, and implement field undo to the latest AI proposal. Specify field conflict handling across tabs/devices.
- [ ] Render the recommended list price, expected sale range, comparable groups and rationale. Provide an accessible price control, evidence sheets and a text alternative to charts.
- [ ] Make chart labels describe the plotted quantity accurately. Expected revenue, sale probability and time to sale are separate measures; do not copy ambiguous mockup axes. Recompute estimates from validated model data when price changes, with unavailable states where unsupported.
- [ ] Flush pending edits before approval. Validate the stream version and write one immutable approval containing the exact resolved copy, attributes, photo order and selected price; use a server command if needed to enforce the consistency boundary.
- [ ] Implement success, copy-listing feedback/fallback, approved-listing access and a new-item action. Define approved listings as immutable snapshots.

**Done when:** the reviewer can complete the entire sample journey on live Firebase, and the deterministic fixture journey passes in emulators. The approval test compares the payload to the values actually displayed, then reloads and verifies the same result. Failed saves, concurrent edits and double approval cannot silently approve stale data. Keyboard operation, focus in evidence sheets, both themes and copy behavior are verified.

## 7. Real providers and pricing validation

- [ ] Implement the chosen history/style and multimodal providers behind the existing contracts. Keep credentials in backend configuration; bound inputs, runtime, retry counts and spend per command.
- [ ] Validate every provider response, retain prompt/model/schema versions and evidence fingerprints, and expose actionable errors. Missing/uncertain attributes remain reviewable rather than fabricated.
- [ ] Implement the agreed market adapter with provenance, freshness, relevance weighting and deduplication. Separate asking prices, observed sales and modeled estimates; account for currency and condition differences.
- [ ] Define the pricing objective's time horizon, negotiation treatment and meaning of sale probability/expected revenue. Show the recommendation, range and supporting evidence only to the extent the available data supports them.
- [ ] Evaluate on representative held-out seller examples and item photos, including labels, defects, unknown brands and sparse comparables. Record attribute errors, seller-style editing, price rationale quality, latency and per-draft cost.
- [ ] Agree pilot acceptance thresholds before evaluation and record results. Fixture success alone cannot satisfy these gates; unsupported pricing estimates remain a release dependency.

**Done when:** real inputs produce schema-valid proposals with traceable evidence; sellers can assess uncertainty and approve useful drafts; latency, cost and quality meet the agreed thresholds. Provider/network failure leaves the draft recoverable. Seller-facing production builds cannot select a fixture/sample provider; any earlier review-only sample configuration is removed before pilot.

## 8. Pilot readiness and delivery

- [ ] Audit and harden the live deployment already delivered from milestone 0 onward: rules, indexes, Storage, Functions, hosting, Google sign-in domains, direct-route reloads and returning sessions. Rehearse promotion to the pilot environment using the established deployment workflow.
- [ ] Exercise the complete flow in a staging environment with a real Google account, actual phone photos and real providers. Check phone Safari and Chrome as well as canonical Chromium screenshots.
- [ ] Complete recovery coverage across capture, generation, review and approval, including connectivity loss, session expiry, account switching and system-theme changes.
- [ ] Verify accessibility in both appearances: contrast on composited glass, keyboard flow, screen-reader announcements, zoom/text scaling, reduced motion and solid-surface fallbacks.
- [ ] Complete operational logs using correlation IDs and durations, avoiding raw item copy/photos in logs. Extend the existing deployment/rollback procedure with failed-command investigation, retry and backward-compatible event/schema changes.
- [ ] Instrument time to approved draft, approval rate, edits, price acceptance and generation failures/cost. Track realized sale outcomes only when reported or obtained from an implemented source.
- [ ] Refresh setup instructions and the E2E guide to match the actual scripts, environment, fixture boundaries and deployment. Record remaining limitations and pilot feedback.

**Done when:** all v0 acceptance criteria have evidence, the complete real flow passes staging checks, and the pilot has documented quality/cost thresholds and an operational recovery path. Broader revenue improvement remains a measured outcome, not a claim established by the first release.

## Verification and PR completion

As the corresponding runners land, required CI commands become:

```sh
npm run check
npm run test:hooks
npm run test:unit
npm run test:rules
npm run lint:e2e
npm run build
npm run test:e2e
```

`test:unit`, `test:rules` and `lint:e2e` must be added; they are not current commands. Use the pinned Nix environment. Add automated E2E wait-policy enforcement with the test infrastructure: no sleeps or timeout delays, and at most 2,000 ms for each in-test action/assertion/wait. Process startup has its own allowance. Fixed stages must advance through observable events; real provider latency is evaluated outside deterministic E2E.

Run browser scenarios against the built SPA with emulator configuration supplied at build time, and separately verify production base paths/deep links. Preserve one worker, no retries, fixed identity/time/fixtures, event-based synchronization, local fonts and zero-pixel screenshot comparisons. Keep baselines for both appearances at 393 × 852 and 1280 × 1000; generate scenario documentation without one project overwriting another's evidence.

The canonical scenario families remain home/appearance, authentication/style, photos, generation, review/approval, reload/replay and isolation. Add theme-switch coverage to states with editable content so value/focus preservation is actually exercised. Each feature PR includes its behavior, relevant rules/domain tests, screenshots and current scenario documentation. Do not postpone user isolation or durable-state assertions until milestone 8.

For every implementation PR, review readiness additionally requires:

- A deployed URL built from the PR revision and connected to live Firebase; record its project ID and backend revision.
- Real Google sign-in/session restoration and cloud persistence checks for the features touched, including reload and Storage round trips once photo capture exists.
- Deployed rules, indexes and Functions required by those features, plus a check that existing live previews remain compatible or isolated.
- A live phone/browser smoke check and results in the PR description. Document sample AI output explicitly until real providers land.
- A verbatim prompt entry staged with every commit, following `AGENTS.md` and the pre-commit hook.

Live smoke checks are a separate verification lane from deterministic emulator E2E and its zero-pixel baselines. Use observable completion and report live latency/failures; never replace a required live check with a passing emulator test. Documentation-only PRs such as this plan do not provision infrastructure, but every runnable implementation preview must satisfy this delivery contract.

## First implementation PR

Start with milestone 0: a deployed PR preview of the existing home with working Google login, live Firestore persistence, verified Cloud Storage access and deployed owner rules. Establish the deployment and live smoke-check contract in that PR. Then deliver the terracotta/linen themes in milestone 1 and durable listing behavior in milestone 2; both must remain usable against the same live Firebase service contract.
