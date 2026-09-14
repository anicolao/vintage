# eBay integration proposal

Status: proposed for review; researched 14 September 2026. This is a design investigation, not an implemented or production-approved integration. Baseline: `origin/main` at `1135c94`, in the separate `docs/ebay-integration` worktree.

## Recommendation

Treat eBay as three independent capabilities: a publishing destination, a source of the connected seller's listings and outcomes, and a possible source of market evidence. Start with a small seller-authorized integration spike. Make Browse-based research conditional on production access and permission for Vintage's particular use case. Do not make broad sold-price access a dependency: Marketplace Insights is currently closed to new users.

Keep the existing Vinted-oriented v0 intact while evaluating eBay. The approved flow in [UX_DESIGN.md](./UX_DESIGN.md) ends with approval and `Copy listing`; it does not authorize marketplace publication. A future eBay destination, account connection, or publish action requires an explicit UX proposal and approved mockups before production screens change. This document proposes those capabilities without replacing the current flow or copy.

## What is available

| Capability | Official interface | Fit and constraints |
| --- | --- | --- |
| Search active listings | Buy Browse API: `search`, `getItem`, `searchByImage` | Keyword/category/aspect search can supply asking-price context. Uses an application token. Production access is subject to eBay's Buy API requirements; technical access alone does not establish permission for pricing research. [Browse](https://developer.ebay.com/api-docs/buy/api-browse.html), [access requirements](https://developer.ebay.com/api-docs/buy/buy-requirements.html). |
| Broad sold-market history | Marketplace Insights API | Restricted and not open to new users. Exclude it from the committed delivery path. Image search also has narrower marketplace coverage than ordinary Browse search. [Marketplace support](https://developer.ebay.com/api-docs/buy/ref-marketplace-supported.html). |
| Seller listing import | Trading API: `GetMyeBaySelling`, `GetSellerList`, selected `GetItem` calls | Suitable for discovering the authorized seller's existing listings, including listings outside the Inventory model. Paginate and respect method-specific history limits; a date-window parameter is not a promise of unlimited archives. [Seller retrieval guide](https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/browse-seller.html), [GetSellerList](https://developer.ebay.com/devzone/xml/docs/Reference/ebay/GetSellerList.html). |
| Seller sales outcomes | Sell Fulfillment: `getOrders`, `getOrder`; Finances for later fee/payout work | These are the connected seller's transactions, not everyone else's sold comparables. Fulfillment release notes document retrieval extending to two years; verify endpoint filters in the spike because an older guide still says 90 days. [Release notes](https://www.developer.ebay.com/api-docs/sell/fulfillment/static/release-notes.html), [older guide](https://developer.ebay.com/api-docs/sell/static/orders/discovering-unfulfilled-orders.html), [account APIs](https://developer.ebay.com/develop/api/sell/finances-v1_alpha_api). |
| Create and maintain listings | Sell Inventory plus Account APIs | Inventory items, locations and offers provide a REST publishing model. Business policies are required. Current docs support both fixed-price and auction listings, but revisions must use Inventory: Seller Hub editing is unavailable for these listings. [Inventory overview](https://developer.ebay.com/api-docs/sell/inventory/static/overview.html). |
| Alternative publishing model | Trading API: `VerifyAddFixedPriceItem`, `AddFixedPriceItem`, `AddItem`, revision/end calls | Evaluate if sellers require their existing listing-management workflow. It carries XML mapping and reconciliation work. Do not assume Trading calls can revise Inventory-created listings. [Creation](https://developer.ebay.com/develop/guides/sell/listing-creation), [management](https://www.developer.ebay.com/develop/guides/sell/listing-management). |
| Category and required fields | Commerce Taxonomy; Sell Metadata; Account policies | Suggest categories, retrieve item aspects and condition policies, and use the seller's fulfillment/payment/return policies. Map by marketplace rather than translating Vinted category IDs. [Listing metadata](https://developer.ebay.com/develop/guides/sell/listing-metadata-guide). |
| Photo hosting | Commerce Media API | Upload files or URLs to eBay Picture Services and retrieve image URLs and expiration metadata. Prefer file upload from the backend so private Storage URLs need not become public. [Media overview](https://developer.ebay.com/api-docs/commerce/media/static/overview.html). |
| AI listing previews | Inventory Mapping API, GraphQL | eBay can generate listing previews from inputs such as a title or image. A preview is neither a saved draft nor a live listing. Compare this with Vintage's own extraction in a bounded experiment, subject to access and marketplace support. [Listing creation guide](https://developer.ebay.com/develop/guides/sell/listing-creation). |
| Bulk operations and other seller tools | Sell Feed, Notification, Negotiation, Marketing and related APIs | Available for larger imports, lifecycle updates, offers and promotion. Defer bulk feeds, buyer messages, advertising and checkout until the core seller use case is proven. [Seller API portfolio](https://developer.ebay.com/develop/api/sell/inventory_api). |

Avoid outdated integration recipes: Finding and Shopping were decommissioned in Q1 2025. `UploadSiteHostedPictures` is scheduled for retirement on 30 September 2026; use Media for new work. [2025 update](https://www.developer.ebay.com/updates/newsletter/q1_2025), [2026 update](https://developer.ebay.com/updates/newsletter/q2_2026).

## Access and data-use gates

Register a Vintage developer application with separate Sandbox and Production credentials. Google sign-in remains Vintage identity; eBay consent is a separate account-linking step. Seller APIs require authorization appropriate to their operations; Browse uses client credentials. The authorization-code exchange supplies a refresh token for background seller work. [Authorization guide](https://developer.ebay.com/develop/guides/sell/authorization).

Before committing to market research, submit the actual product use case through eBay's documented production-access process: seller pricing assistance, evidence display, intended marketplaces, caching and AI processing. Approval is not guaranteed. Do not presume a shopping or affiliate integration approval covers a Vinted pricing assistant. [Buy requirements](https://developer.ebay.com/api-docs/buy/buy-requirements.html).

The current API licence prohibits using eBay content to train algorithms, conduct machine learning, develop synthetic datasets or train AI systems. This directly affects the proposed seller-style learning and pricing-model work. Disable training and downstream AI processing of API-derived content until eBay clarifies or expressly permits the intended use; do not assume inference, embeddings, seller consent or anonymization creates an exception. Obtain a permitted-use decision covering retention, derived profiles, evidence display and service-provider access. This is a release dependency for those capabilities, not a blocker to designing or testing an API connection. [API licence](https://developer.ebay.com/join/api-license-agreement).

Support account-deletion notifications before retaining eBay personal data in production. Process verified notifications, remove applicable imported data and derived artifacts, and prevent delayed jobs from restoring deleted records. Implement disconnect separately: it stops future work and removes locally held credentials; disclose what happens to already-live listings. [Account deletion requirements](https://developer.ebay.com/develop/guides/sell/marketplace-user-account-deletion).

## Proposed architecture

The repository uses a static SvelteKit SPA, Firebase Auth, Firestore and Storage. There is no deployed eBay backend on this baseline. Add a small server-side eBay adapter using Firebase Functions or Cloud Run, with queued workers. Reuse the event/command direction in [V0_DESIGN.md](./V0_DESIGN.md) and [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md); reconcile with draft/photo work when it merges rather than depending on uncommitted files in another worktree.

```mermaid
flowchart LR
  UI[Svelte SPA] --> Local[Device intent and outbox]
  Local --> Commands[Authenticated command endpoint]
  Commands --> Store[Firestore commands and projections]
  Store --> Worker[Queued eBay worker]
  Worker --> API[eBay APIs]
  Worker --> Photos[Private Storage photos]
  Worker --> Store
  Store --> UI
  Consent[eBay OAuth callback] --> Secrets[Server-only token storage]
  Secrets --> Worker
```

Navigation, edits and approval intent persist locally and update the UI immediately. Firestore synchronization and photo transfer run in the background. Remote jobs may wait for prerequisites; the screen must not wait for their acknowledgement. Device storage failure must be visible rather than reported as a successful save. Browser closure can delay transfer of local-only work, but cannot stop a job already accepted by the backend.

Use Firebase-authenticated ownership checks for every connection and command. Keep the client secret in Secret Manager and seller refresh tokens in encrypted, backend-only storage; neither belongs in browser storage, readable Firestore projections, event payloads or logs. Bind OAuth `state` to a short-lived, single-use server record containing the authenticated owner, environment and allowlisted return route. Validate state on callback, exchange the code on the server, and record the linked eBay identity. Serialize token refreshes per connection and stop jobs on revoked authorization.

Request scopes by capability. Start with the documented scopes for seller reads; add `sell.fulfillment.readonly` only for outcomes. Publishing needs `sell.inventory` and the appropriate Account/Media scopes. Verify the full scope URIs against each selected endpoint and actual keyset before implementation; Trading's broader authorization must be explained accurately rather than advertised as technically read-only. Do not request messaging, advertising or financial permissions for the first import.

### Data contracts

These are proposed logical records, not existing schemas:

| Record | Minimum contents |
| --- | --- |
| Connection | Owner UID, eBay identity reference, environment, marketplace, granted scopes, status, last sync, server-only credential reference |
| Import checkpoint | Connection, source method, cursor/date window, run ID, completion/errors |
| Seller example | Source item ID, source kind, permitted title/description/aspects, retrieval time, retention policy and provenance |
| Evidence | Source item ID/URL, marketplace, currency, condition/aspects, asking versus sold classification, shipping treatment, observed time, expiry and permitted-use flags |
| Destination projection | Vintage draft ID, approved revision/hash, eBay SKU, offer ID, listing ID, marketplace and sync state |
| Job | Stable command ID, owner, connection version, operation, input revision, prerequisite photo IDs, attempts, next attempt, outcome/error category |

Keep eBay IDs distinct from Vintage IDs. Use one stable SKU per physical item and seller connection, with quantity one for the initial used-item pilot. Store money as a decimal string plus currency; never silently mix currencies. Store removable external content outside immutable event streams, which should carry IDs and minimal operational metadata. Every derived artifact needs provenance sufficient for deletion and expiry. Imported descriptions are untrusted input: sanitize display HTML and treat embedded instructions as content when any permitted AI processing is later enabled.

## Seller import and evidence behavior

Import a bounded, paginated sample of the seller's listings, then enrich only selected IDs. Inventory enumeration alone is insufficient for arbitrary pre-existing eBay listings. Keep imports read-only; migration into the Inventory model is a separate consequential action. Track partial success, allow retry, and deduplicate by connection plus source item ID. An empty history or expired authorization leaves the draft usable.

For permitted Browse research, query brand/category/condition/aspects, retain query provenance, deduplicate listings and compare delivered prices where shipping is known. Label results as active asking prices. A missing listing does not prove a sale, and an auction bid is not a final sale price. Observe marketplace support before enabling image search. Evidence expiration should follow applicable eBay terms and the approved use case, not an invented unlimited cache duration.

Do not infer sale probability, time to sale or expected revenue from active listing prices alone. Seller transactions provide a small, biased outcome sample, with refunds and cancellations requiring reconciliation. Treat eBay-to-Vinted price transfer as unvalidated: fees, buyer populations, shipping and negotiation differ. If the required outcome evidence is unavailable, expose an insufficient-evidence state through an approved UX revision; do not fill the gap with invented sold comparables or numeric confidence. The current v0 pricing promise remains a product decision to resolve.

## Publishing proposal

Recommend Inventory for a Sandbox spike covering new, single-quantity, fixed-price listings in one selected marketplace. Auction support exists, but auctions and variations add unnecessary first-release state. Decide whether Inventory is acceptable only after the seller confirms that ongoing editing through Vintage suits their workflow. If Seller Hub editing is essential, evaluate Trading as the chosen publishing adapter before launch; do not ship two competing writers for the same listing.

A future publish operation must be distinct from `Approve listing`. Approval captures the exact visible proposal; publishing captures an explicit destination-specific snapshot with shipping, returns, policy IDs, marketplace and any fees shown. Offline approval never means an eBay listing is live. New controls and error states must follow the approved mobile-width layout, copy review, keyboard/focus behavior, system appearance and solid-glass fallbacks.

Proposed worker sequence:

1. Validate ownership, connection generation, immutable approved revision and durable photo availability. New edits create a new revision and never mutate a queued publish payload.
2. Resolve marketplace category, required aspects and condition policy; validate seller eligibility, location and existing business policies. Missing fields become actionable validation results, not invented defaults.
3. Upload approved photos through Media, save the image IDs/URLs and verify their availability/expiry. Preserve approved order.
4. Create or replace the stable Inventory SKU, establish the inventory location and create one offer for the destination. Persist returned identifiers after each successful step.
5. Obtain listing fees where supported and present any changed price, policy or fee assumptions for renewed user confirmation before publishing. No automatic repricing or silent policy creation.
6. Publish the recorded offer. Mark it live only after eBay confirms the listing ID; display the resulting eBay link. All later updates and withdrawal use the chosen owning API.

Delivery is at least once. Enforce a unique job key for connection/draft/approved revision/operation and a lease per destination. A timed-out create or publish call enters reconciliation: query the stable SKU and stored offer before retrying; do not create another offer blindly. If remote success cannot be determined, keep an explicit uncertain state and require investigation. Persist partial success so a worker restart does not repeat completed photo and listing steps.

Retry rate limits and transient failures with bounded exponential backoff and jitter; respect server retry instructions. Validation failures require edits; revoked tokens require reconnection. Use scheduled reconciliation as a baseline and add supported notifications for faster updates. Disconnect prevents new mutations, but an in-flight publish may already have succeeded and must be reconciled. Cross-listing a unique item introduces overselling risk; automatic Vinted/eBay stock synchronization is outside this proposal.

## Delivery and validation

| Increment | Deliverable | Exit evidence |
| --- | --- | --- |
| 0: feasibility | Confirm launch marketplace/currency, developer access, permitted data use and Inventory editing tradeoff | Recorded capability matrix from actual Sandbox calls; production access status explicit |
| 1: connection and import | Backend OAuth, ownership rules, deletion handling, paginated seller import | Connect/reconnect/disconnect; two-user isolation; token redaction; repeat import without duplicates; deletion during queued work |
| 2: evidence experiment | Separately gated Browse adapter and optional Inventory Mapping comparison | Representative vintage-item results, coverage/freshness, provenance, cost/latency; asking/sold distinction; no unsupported estimates |
| 3: publishing pilot | Approved UX plus one marketplace's fixed-price publish/revise/withdraw flow | Sandbox publish and cleanup, timeout-after-success recovery, duplicate-click safety, exact approved content and photo order |
| 4: limited production | Approved access, operational dashboards, explicit seller-authorized trial | Live Firebase review preview, real account connection and bounded listing test; no real listings created merely by CI |

Test local persistence and navigation while offline, refresh during upload, expired OAuth state, revoked credentials, concurrent devices, malformed eBay payloads, partial imports, throttling and ambiguous remote success. Use emulator/adapter fixtures for deterministic tests and Sandbox for API contracts. Production access and representative market quality cannot be established from Sandbox fixtures alone.

Measure calls per draft, latency, import completeness, retry/error rates, duplicate remote listings, stale evidence and publishing conversion. Browse's published default is 5,000 calls/day for most methods; Inventory Mapping is listed at 20 calls/day. Treat quotas as keyset-specific operational limits, cache only as permitted, and budget backend/queue/Storage/AI costs separately from seller listing fees. Avoid broad catalog ingestion for a per-item drafting product. [Call limits](https://developer.ebay.com/develop/get-started/api-call-limits).

Decisions needed before implementation are the first marketplace, whether eBay is a destination or only evidence, acceptance of Inventory's editing constraint, and the precise permitted AI/data use. The initial technical recommendation is a connection/import and publishing feasibility spike, with market research separately gated. No credentials were provisioned, accounts linked, API calls authenticated or listings published during this documentation investigation.
