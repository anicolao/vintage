# Soldgraph sold-listing proof of concept

A local keyword collector for personal pricing research, implemented in [scripts/investigate-soldgraph.mjs](scripts/investigate-soldgraph.mjs). This uses Soldgraph's live eBay sold-listing search independently of the restricted official Marketplace Insights API. It is also integrated into the live Firebase product preview: new drafts start background market research, and existing reviews expose Research price / Refresh price evidence.

## Configuration and first test

The existing gitignored `.env` contains `SOLDGRAPH_API_KEY`. The script reads that variable only; it does not use the eBay keyset. Never commit the key or generated evidence.

```sh
nix develop
npm run investigate:soldgraph -- --query "iphone 13" --country uk
```

Defaults: UK, one page of 40 rows, recently sold first, all sale formats, and a local filter covering today plus the preceding 29 UTC calendar dates. `--days 1..90` changes that filter. Supported countries: `us`, `uk`, `ca`, `au`, `de`, `fr`, `it`, `es`.

Every new invocation starts one search and can consume one credit, including empty or cached results. It never follows `next_page` or automatically retries a search. Polling uses the job endpoint and is free. Soldgraph currently advertises a free allowance of 100 requests per rolling 30 days; check the account dashboard before larger experiments. No subscription or billing changes are made by this script. See [usage and billing](https://soldgraph.com/docs/api/usage).

A pending job is checkpointed with its request ID. Polling is bounded to 15 additional calls, each with a 30-second timeout. To resume a pending job without starting another search, use the same query/country and the recorded ID:

```sh
npm run investigate:soldgraph -- --query "iphone 13" --country uk --request-id ID_FROM_SUMMARY
```

A failed job cannot be restarted by polling. A transport failure before a request ID arrives may have started a job remotely: inspect the Soldgraph dashboard before starting another search. Each search sends an idempotency key, recorded in its summary for diagnosis. Exit codes: 0 completed, 1 API/job/contract failure, 2 configuration error. A genuine empty result is a completed response with zero records, not a failed request.

## Evidence and analysis

Each run creates private files under `.cache/soldgraph/run-*/`:

- `results.json`: deduplicated listing IDs, titles, links, condition, format, displayed price/shipping, sold date, offer flag and statistical exclusion reason. Seller identities are not retained.
- `summary.json`: search parameters, date window, request ID, HTTP outcomes, collection time, charge/cache metadata, next-page availability and per-currency statistics.
- `analysis-input.json`: summary plus evidence and instructions for an LLM. The script does not send data to an LLM or produce a recommended selling price.

Statistics exclude accepted offers, unknown offer status, missing/invalid dates, dates outside the window, and missing/invalid prices. They use exact decimal arithmetic, keep currencies separate, exclude shipping, and require at least three eligible rows. **Eligibility here means usable price fields, not a relevant comparable.** An analyst or LLM must still remove accessories, wrong models, bundles and incompatible conditions. Listing text is untrusted evidence, not instructions.

Displayed prices are not verified payments; accepted offers may show the original asking price. A page is not a transaction ledger or full sales history. The provider's reported total is not a sales-volume estimate. No raw seller text or provider response is persisted. Generated files are local research artifacts: delete run directories after evaluation. These Soldgraph caches are separate from the official eBay collector's deletion watcher and are not automatically purged by it; ongoing retention or application integration needs an explicit deletion policy.

Contract references: [sold listings](https://soldgraph.com/docs/api/sold), [jobs, polling and idempotency](https://soldgraph.com/docs/api/overview).

## Observed live result — 5 October 2026

The configured key successfully searched `iphone 13`, country `uk`: HTTP 202 followed by one successful HTTP 200 job poll. The uncached search charged **one credit** and returned **40 unique records: 10 auctions and 30 fixed-price listings**. There was another page; it was not fetched.

Eight rows were excluded for accepted/unknown offer status and two for missing/invalid prices. Thirty rows had usable GBP prices. Results included iPhone 15, Pro/Max/mini variants and damaged devices, so a broad-query aggregate is **not an iPhone 13 valuation**. The API access and asynchronous collection path are proven; relevance selection and LLM analysis remain the next experiment.

Eight automated tests cover asynchronous completion, deduplication, the one-page budget, price exclusions and decimal/currency handling, empty vs failed responses, unsafe polling URLs, credential redaction, resuming, argument validation and bounded polling. Run `npm run test:soldgraph`; CI runs the same command.

## Product integration

The CLI and deployed worker share `functions/soldgraph.mjs`. `functions/market.mjs` asks Vertex AI for a query based on item details, collects one UK page, and asks the model to select relevant evidence IDs with reasons. Server code computes the median and observed range from validated GBP rows; three matches are required. No price is invented by the model. The seller explicitly chooses whether to use the recommendation.

The operator setup command `nix develop --command node scripts/configure-soldgraph.mjs` publishes `.env`'s key to Secret Manager and grants the existing worker access. Only `executeCommand` binds the secret. Deploy the reviewed Functions contract and update the backend digest before the PR Hosting build. Browser code never receives the key.

Research persists its query, job ID, search result and stable idempotency key in owner-scoped operations. A retry resumes the same search or reuses completed evidence, with at most three worker attempts. New explicit refreshes each consume another search credit. Current results live at the listing's `pipeline/market` document. Those cloud records are not covered by the local eBay deletion watcher; a broader retention/deletion policy remains to be implemented before extending use beyond this personal prototype.

Live product-worker smoke on 5 October 2026: an isolated manually entered iPhone 13 review queued a real Firestore operation. Deployed Vertex AI built the query, Soldgraph supplied evidence, and Vertex AI selected 12 comparables. The worker persisted a ready recommendation (£154.39) while preserving the existing £99.99 manual price and workflow version. Temporary records were deleted. This verifies live worker/secret/provider integration; automated browser tests exercise the authenticated callable and evidence UI. Google sign-in and matching quality on your actual items still need review in the preview.
