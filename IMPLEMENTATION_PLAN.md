# Vintage v0 implementation plan

Baseline: merged `main` at `24d62b4`, inspected on 2026-09-14; approved flow and generated concepts from PR #8. The existing-screen alignment described below is delivered by the accompanying implementation PR. This document plans the work; unchecked items are not implemented. Update milestone status and link the implementing PRs as work lands.

## Intended outcome

A seller signs in with Google, lands on Your listings, chooses New listing, and takes or selects photos before entering any other information. Anything else? is optional. On first generation, a seller without a ready style supplies existing listing examples, learns their style, and returns to the saved photos to choose Create my draft. A ready style leads directly to generation, editable review, evidence, approval of the exact submitted version, and copying. The draft survives reloads. Every screen follows the device's light/dark appearance using the terracotta and linen glass design.

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
| Application | SvelteKit SPA with Your listings, new/resume photo routes and account controls | Seller examples, learning, generation, review and approved-listing surfaces |
| Appearance | System light/dark, terracotta/linen glass, local fonts, phone/desktop layouts | Apply each new approved concept as its feature ships; verify composited contrast |
| Authentication | Live Google sign-in, sign-out, auth observer and owner isolation | Session-expiry and cross-device recovery hardening |
| Persistence | Owner-scoped descriptors/events, local command outbox and photo bytes, optimistic Firestore writes | Style/generation/approval commands and projections |
| Photos | Capture/picker, JPEG/PNG/WebP/HEIC preview, inspection, replacement, ordering and recovery | Server analysis derivatives, generation readiness and orphan cleanup |
| Review delivery | Live Firebase Auth, Firestore, Storage and PR Hosting previews from milestone 0 | Deploy Functions with server features; continue real phone checks per PR |
| Verification | Four phone/desktop light/dark projects, replay, configuration and owner-rule tests | Extend scenarios to the later pipeline stages |

### Approved flow and delivery boundaries

```text
Sign in → Your listings → New listing → Photos + Anything else?
                                      → Create my draft
                                        ├─ Style ready → Building draft → Review ↔ Evidence
                                        │                               → Approval pending → Approved → Copy
                                        └─ No ready style → Paste examples → Learn style → Back to photos
```

Returning listings resume their saved stage. Photo inspection closes to the editor. Account closes to its invoking screen; example management entered from account returns there. Completing background work must never redirect away from active editing. An unavailable item or route returns to Your listings, with account switching where appropriate.

The accompanying existing-screen alignment uses concepts 05–09 and 14–15: empty and populated home, camera-first entry, compact photo inspection, account identity/privacy/sign-out, quiet offline state, and shared unavailable-link recovery. Listing cards use real photos and counts, and **Untitled item** until an actual title exists. There is no generated identification at capture time.

Milestone 4 adds the working Your listing style row and example screens; milestone 5 adds the working Create my draft action. Do not ship inert buttons, sample listing cards, placeholder style profiles or milestone notices to imitate unfinished portions of a mockup. Preserve the already-approved sign-in and populated photo composition while applying the new surrounding surfaces.

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
| 4. Seller examples and style | 2, 3 for item-return flow | Paste examples, learn style and return to the saved item or account |
| 5. Durable generation using fixtures | 3, 4 | Generate a complete fixed proposal through backend events |
| 6. Review and approval | 5 | Edit, price, approve and copy a complete listing |
| 7. Real generation and pricing | 6; provider/data decisions | Produce and evaluate proposals from real seller inputs |
| 8. Pilot readiness | 7 | Validate and harden the already-deployed complete flow for the pilot |

Milestone 4 builds on the existing photo flow and must preserve the item when entered from generation. Resolve integration questions while building the fixture flow; do not let fixtures conceal missing production capabilities. Milestone 6 is a complete review journey on live Firebase with labelled sample generation, backed by deterministic emulator tests; real AI and market evidence remain milestone 7 work.

## Decisions and dependencies

| Decision | Proposed starting point | Resolve by | Evidence needed |
| --- | --- | --- | --- |
| Seller-history input | Approved: seller pastes their own listing titles and descriptions; one complete example is enough to begin; structured exports are outside this flow | 4 | Validate title/description inline, retain partial edits, allow more examples later; no silent generic personalized draft |
| Market evidence | Adapter with source references, retrieval time, currency, item attributes and available outcomes | 7 | A usable source and representative comparable records; distinguish asking prices from completed sales |
| AI provider/model | Server-side multimodal adapter behind the shared proposal schema | 7 | Trial results on representative items, latency/cost measurements and validated structured output |
| Launch market | One agreed locale and currency for the pilot; retain typed currency in every monetary value | 4 for fixtures, 7 for pilot | Seller market and available comparable coverage; GBP in mockups is illustrative |
| Deployment | Firebase Hosting previews with live Auth, Firestore and Storage; deploy backend changes with each feature PR | 0, before the first implementation PR is ready for review | Project/region/bucket configuration, deployment credentials, preview auth domains, PR isolation strategy and successful cloud read/write/reload |
| Photo limits and HEIC support | Current: up to 8 photos, 10 MB each, JPEG/PNG/WebP/HEIC; browser HEIC display preview; server analysis normalization remains milestone 3 work | 3 | Successful JPEG, PNG, WebP and HEIC uploads, orientation handling, and recoverable invalid-file errors |

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

Foundation and photo behavior landed in [PR #5](https://github.com/anicolao/vintage/pull/5). The approved expanded flow in [PR #8](https://github.com/anicolao/vintage/pull/8) guides the accompanying existing-screen alignment; see [Draft foundation](./docs/DRAFT_FOUNDATION.md) for persistence details.

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

Foundation and photo behavior landed in [PR #5](https://github.com/anicolao/vintage/pull/5). The approved expanded flow in [PR #8](https://github.com/anicolao/vintage/pull/8) guides the accompanying existing-screen alignment; see [Draft foundation](./docs/DRAFT_FOUNDATION.md) for persistence details.

**Done when:** a seller can sign in, create one durable draft, reload its direct URL and resume; repeated actions do not duplicate events; another user cannot read or alter it. Sign-out removes the previous user's state from the UI. Reducer and rule tests demonstrate the ownership and replay contract.

## 3. Photo capture and recovery

Photo entry, uploads, local recovery and optimistic context edits are included in the milestone 1–2 UX correction PR. Server analysis derivatives, orphan cleanup and generation request readiness remain outstanding. The accompanying screen alignment adds cover-photo cards, camera-first empty entry, filmstrip inspection, Make cover, removal with undo, and account/recovery sheets.

- [x] Extend the live Storage setup with the photo repository and owner-scoped photo rules, accepted types and bounded sizes. Deploy these rules with capture; extend automated emulator scripts to include Storage.
- [x] Implement file/camera input, thumbnail progress, image inspection, removal, replacement and accessible reordering. Add optional context and persist edits.
- [x] Upload immutable originals under the designed owner/listing/photo path. Append `photo/uploaded` only after confirmation, recording digest, dimensions, type, byte count and display order.
- [ ] Introduce and deploy Cloud Functions for live photo normalization, with a matching Functions emulator for tests. Preserve originals and create oriented analysis derivatives with stable metadata. Test HEIC decoding rather than relying on browser preview support.
- [x] Define recovery for selected but unfinished files: persist local upload input where supported and request reselection when bytes are unavailable after reload. Preserve acknowledged photos and context in either case; do not promise seamless background upload on mobile.
- [x] Keep navigation and local editing usable during uploads. Show Saved on this phone when offline, retain thumbnails, and offer useful invalid-file replacement and retry actions.
- [ ] Add bounded cleanup for orphaned uploads and analysis derivatives, preserving recoverable local intent.
- [ ] With milestone 5, accept generation intent locally when a usable photo exists. Show Waiting for photos to sync and keep editing/navigation available; server generation starts only after its pinned input photos are durable. Later edits belong to a subsequent input version.

**Done when:** the photo scenario verifies stored objects, thumbnail order and context after reload, recovery from an interrupted upload, removal/replacement, invalid files and keyboard/touch reordering. Storage tests reject cross-user access and invalid uploads. Add replay and isolation assertions now, not only at release.

## 4. Seller examples and style profile

Use concepts 10–11 and the style row in concept 09. Google identity does not supply Vinted history.

- [ ] Implement Your listing style with pasted **Title** and **Description**, **Add another example**, and **Learn my style**. Require at least one complete example; further examples are optional. Persist partial input, validate inline, and support editing/removal with undo.
- [ ] Add the account row with actual example count and readiness. Accept an item-return destination when entered from Create my draft; preserve photos, context and editor position. Account entry returns to account.
- [ ] Normalize source IDs and copy behind the ingestion boundary. Do not require prices, attributes or sales outcomes the input form does not collect. Structured export and automatic history import are not part of this agreed interaction.
- [ ] Persist recoverable requested/progress/completed/failed states and versioned profile/source references. Use idempotent server commands and durable execution reusable by generation.
- [ ] Render real stages: Reading [count] examples, Finding your tone, Saving your style. Show pasted excerpts, not invented imported photographs. No fake percentage or countdown. Allow Back to photos/Back to account while learning continues.
- [ ] On completion offer Continue to photos or Back to account; do not automatically generate or redirect a seller who is editing elsewhere. Changed examples invalidate readiness for the next personalized generation. Offline submission records intent and says Will start when connected.
- [ ] Retain examples on failure and retry without duplicate work. Until real style generation lands, label review-only sample output; never claim a generic draft was written in the seller's style.

**Done when:** live Firebase persists examples and a traceable profile; first-use and account-entry paths return correctly, survive reload and theme changes, and never lose the item. Test one-example validation, editing/removal, offline submission, real progress, retry, and cross-user isolation. A seller without examples can return to photos, but cannot silently receive a supposedly personalized generic draft.

## 5. Durable generation with deterministic fixtures

- [ ] Define a shared runtime schema for proposals, confidence, evidence, prices and model/input versions. Store money consistently with explicit currency and a documented rounding policy.
- [ ] Complete `generateListing` with auth-derived ownership, command ID and expected-version validation. Atomically claim a command and enqueue durable work; closing the browser must not stop processing.
- [ ] Implement durable stages, retries, failure states and stage-specific idempotent event IDs. Handle duplicate requests, stale versions, worker interruption and late results against changed inputs.
- [ ] Pin photo digests, seller-context version, profile version and input fingerprints for every request. Define how a new generation interacts with existing edits and selected price before exposing regeneration.
- [ ] Build `FixtureListingGenerator` using checked-in item photos, seller examples and a complete proposal. Validate it with the production schema; use controlled stages and clocks, not artificial sleeps.
- [ ] Add Create my draft to photo entry: unavailable only when no usable photo exists, with Add a photo to continue. Route a missing/invalidated style to milestone 4 and retain the item; a ready style records generation intent immediately.
- [ ] Render concept 03 progress from subscribed stages, including Waiting for photos to sync, Keep editing and Your listings. Return to the saved stage on reload; completion updates the home card to Ready to review without stealing focus.
- [ ] Show in-place failed-stage recovery with Try again and Back to photos. Before regenerating over edited content, require Replace proposal? with a precise explanation of which edits change. Remove temporary development diagnostics as each phase is completed.
- [ ] Deploy the command handlers/workers for live review and verify cloud persistence and recovery with the labelled sample provider. Separately run Auth, Firestore, Storage and Functions emulators through one owned test command; keep real provider calls out of deterministic E2E.

**Done when:** the live preview progresses to a labelled sample proposal through deployed Functions, and emulator tests produce the exact fixture proposal. Both paths survive reload/browser closure, recover from worker failure and reject stale or unauthorized commands. Repeated delivery produces one logical result. The generation and replay scenarios assert persisted events and projections.

## 6. Review, edit, price and approve

- [ ] Render editable title, description, attributes, condition observations and ordered photos. Show confidence/uncertainty and inspectable photo, history and market evidence.
- [ ] Append edits and price choices durably, show save state/errors, and implement field undo to the latest AI proposal. Specify field conflict handling across tabs/devices.
- [ ] Render the recommended list price, expected sale range, comparable groups and rationale. Provide an accessible price control, evidence sheets and a text alternative to charts.
- [ ] Make chart labels describe the plotted quantity accurately. Expected revenue, sale probability and time to sale are separate measures; do not copy ambiguous mockup axes. Recompute estimates from validated model data when price changes, with unavailable states where unsupported.
- [ ] Record the exact reviewed copy, attributes, photo order and selected price locally as an immutable submitted version, then immediately show Approval pending with navigation available. Sync prerequisites and validate stream version through the server command. Mark Approved only after confirmation; on conflict require review of the newer version, never approve stale content silently.
- [ ] Implement concept 12 evidence sheets with source links, observation dates, asking/sold/estimate distinctions, relevant differences and missing-evidence recovery. Photo/style evidence reuses this sheet with actual photos or pasted excerpts. Close/Escape restore review values, price, scroll position and invoking focus.
- [ ] Implement concept 13 approved-listing access as a read-only snapshot with Ready to copy, approved photo/price, View full listing and Copy listing. Show Copied feedback, or selectable full text when clipboard access fails. Your listings returns home; New listing there opens photos. No automatic publishing.
- [ ] Extend home cards to Creating draft, Ready to review, Approval pending and Approved only when those states exist; resume the actual saved stage.

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
npm run test:domain
npm run test:rules
npm run lint:e2e
npm run build
npm run test:e2e
```

`test:domain`, `test:rules`, `test:config`, `test:hooks`, `check`, `build` and `test:e2e` exist. `lint:e2e` and later pipeline unit suites still need to be added. Use the pinned Nix environment. Add automated E2E wait-policy enforcement with the test infrastructure: no sleeps or timeout delays, and at most 2,000 ms for each in-test action/assertion/wait. Process startup has its own allowance. Fixed stages must advance through observable events; real provider latency is evaluated outside deterministic E2E.

Run browser scenarios against the built SPA with emulator configuration supplied at build time, and separately verify production base paths/deep links. Preserve one worker, no retries, fixed identity/time/fixtures, event-based synchronization, local fonts and zero-pixel screenshot comparisons. Keep baselines for both appearances at 393 × 852 and 1280 × 1000; generate scenario documentation without one project overwriting another's evidence.

The canonical scenario families remain home/appearance, authentication/style, photos, generation, review/approval, reload/replay and isolation. Add theme-switch coverage to states with editable content so value/focus preservation is actually exercised. Each feature PR includes its behavior, relevant rules/domain tests, screenshots and current scenario documentation. Do not postpone user isolation or durable-state assertions until milestone 8.

For every implementation PR, review readiness additionally requires:

- A deployed URL built from the PR revision and connected to live Firebase; record its project ID and backend revision.
- Real Google sign-in/session restoration and cloud persistence checks for the features touched, including reload and Storage round trips once photo capture exists.
- Deployed rules, indexes and Functions required by those features, plus a check that existing live previews remain compatible or isolated.
- A live phone/browser smoke check and results in the PR description. Document sample AI output explicitly until real providers land.
- A verbatim prompt entry staged with every commit, following `AGENTS.md` and the pre-commit hook.

Live smoke checks are a separate verification lane from deterministic emulator E2E and its zero-pixel baselines. Use observable completion and report live latency/failures; never replace a required live check with a passing emulator test. Documentation-only PRs do not provision infrastructure, but every runnable implementation preview must satisfy this delivery contract.

## Next implementation sequence

Complete review of this existing-screen alignment against the generated UX concepts in both appearances. Remaining milestone 3 work is server analysis normalization and orphan cleanup; retain responsive local editing while it lands. Then implement milestone 4's explicit example entry and learning return paths, followed by milestone 5 generation, milestone 6 evidence/approval/copy, and real provider validation in milestone 7. Every runnable PR continues to use live Firebase from its first review deployment.
