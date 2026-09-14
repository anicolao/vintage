# Vinted integration design

Status: proposal for review. Research date: 2026-09-14. No integration is implemented by this document.

## Recommendation

Keep the general-seller v0 independent of Vinted account access: accept seller-supplied listing examples, generate and approve a durable draft, and let the seller copy it into Vinted. Investigate official Vinted Pro Integrations (VPI) as a separate, conditional capability for eligible sellers. Treat market evidence as its own unresolved dependency.

There **is an official API**, but it is not a public API for arbitrary Vinted accounts. Vinted restricts VPI to allowlisted Pro businesses. Its UK application page targets second-hand luxury/designer sellers and describes taxonomy-mapping requirements and a 4–6 week setup period. Neither ordinary Pro registration nor Vintage's Google login establishes API eligibility. [VPI access](https://pro-docs.svc.vinted.com/#access), [application requirements](https://www.vinted.co.uk/pro/integrations).

The official surface supports useful listing operations and a price benchmark. It does not, in the reviewed specification, supply marketplace search, arbitrary seller history, comparable-sale records, or a general consumer OAuth connection. These are findings about the published surface, not proof that a private partnership cannot offer more.

## Project context and scope

Read together, [README](./README.md), [VISION](./VISION.md), [V0_DESIGN](./V0_DESIGN.md), [UX_DESIGN](./UX_DESIGN.md), and [IMPLEMENTATION_PLAN](./IMPLEMENTATION_PLAN.md) require photo-first drafting, learning the seller's voice, evidence-based pricing, editable proposals, and approval of exactly the displayed result. The implementation plan explicitly ends v0 at approval and copy; direct publication and autonomous repricing are outside it.

This branch starts at `origin/main` revision `1135c94`. The separate appearance/drafts branch and its in-progress markdown were also reviewed for orientation; their unfinished implementation is not part of this PR. Firebase setup, draft-foundation, E2E, mockup-generation, fixture, and prompt-history documents inform the constraints below. The old technical design's `users/{uid}` examples must be reconciled with the workspace-scoped ownership used by the implementation before adding new repositories.

The apparent automatic-history import in the UX requires an explicit input mechanism. Milestone 4 already calls for seller-supplied examples and truthful onboarding. This proposal does not approve new screens or copy: implement the selected input mechanism through a reviewed UX update, retaining the approved mobile-width desktop layout, system appearances, glass treatments, and accessibility behavior. Preserve the user's photo-first new-listing flow and optimistic local editing.

## Verified API surface

The following inventory was checked against Vinted's downloadable **OpenAPI 3.0.3 specification, version `v0.355.1`**, retrieved directly on the research date. It is a mutable upstream document; pin and revalidate a reviewed revision when implementing. The HTML docs also link a Postman collection. No authenticated endpoint was exercised. [OpenAPI specification](https://pro-docs.svc.vinted.com/downloads/api.yml), [downloads](https://pro-docs.svc.vinted.com/#downloads).

All paths below are relative to the official Pro service, including the `/api/v2/` price endpoint. That endpoint is distinct from the consumer website's internal `/api/v2/` routes.

| Capability | Method and path | Fit for Vintage |
| --- | --- | --- |
| Create, edit, remove inventory | `POST`, `PUT`, `DELETE /api/v1/items` | Optional future delivery of approved drafts; asynchronous completion |
| List managed items | `GET /api/v1/items` | IDs, references, status and errors; not complete listing copy |
| Resolve listing status | `GET /api/v1/items/{id}/status` | Reconcile publication and failures |
| Read imported inventory | `GET /api/v1/items/imported` | Imported title/description, UUID, URL and status; useful style examples |
| Assign external references | `PUT /api/v1/items/item-references` | Associate imported items with Vintage IDs |
| Validate item payloads | `POST /api/v1/items/validate` | Check category and field mapping before submission |
| Fetch taxonomy | `GET /api/v1/ontologies` | Categories, sizes, colours, package sizes, attributes and validation rules |
| Price suggestion | `GET /api/v2/item-price-suggestions` | One benchmark: response has `currency` and `maximum` |
| Orders | `GET /api/v1/orders`, `GET /api/v1/orders/{id}` | Seller's order states, items and order-level proceeds |
| Fulfilment | `GET /api/v1/orders/{id}/shipment`, `GET /api/v1/orders/{id}/shipment-label` | Shipping metadata and labels; outside drafting scope |
| Order actions | `POST /api/v1/orders/{id}/cancel`, `POST /api/v1/orders/relist` | Outside v0; never infer authorization from draft approval |
| Webhook management | `GET`, `POST /api/v1/webhooks`; `PUT`, `DELETE /api/v1/webhooks/{id}` | Subscribe to item/order changes |
| Delivery diagnostics | `GET /api/v1/webhooks/{id}/delivery-results` | Latest 100 delivery attempts |
| Simulate sale | `POST /dev/v1/triggers/item-sold/{itemID}` | Sandbox contract testing |

Source for methods, fields and limitations: [VPI OpenAPI paths and schemas](https://pro-docs.svc.vinted.com/downloads/api.yml).

### Access and operational contract

Production uses `https://pro.svc.vinted.com`; dev mode uses `https://pro-public-sandbox.svc.vinted.com`, with separate credentials. Dev mode has no frontend and guarantees data availability for at least one week. Tokens contain an access key and signing key. Requests carry `X-Vpi-Access-Key` and an HMAC-SHA256 signature covering timestamp, method, path/query, access key, and exact body. Webhooks use a separate signing key. Existing non-VPI inventory import requires the account manager. The documented initial allocation is 500 active items, with possible review after 30 days; this is an inventory allowance, not a request-rate limit. [VPI integration guide](https://pro-docs.svc.vinted.com/).

### Payload details to preserve

Creation requires `is_draft` and `item_reference` alongside item properties. The schema requires brand text, leaf category, currency, description, package size, photo URLs, price and title; additional requirements depend on taxonomy. Titles are 5–100 characters and descriptions 5–2000. Photos must be publicly retrievable, at least one per item, at most 5 MB each. Currency currently enumerates EUR and GBP. Creation and deletion accept batches of at most 100. A create response of HTTP 202 supplies IDs but does not confirm publication. [OpenAPI item schemas](https://pro-docs.svc.vinted.com/downloads/api.yml).

Use the `condition` item attribute for writes; `status_id` is deprecated there. Taxonomy is versioned by country, currency and update time. Its published country enum lists AT, BE, DE, ES, FR, IT, LU, NL, PT and UK; confirm actual pilot-market eligibility rather than treating the schema as an access guarantee. The price endpoint still accepts `status_id` and numeric `brand_id`, whereas creation accepts brand text and ontologies do not expose a brand list. Brand-ID resolution and condition mapping are explicit integration questions. [OpenAPI taxonomy and price schemas](https://pro-docs.svc.vinted.com/downloads/api.yml).

### What the data can and cannot establish

**Seller style:** `GetItems` returns management metadata. `GetImportedItems` includes title and description after assisted import, but its schema does not include historical prices, photos, attributes or completed-sale chronology. Retain the approved copy Vintage itself sends. Before promising automatic learning for an eligible account, verify import coverage and representative text with that seller. [OpenAPI read schemas](https://pro-docs.svc.vinted.com/downloads/api.yml).

**Pricing:** the price endpoint requires `catalog_id`, optionally accepts brand and condition IDs, and describes a maximum suggestion benchmarked against historical sold prices. It can return 404 when no suggestion exists. Its response supplies no comparables, sample count, confidence, lower bound, sale probability or time to sale. Treat it as an opaque benchmark, not Vintage's expected-sale range, a price ceiling, or a revenue optimizer. [OpenAPI price operation](https://pro-docs.svc.vinted.com/downloads/api.yml).

**Outcomes:** order data and sale/cancellation events may support longitudinal learning for connected sellers. An order's amount is order-level proceeds; bundles and cancellations prevent treating it as a final per-item sale price. Store observed state transitions and source dates; do not interpret an item disappearing as a sale. This is Vintage's proposed evidence policy, not a claim of additional API fields.

## Alternatives

| Alternative | Benefits | Limits and cost drivers | Decision |
| --- | --- | --- | --- |
| Seller pastes their own titles/descriptions; copy approved draft | Works without marketplace credentials; matches planned v0 boundary | Manual effort and selection bias; no live inventory or market-wide evidence | Recommended initial implementation |
| Seller uploads an export they obtained | Potentially faster history ingestion | Actual file format, fields, completeness and availability unverified; sensitive unrelated data needs filtering | Inspect a volunteered, redacted sample before committing to a parser |
| Official VPI | Documented write surface, taxonomy, import, benchmark and order events | Allowlisting, market eligibility, backend integration and account management; commercial terms unknown | Conditional pilot for an eligible seller |
| Bespoke Vinted partnership/data licence | Could address history or comparable-outcome gaps | No verified offer, access timetable, pricing or redistribution/AI rights | Prepare requirements for later authorized outreach |
| Third-party data/API supplier | Could reduce adapter effort | Supplier must demonstrate acquisition rights, coverage, freshness, provenance and costs; a paid endpoint is not proof of Vinted authorization | Evaluate only against explicit evidence requirements |
| Unofficial consumer API or scraping library | Existing projects illustrate catalogue search and item reads | Unsupported contract, session dependency, maintenance and platform-policy exposure | Do not make this the production dependency |
| Browser extension or automated cross-listing | Could assist form filling in the seller's session | Adds browser permissions, session handling and DOM maintenance; poor fit for the mobile SPA; authorization still unresolved | Defer; user interaction alone does not establish platform permission |

The author's [vinted-api-kit repository](https://github.com/vlymar1/vinted-api-kit) advertises search, item details and cookie persistence. Another author's [client source](https://github.com/kennyfitzgerald/vinted/blob/master/vinted_api.py) uses website routes such as `GET /api/v2/catalog/items`, `/api/v2/items/{id}`, and `/api/v2/users/{member}`. These are evidence of unofficial implementations, not verified current availability or a supported developer API. They were inspected as references, not installed or run.

Vinted's UK terms prohibit external automation unless allowed by Vinted and separately prohibit scraping/data mining; they describe restrictions and account blocking among enforcement actions. That makes platform authorization a concrete dependency for scraping, extensions and intermediaries. Seller consent alone does not resolve it. Recheck the applicable market and Pro agreement for a pilot. [UK terms, sections 6–7](https://www.vinted.co.uk/terms-and-conditions).

For the export alternative, the [privacy-policy page](https://www.vinted.co.uk/privacy-policy) returned only its navigation shell in this research environment. No export schema or reliable history coverage was verified. Manual examples remain feasible without assuming a particular export feature or promising a downloadable full sales history.

## Proposed architecture

Use separate history, pricing-evidence and publishing adapters behind server commands. A seller may have history examples without publishing access, or publishing access without useful market evidence. Capability flags must reflect verified account access and available data rather than a single “Vinted connected” boolean.

```text
Photo-first Svelte UI → owned Firestore intents/events → durable server commands
                                                        ├─ seller-example ingestion
                                                        ├─ evidence provider
                                                        └─ optional VPI adapter
VPI HTTPS webhooks → signature verification → durable inbox → owned outcome events
```

This extends the planned Firebase Functions command architecture; it is not present-day implementation. Scope all descriptors, source records, commands and events by `workspaces/{workspace}/accounts/{uid}` and the owning listing where applicable. Resolve identity from Firebase Auth, never from a caller-supplied UID. Server code must enforce ownership even though Admin SDK writes bypass client rules.

### Initial history and evidence contracts

Normalize seller examples into versioned records containing source kind, source ID, supplied/imported time, title, description, optional attributes, and optional price/currency/outcome. Missing values remain absent. Deduplicate per owner and source; show a review of accepted examples before learning. Record exact source versions used by the style profile and each proposal.

Evidence records should distinguish seller-reported outcomes, authorized completed sales, asking prices, and VPI's suggested maximum. Include market, currency, observation time, provenance reference, available item attributes, and limitations. Store money in integer minor units internally and convert deliberately at adapter boundaries. Never mix markets or fees silently.

Imports must be bounded and previewable. Do not fetch arbitrary pasted URLs automatically; a URL can be a provenance reference. Exclude credentials, messages, buyer addresses and unrelated account data from style inputs. Define deletion of source content and derived profiles; retain minimal event references rather than copying personal data irreversibly into every event.

### Conditional VPI implementation

1. Establish a server-owned connection bound to a verified seller, workspace and environment. Store credentials in a backend secret store; client-readable Firestore contains only connection status and opaque references. Keep secrets out of the SPA, prompt records, events and logs. Revocation disables queued remote actions and triggers credential cleanup.
2. Cache taxonomy by its returned version and market. Validate mapped fields without silently rewriting seller-approved copy. Capture taxonomy version and payload digest with each submission. Establish schema drift monitoring; the reviewed order schema even names a required `buyer` field without defining that property, so generated-client strictness needs sandbox verification.
3. Normalize publishable image derivatives, preserving original private photos. Serve only the selected derivatives through narrowly scoped, expiring fetch URLs usable by Vinted without login. Confirm signed-URL acceptance and asynchronous fetch timing in sandbox; set expiry to cover retries and delete/revoke delivery copies afterward. Never make the whole Storage bucket public.
4. Keep `listing/approved` as the immutable Vintage approval boundary. A future explicit remote action claims a durable command against that exact revision. Editing or regenerating invalidates a queued submission unless it still targets the approved snapshot. Local UI updates immediately to pending; only remote confirmation can establish remote success.
5. Begin the authorized pilot with `is_draft: true`; test actual marketplace draft visibility and completion before designing publication UX. Use separate proposed events such as `vinted/submission-requested`, `vinted/draft-created`, `vinted/published` and `vinted/submission-failed`. Creating a remote draft is distinct from publishing it.
6. Persist the VPI UUID, Vintage reference, public marketplace ID, payload digest and command state. Reuploads can rotate the public ID while retaining the VPI UUID. Do not assume `item_reference` is a provider idempotency key. If a create times out after transmission, reconcile managed-item references before retrying; unresolved ambiguity becomes a recoverable state instead of a blind duplicate POST.
7. Verify webhook signatures over raw bytes with a constant-time comparison. Bind each registered webhook to its connection; persist an inbox record before acknowledgement, then process asynchronously. The envelope has `webhook_id` but no documented unique delivery-event ID: it cannot serve as a deduplication key. Use an inbox digest plus idempotent state transitions and reconciliation, allowing legitimate repeated updates. Treat ordering, duplicate delivery, retry schedule and timestamp tolerance as unverified provider behavior.
8. Handle validation failures as seller-correctable errors, authentication failure as reconnection, and missing benchmark data as unavailable evidence. Use bounded backoff for transient failures and any rate-limit responses, honoring retry hints where supplied. No numeric requests-per-second limit was verified. Stop retries on ambiguous writes and reconcile first.

These are proposed controls and implementation choices. Upstream request/response fields are grounded in the [VPI specification](https://pro-docs.svc.vinted.com/downloads/api.yml); operational guarantees must be demonstrated in the pilot.

## Delivery and decision gates

| Stage | Deliverable | Gate |
| --- | --- | --- |
| Milestone 4 | Reviewed seller-example input, durable ingestion and traceable style profile | Representative real examples, empty-history UX decision, owner isolation and replay tests |
| Milestone 7 | Evidence adapter and measured proposal evaluation | Real authorized data, provenance, currency handling and coverage; unsupported estimates remain unavailable |
| VPI access investigation | Eligibility and commercial/technical answers for one seller and market | Written confirmation of permitted multi-seller/agent use, credential custody, data processing and access |
| VPI sandbox spike | Mapping, signed requests, remote draft, webhook and reconciliation proof | Approved test credentials; validate the actual response contracts and failure cases |
| Optional production pilot | Separately reviewed connection and remote-action UX plus backend | Explicit publication scope, live Firebase preview, successful authorized draft round-trip, revocation and recovery evidence |

Automated adapter tests should cover exact signed bytes/query strings, stale credentials, malformed webhooks, duplicate and out-of-order events, cross-owner access, currency conversion, expired photo URLs, missing benchmarks, partial batch failures and ambiguous submission outcomes. Emulator E2E uses deterministic provider fixtures and the existing event-driven waiting contract. Live Firebase review and Vinted sandbox checks form separate evidence; fixture success does not establish provider access or data quality.

The full pricing promise remains gated. If credible data cannot support sale probability, expected revenue or time-to-sale, follow the implementation plan's insufficient-evidence states and seek a separate product/design decision before narrowing that promise. A plausible number from a model or VPI's benchmark is insufficient.

## Questions to resolve before a VPI pilot

- Which seller type, launch country and currency are in scope? Does Vinted approve Vintage acting for multiple sellers, and how is each seller onboarded or disconnected?
- What eligibility, fees, volume commitments, request quotas, retention terms and service expectations apply? Which taxonomy and price-benchmark coverage is actually available for the pilot market?
- Does account-managed import cover active listings only, sold items, historical edits, and sufficient examples? Is there an authorized richer history or market-data product?
- How should brand IDs and the price endpoint's condition IDs be resolved? What happens for unknown brands, new categories and unavailable suggestions?
- What are draft publication/update semantics, reference uniqueness, webhook retry/order guarantees and safe recovery after uncertain writes? What timestamp window is accepted for delayed webhooks?
- Can returned data be used for personalized generation, derived pricing models and retained evidence? What deletion and redistribution obligations apply?

This PR documents the investigation and recommendation. It does not contact Vinted, enroll a seller, request credentials, publish items, or change the approved product flow.
