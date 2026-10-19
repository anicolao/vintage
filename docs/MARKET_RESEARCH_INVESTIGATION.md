# Gucci pricing investigation — 2026-10-19

The saved production Firestore operation in workspace `pr-12` explains the insufficient-evidence outcome for “Vintage Gucci Snakeskin Pumps”. This investigation read existing records; it did not run another paid search or change pricing behavior.

## Recorded request and response

- Generated query: `Gucci snakeskin pumps`.
- Provider: Soldgraph, eBay UK, page 1, count 40, sorted by recently sold.
- Provider request ID: `176f307d-d167-4a55-a701-a9bb2e94d3d8`.
- Search HTTP 202, followed by poll HTTP 200; collection completed at `2026-10-19T16:27:08.711488+00:00`.
- Provider reported one result, no next page, uncached, one credit.
- Returned listing: “GUCCI Snakeskin Crystal GG Axel Pumps Multicolor Shoes NEW $1290”, eBay item `198615648151`, fixed price, brand new.
- Displayed price: GBP 371.43; shipping: GBP 64.21; best offer accepted: false. The displayed price is not a verified paid amount.
- Sold date: September 16. The application eligibility window was September 20–October 19, so normalization excluded it as `missing_invalid_or_out_of_window_date`.
- Final counts: one fetched, zero eligible, zero selected. At least three comparables are required to recommend a price. AI comparable selection was therefore never called.

This was a successful API call followed by an application eligibility rejection, not an authentication or transport failure. It does not prove that no useful Gucci sales exist. The sole returned item also differs from the vintage listing, so including it would not automatically make it a valid comparable.

## Current observability

`functions/service.mjs` persists the generated query and `marketCheckpoint.report` on the operation. The report retains provider request ID, search/poll HTTP statuses, normalized result fields, per-result exclusion reasons, result totals, pagination metadata and credit count. The final result retains eligibility counts, selected matches and caution. These records were sufficient to explain this case.

They are not a complete API audit trail: raw provider response bodies and headers, exact per-call timing, full model requests/responses and rejected-candidate model explanations are not retained. On a resumed collection, the report's request list is rebuilt rather than accumulated across all attempts. The CLI collector's local cache is separate from product requests.

## Recommended next change

Add bounded query expansion when the initial query yields too few usable sales, with an explicit provider-credit limit and deduplication. Consider a longer lookback with sale age shown; expanding the window alone cannot fix this example because only one result was returned. Preserve checks for model, condition and other meaningful differences rather than pricing from arbitrary Gucci shoes.

Record each search attempt, its query, timing, provider request ID, status and normalized response, plus counts for every rejection reason. Record model selection inputs and validated outputs with the model and prompt version, excluding credentials. Define restricted access and retention for these diagnostic records.

Expose the actual outcome in the UI: for this case, “Found 1 sale; it was outside the last 30 days.” Distinguish provider errors, no returned sales, date/offer/currency exclusions and insufficient comparable matches. The existing generic message conceals these differences.
