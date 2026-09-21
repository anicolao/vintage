# Vintage v0 implementation plan

Baseline: merged `main` at `0a61360`, inspected on 2026-09-14. [PR #11](https://github.com/anicolao/vintage/pull/11) contains photo processing, real generation, language feedback, review and approval using the approved visual system. Real generation and language feedback replace the sample path; market estimates and full provider evaluation remain outstanding; device review gates are listed separately below.

## Intended outcome

A seller signs in with Google, lands on Your listings, chooses New listing, and takes or selects photos before entering any other information. Anything else? is optional. Create my draft goes directly to generation and editable review. Optional language feedback revises the current draft and is remembered for future listings. Photo entry and review both offer Save draft. Review leads to evidence, exact approval and copying. Approved listings can be reopened for editing with fresh approval required, or duplicated into independent drafts. The draft survives reloads. Every screen follows the device's light/dark appearance using the terracotta and linen glass design.

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
| Application | Sign-in, listings, photos, real generation, language feedback, review/evidence and approved copy | Pilot recovery and real-provider validation |
| Appearance | System light/dark, terracotta/linen glass, local fonts, phone/desktop layouts | Apply each new approved concept as its feature ships; verify composited contrast |
| Authentication | Live Google sign-in, sign-out, auth observer and owner isolation | Session-expiry and cross-device recovery hardening |
| Persistence | Capture and workflow events, optimistic IndexedDB command queues, transactional feedback/generation/approval handlers | Operational pilot hardening |
| Photos | Capture/recovery plus oriented server derivatives, HEIC decoding, pinned generation inputs and bounded orphan cleanup | Real-provider photo evaluation |
| Review delivery | Live Firebase Auth, Firestore, Storage and PR Hosting previews from milestone 0 | Deploy Functions with server features; continue real phone checks per PR |
| Verification | Four phone/desktop light/dark projects, replay, configuration and owner-rule tests | Extend scenarios to the later pipeline stages |

### Approved flow and delivery boundaries

```text
Sign in → Your listings → New listing → Photos + Anything else?
                                      → Create my draft
                                        → Building draft → Review ↔ Evidence
                                                          ↔ Language feedback
                                                          → Approval pending → Approved → Copy
```

Save draft from Photos or Review returns to Your listings. Edit listing moves Approved back to Review and requires fresh approval. Duplicate listing opens a separate saved Review draft with independent photos. Returning listings resume their saved stage. Photo inspection closes to the editor. Account closes to its invoking screen. Completing background work must never redirect away from active editing. An unavailable item or route returns to Your listings, with account switching where appropriate.

The accompanying existing-screen alignment uses concepts 05–09 and 14–15: empty and populated home, camera-first entry, compact photo inspection, account identity/privacy/sign-out, quiet offline state, and shared unavailable-link recovery. Listing cards use real photos and counts, and **Untitled item** until an actual title exists. There is no generated identification at capture time.

Milestone 4 adds language feedback within review. No separate setup screen, inert button, sample listing or placeholder profile is part of the product. Preserve the approved visual system while applying the new interaction.

## Live Firebase is required from the first PR

Every implementation PR must provide a deployed, usable preview connected to live Firebase Authentication, Cloud Firestore and Cloud Storage. Reviewers sign in with a real Google account and use durable cloud data. Firebase setup and deployment are the first increment, not a milestone 8 task. Each later PR deploys the rules, indexes and Functions needed for its feature alongside the frontend.

Emulators remain the environment for deterministic automated tests, rules tests and destructive reset/seed operations. They are never the backend of a review preview. Passing emulator tests alone does not make a PR ready for review.

Use a designated live Firebase project for PR review, with production Firebase services and owner-isolated review data. Record the project ID and deployed revision with each preview. Isolate PRs through dedicated projects or a documented compatible-backend strategy so deploying one branch cannot break another preview or change its data contract. Hosting preview channels alone do not isolate Auth, Firestore, Storage, rules or Functions. Never run emulator reset/seed helpers against the live project.

Live review builds must execute real generation and feedback revisions. Fixtures are confined to isolated tests; no deployed sample provider or invented recommendation is acceptable.

## Delivery sequence

Each milestone is a reviewable increment; split it into smaller PRs when necessary. Security and tests ship with the data or behavior they protect.

| Milestone | Depends on | Demonstrable result |
| --- | --- | --- |
| 0. Live Firebase and PR delivery | Existing home | Deployed preview supports real Google sign-in and durable cloud storage |
| 1. Appearance and shared controls | 0 | Live preview follows system appearance with the approved palette |
| 2. Identity and durable draft foundation | 1 | Sign in, create a draft, reload and resume it |
| 3. Photo capture | 2 | Store, order and recover photos and optional context |
| 4. Language feedback | 2, 3, 5 | Revise actual wording and remember instructions |
| 5. Real photo generation | 3 | Generate a proposal from actual photos and context |
| 6. Review and approval | 5 | Edit, price, approve and copy a complete listing |
| 7. Market pricing and provider evaluation | 6; data decisions | Evidence-backed pricing and measured model quality |
| 8. Pilot readiness | 7 | Validate and harden the already-deployed complete flow for the pilot |

Language feedback is optional during review; generation has no style setup prerequisite. Live previews call the real provider. Deterministic model responses are isolated to automated tests. Market pricing and broader quality evaluation remain outstanding.

## Decisions and dependencies

| Decision | Proposed starting point | Resolve by | Evidence needed |
| --- | --- | --- | --- |
| Language preferences | Explicit feedback during draft review, remembered across listings | 4 | Apply real revisions; retain edits on conflict; allow forgetting instructions |
| Market evidence | Adapter with source references, retrieval time, currency, item attributes and available outcomes | 7 | A usable source and representative comparable records; distinguish asking prices from completed sales |
| AI provider/model | Vertex AI Gemini via the runtime service account; structured output validated server-side | 5; broader evaluation in 7 | Live photo/revision smoke checks plus representative quality, latency and cost evaluation |
| Launch market | One agreed locale and currency for the pilot; retain typed currency in every monetary value | 6 for manual entry, 7 for pilot | Seller market and available comparable coverage; GBP in mockups is illustrative |
| Deployment | Firebase Hosting previews with live Auth, Firestore and Storage; deploy backend changes with each feature PR | 0, before the first implementation PR is ready for review | Project/region/bucket configuration, deployment credentials, preview auth domains, PR isolation strategy and successful cloud read/write/reload |
| Photo limits and HEIC support | Current: up to 8 photos, 10 MB each, JPEG/PNG/WebP/HEIC; browser HEIC display preview; server analysis normalization remains milestone 3 work | 3 | Successful JPEG, PNG, WebP and HEIC uploads, orientation handling, and recoverable invalid-file errors |

Google login establishes Vintage identity; it does not supply Vinted history. There is no history import or style onboarding. Preferences come from explicit review feedback.

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

Photo entry and the expanded screen alignment landed in PRs #5 and #9. This increment adds server JPEG analysis derivatives (including original HEIC decoding), generation input pinning and conservative cleanup of unreferenced objects older than 30 days. Referenced originals and derivatives remain available for replay and Undo.

- [x] Extend the live Storage setup with the photo repository and owner-scoped photo rules, accepted types and bounded sizes. Deploy these rules with capture; extend automated emulator scripts to include Storage.
- [x] Implement file/camera input, thumbnail progress, image inspection, removal, replacement and accessible reordering. Add optional context and persist edits.
- [x] Upload immutable originals under the designed owner/listing/photo path. Append `photo/uploaded` only after confirmation, recording digest, dimensions, type, byte count and display order.
- [x] Introduce and deploy Cloud Functions for live photo normalization, with a matching Functions emulator for tests. Preserve originals and create oriented analysis derivatives with stable metadata. Test HEIC decoding rather than relying on browser preview support.
- [x] Define recovery for selected but unfinished files: persist local upload input where supported and request reselection when bytes are unavailable after reload. Preserve acknowledged photos and context in either case; do not promise seamless background upload on mobile.
- [x] Keep navigation and local editing usable during uploads. Show Saved on this phone when offline, retain thumbnails, and offer useful invalid-file replacement and retry actions.
- [x] Add bounded cleanup for orphaned uploads and analysis derivatives, preserving recoverable local intent.
- [x] With milestone 5, accept generation intent locally when a usable photo exists. Show Waiting for photos to sync and keep editing/navigation available; server generation starts only after its pinned input photos are durable. Later edits belong to a subsequent input version.

**Done when:** the photo scenario verifies stored objects, thumbnail order and context after reload, recovery from an interrupted upload, removal/replacement, invalid files and keyboard/touch reordering. Storage tests reject cross-user access and invalid uploads. Add replay and isolation assertions now, not only at release.

## 4. Language feedback without onboarding

The seller reaches generation directly from photos. Example ingestion, a learned profile and a style-readiness gate are removed. Language preferences come from feedback on the actual draft.

- [x] Remove the example form, learning route, account readiness row, learning worker, obsolete rules and tests.
- [x] Add optional **How should it sound?** feedback beside review copy, with **Apply feedback** and an explanation that it applies now and to future listings.
- [x] Persist feedback intent locally, synchronize to owner-scoped Firebase language instructions, and allow forgetting remembered instructions.
- [x] Pin current wording and remembered instructions for real server-side revisions. Change title/description only; preserve photos, attributes and price. Retain newer manual edits when a response arrives late.
- [x] Keep work/navigation available while revision is pending. Failures preserve copy and remembered instructions, with retry.

**Done when:** feedback causes an actual language revision, remembered instructions are supplied to later drafts, and reload/offline/conflict/ownership tests pass. Live-provider evidence is required separately from deterministic browser tests.

## 5. Real photo generation

- [x] Remove the shipped fixture generator and fixed proposal entirely. Deployed Functions call Vertex AI with the pinned normalized photos, context and remembered language instructions.
- [x] Validate returned copy, uncertainty and photo references. Record actual model/prompt/input provenance. Unknown attributes stay empty; no made-up defaults or price.
- [x] Retain durable command IDs, ownership/version checks, bounded retries, worker leases and saved results. Derivative preparation and model completion drive actual stages.
- [x] Use a test HTTP provider only from an explicit local Functions emulator build. Its implementation lives under tests and is never deployed.
- [ ] Complete representative seller-item quality, latency and cost evaluation beyond live smoke checks.

## 6. Review, saved drafts and approval lifecycle

- [x] Render editable real proposal copy, uncertain attributes and photo observations tied to input IDs.
- [x] Support language revisions and remembered instructions, durable manual edits, conflict recovery and exact immutable approval/copy.
- [x] Add Save draft to photo entry and review. Retain incomplete copy and optional price, persist on the device before returning home, and resume the saved stage.
- [x] Reopen an approved listing for editing without creating another item. Withdraw current approval while preserving the historical event; require a fresh exact approval before copying.
- [x] Duplicate an approved listing into an independent unapproved draft with its copy, attributes, price, context and ordered photos. Copy immutable Storage objects into the new listing namespace; atomically publish the descriptor, capture events and workflow.
- [x] Persist reopen/duplicate/save intent locally and project it immediately. Queue duplicate-dependent edits until its server stream exists; enforce ownership, original-version checks and command idempotency.
- [x] Retain acknowledged workflow versions on the device before retiring queue entries, so immediate reload cannot use a stale Firestore cache version. Preload navigation modules for offline return from a deep link.
- [x] Remove the fabricated £48 recommendation. Require a seller-entered GBP asking price before approval; do not imply it is a valuation.
- [ ] Implement market-backed recommendation, comparable groups, source dates and links, sale ranges and supported estimates. The earlier checked-off sample views did not deliver these capabilities.
- [ ] Complete a real-phone review of feedback, Save draft, Edit listing and Duplicate listing in both appearances, including offline recovery. Automated browser/transaction checks do not replace this gate.

## 7. Market pricing and provider evaluation

- [ ] Agree pilot market/currency and usable market sources. GBP is the currently supported manual entry currency, not an inferred market selection.
- [ ] Implement market retrieval with provenance, freshness, relevance and deduplication. Distinguish asking, sold and modelled values.
- [ ] Validate estimates before rendering sale probability, expected revenue or time to sale. Genuine missing evidence stays unavailable; fixed estimates are prohibited.
- [ ] Evaluate real multimodal proposals and language revisions on representative items, ambiguous labels, adversarial context, conflicting feedback and missing information.
- [ ] Define operational spend limits, latency/quality targets and monitoring for the pilot.

## 8. Pilot readiness and delivery

- [ ] Audit and harden the live deployment already delivered from milestone 0 onward: rules, indexes, Storage, Functions, hosting, Google sign-in domains, direct-route reloads and returning sessions. Rehearse promotion to the pilot environment using the established deployment workflow.
- [ ] Exercise the complete flow in a staging environment with a real Google account, actual phone photos and real providers. Check phone Safari and Chrome as well as canonical Chromium screenshots.
- [ ] Complete recovery coverage across capture, generation, review and approval, including saved drafts, re-approval, duplicate independence, connectivity loss, session expiry, account switching and system-theme changes.
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

`test:domain`, `test:rules`, `test:config`, `test:hooks`, `check`, `build` and `test:e2e` exist. `lint:e2e` and `test:pipeline` now enforce the wait policy and verify proposal/command/replay contracts. Use the pinned Nix environment. Add automated E2E wait-policy enforcement with the test infrastructure: no sleeps or timeout delays, and at most 2,000 ms for each in-test action/assertion/wait. Process startup has its own allowance. Fixed stages must advance through observable events; real provider latency is evaluated outside deterministic E2E.

Run browser scenarios against the built SPA with emulator configuration supplied at build time, and separately verify production base paths/deep links. Preserve one worker, no retries, fixed identity/time/fixtures, event-based synchronization, local fonts and zero-pixel screenshot comparisons. Keep baselines for both appearances at 393 × 852 and 1280 × 1000; generate scenario documentation without one project overwriting another's evidence.

The canonical scenario families remain home/appearance, authentication/feedback, photos, generation, review/approval, reload/replay and isolation. Add theme-switch coverage to states with editable content so value/focus preservation is actually exercised. Each feature PR includes its behavior, relevant rules/domain tests, screenshots and current scenario documentation. Do not postpone user isolation or durable-state assertions until milestone 8.

For every implementation PR, review readiness additionally requires:

- A deployed URL built from the PR revision and connected to live Firebase; record its project ID and backend revision.
- Real Google sign-in/session restoration and cloud persistence checks for the features touched, including reload and Storage round trips once photo capture exists.
- Deployed rules, indexes and Functions required by those features, plus a check that existing live previews remain compatible or isolated.
- A live phone/browser smoke check and results in the PR description. Distinguish actual provider smoke checks from deterministic test-provider checks.
- A verbatim prompt entry staged with every commit, following `AGENTS.md` and the pre-commit hook.

Live smoke checks are a separate verification lane from deterministic emulator E2E and its zero-pixel baselines. Use observable completion and report live latency/failures; never replace a required live check with a passing emulator test. Documentation-only PRs do not provision infrastructure, but every runnable implementation preview must satisfy this delivery contract.

## Next implementation sequence

Review the photo-first real generation and language-feedback journey on live Firebase. Next implement evidence-backed pricing and complete representative provider evaluation, then the remaining device and operational gates.
