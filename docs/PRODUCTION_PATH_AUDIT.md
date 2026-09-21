# Production path audit

Updated 2026-09-21 for [PR #11](https://github.com/anicolao/vintage/pull/11). This report separates removed fakery from remaining product capabilities. The [original audit at `7808cb1`](https://github.com/anicolao/vintage/blob/201be0a/docs/PRODUCTION_PATH_AUDIT.md) recorded the fixed generator before its replacement; its source locations describe that historical code, not the current branch.

The deployed runtime now calls Vertex AI with actual normalized photos, context and remembered language feedback. Fixed jacket copy, the £48 recommendation, style onboarding and sample-only contracts have been removed. Pricing remains manual GBP entry: market retrieval, valuation and sale estimates are still absent. The new draft and approved-listing lifecycle uses real device persistence, Firebase commands and independent Storage files.

## Status of the original findings

P0 denotes a missing capability that blocks the planned complete product; P1 denotes configuration, presentation or validation work. A removed fabricated result does not mean its intended capability has been delivered.

| ID | Current status | Evidence and remaining work |
| --- | --- | --- |
| 1 / P0: fixture provider | Removed | [generator.mjs](../functions/generator.mjs) calls Vertex AI. No deployed JSON fixture or sample provider remains. |
| 2 / P0: fixed item copy | Replaced | Real photo-dependent copy and explicit unknown attributes are validated. Restore suggestion uses the actual model proposal. Representative item-quality evaluation remains open. |
| 3 / P0: fake style learning | Removed | No example setup, learned-profile claim or readiness gate. Explicit language feedback revises the current wording and is remembered for later requests, with Forget controls. |
| 4 / P0: fixed uncertainty | Replaced; evaluation open | Validated model confidence and observations are rendered with actual input photo IDs. Model confidence is subjective, not calibrated accuracy; do not present it as such. |
| 5 / P0: fixed £48 price | Removed | Price starts empty and is seller-entered. Saving a draft permits no price; approval requires a valid positive GBP price. No recommended valuation is claimed. |
| 6 / P0: market evidence and estimates | **Open** | No asking/sold comparable retrieval, source freshness/relevance calculation, sale ranges, probabilities, expected revenue or time-to-sale model. The eBay investigation scripts on main are research tools, not a connected product pricing path. |
| 7 / P0: unrelated evidence IDs | Photo path replaced; market evidence open | The real generator receives pinned image bytes and returns validated photo references. Review shows its observations and the real photos. Generation/revision records preserve model and input provenance. Grounding quality still needs evaluation; market provenance depends on item 6. |
| 8 / P0: sample-only contracts | Replaced | [proposal.mjs](../functions/shared/proposal.mjs) validates schema version 2, real provider/model metadata and exact snapshots. No `sample: true` contract. |
| 9 / P0: approving fixture output | Closed for current approvals | Retired proposals require real regeneration. Approval validates exact copy, price, photo version and provenance. Reopening clears current approval; duplicating never copies approval. Historical approval events remain unchanged. |
| 10 / P1: artificial stages/UI | Removed | Actual derivative preparation, validated inference and durable review completion drive progress. Obsolete setup screens and empty learning stages are deleted. |
| 11 / P1: market/deployment assumptions | **Partially open** | The generator is no longer restricted to review-only project IDs. GBP remains the sole manual currency; review bucket and runtime identity configuration still require pilot deployment work. This is configuration debt, not invented listing data. |
| 12 / P1: unsupported claims/checks | Corrected; validation open | Sign-in and plan describe photos, real generation and feedback. Tests isolate deterministic inference outside deployment. Broader live quality, latency, cost, real-phone and operational checks remain explicit gates. |

## Draft and approval lifecycle

- **Save draft:** photo entry retains photos/context and returns home after local persistence. Review records a saved state, retaining incomplete copy and an optional price. Returning opens photo entry or review as appropriate. Autosave continues; the button does not generate or approve anything.
- **Edit listing:** an owner-scoped, version-checked command reopens the approved item in place, clears its current approval and retains copy/attributes/price/photos. The earlier approval remains immutable in workflow history. Copy requires another exact approval.
- **Duplicate listing:** a durable device intent immediately creates an editable local draft. The server validates the original approved version, copies its original/preview files into the new listing namespace, then atomically publishes its descriptor, capture events and unapproved workflow. Title, description, attributes, price, context, photo order and real proposal provenance are retained. No new AI result or valuation is invented.
- Duplicate requests have a stable UUID and idempotent completion. Partial file copies can be retried. Files from an abandoned attempt remain subject to the existing conservative orphan cleanup. Originals are never rewritten or deleted by duplication.
- Capture edits made while a duplicate is pending remain on the device until its stream exists. Pipeline edits follow the duplicate command. Source changes, ownership failures and version conflicts surface through the existing recovery UI instead of silently replacing data. An explicitly confirmed duplicate discard removes its local capture/pipeline work and returns to the original. Confirmed workflow versions persist alongside the local queue before intents are retired, preventing stale-cache conflicts on immediate reload.

Implementation: [service.mjs](../functions/service.mjs), [pipeline.ts](../src/lib/state/pipeline.ts), [ReviewListing.svelte](../src/lib/components/ReviewListing.svelte), [PhotoEntry.svelte](../src/lib/components/PhotoEntry.svelte). The desired interaction is specified in [UX_DESIGN.md](../UX_DESIGN.md); delivery gates remain in [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md).

## Verification boundaries

Google authentication, owner-scoped Firestore/Storage, original uploads, normalization, local queues, optimistic edits and exact approval use actual implementations. The review deployment uses live Firebase; emulators and deterministic HTTP inference are confined to automated tests.

Earlier live checks exercised real photo generation, feedback across two listings, approval and reload using a temporary custom-token identity. Those checks did not verify the Google OAuth UI or representative quality/cost, and they do not by themselves certify the newly added lifecycle actions. New transaction/browser coverage exercises incomplete saves, offline reopen/duplicate, independent copied files, capture replay, stale versions, ownership, repeat delivery and fresh approval; see the PR for the completed run and deployment results.

`tests/**` inputs and generated UX concepts are deliberately illustrative. Neither is injected as a seller's item in deployed code. Decorative sign-in photography, empty-state labels, loading indicators and validation constants are not synthetic listing content.

## Next priorities

1. Implement actual market retrieval and evidence-backed pricing after confirming pilot market/currency and usable sources. Distinguish asking, sold and modeled values; genuine insufficient evidence must remain possible.
2. Evaluate real generation and language revisions on representative items, ambiguity, adversarial input and conflicting feedback. Establish quality, latency and spending thresholds with monitoring.
3. Complete phone Safari/Chrome checks of draft saving, editing approvals, duplicating, offline recovery and both system appearances. Confirm Google sign-in and isolated ownership in the intended pilot deployment.

The removal of fixed demo output and addition of durable lifecycle actions do not complete market pricing or pilot readiness.
