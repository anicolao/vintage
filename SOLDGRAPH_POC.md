# Soldgraph sold-listing proof of concept

A local keyword collector for personal pricing research, implemented in [scripts/investigate-soldgraph.mjs](scripts/investigate-soldgraph.mjs). This uses Soldgraph's live eBay sold-listing search independently of the restricted official Marketplace Insights API. It is also integrated into the live Firebase product preview: new drafts start background market research, and existing reviews expose Research price / Refresh price evidence.

## Configuration and first test

The existing gitignored `.env` contains `SOLDGRAPH_API_KEY`. The script reads that variable only; it does not use the eBay keyset. Never commit the key or generated evidence.

```sh
nix develop
npm run investigate:soldgraph -- --query "iphone 13" --country uk
```

Defaults: UK, one page of up to 200 rows, recently sold first, all sale formats, and a local filter covering today plus the preceding 179 UTC calendar dates. `--days 1..180` changes that filter. Supported countries: `us`, `uk`, `ca`, `au`, `de`, `fr`, `it`, `es`.

Every new invocation starts one search and can consume one credit, including empty or cached results. It never follows `next_page` or automatically retries a search. Polling uses the job endpoint and is free. Soldgraph now documents 100 one-time free requests for new accounts; accounts created before October 9, 2026 retain 100 requests per rolling 30 days. Check the account dashboard for the actual allowance before larger experiments. No subscription or billing changes are made by this script. See [usage and billing](https://soldgraph.com/docs/api/usage).

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

## Gucci window comparison — 19 October 2026

The CLI and product worker now default to **180 days**. The CLI accepts `--days` from 1 to 180. This window is a local eligibility filter; the provider request remains a single page sorted by recently sold, without a date parameter. It does not increase provider coverage.

Live rerun: `npm run investigate:soldgraph -- --query "Gucci snakeskin pumps" --days 180`. HTTP 202 followed by HTTP 200, uncached, one credit, request ID `c305f35c-8d97-4af6-8807-823a76f96e32`. Soldgraph returned one result and no next page. The same returned evidence was evaluated against all three windows, avoiding redundant paid searches.

| Window | Inclusive start | Returned | Eligible prices |
| --- | --- | --- | --- |
| 30 days | 2026-09-20 | 1 | 0 |
| 90 days | 2026-07-22 | 1 | 1 |
| 180 days | 2026-04-23 | 1 | 1 |

All windows end on October 19. The result was eBay item `198615648151`, “GUCCI Snakeskin Crystal GG Axel Pumps Multicolor Shoes NEW $1290”, sold September 16, displayed price £371.43 plus £64.21 shipping, brand new, fixed price, no accepted offer flagged. Neither expanded window reaches the three-comparable minimum, so neither would produce a recommendation. Eligibility is not a relevance judgment; no LLM comparison was run in this manual test.

Local evidence: `.cache/soldgraph/run-tyCK4b/`, including `window-comparison.json`. Existing saved research is unchanged; the product's new default applies to fresh searches. Broader queries remain the next coverage experiment.

## Broader Gucci search comparison — 19 October 2026

Four fresh live searches used country `uk`, a 180-day local eligibility window, and one page of at most 40 recently sold results each. All completed successfully (HTTP 202 then HTTP 200), uncached, one credit each: **four credits total**. No additional pages or model calls were made. The original query is included below as the previously collected baseline.

| Query | Returned | Usable GBP prices before relevance selection | More pages available? | Assessment from returned titles |
| --- | ---: | ---: | --- | --- |
| Gucci snakeskin pumps (baseline) | 1 | 1 | No | One brand-new crystal GG Axel pair, not established as comparable to the vintage item |
| Gucci shoes | 40 | 30 | Yes | Very broad: trainers, men's loafers, boots, dust bags and even a single shoe |
| Gucci heels | 40 | 23 | Yes | Better category coverage, including vintage heels, but mixed materials, models, sandals, mules and clogs |
| Gucci court shoes | 19 | 13 | No | Useful additional candidates with several vintage/closed-shoe titles; still mixed materials and some unrelated results |
| Gucci snakeskin shoes | 9 | 6 | No | Three usable trainer listings, one men's loafer, one ballet flat, and the original crystal pumps |

The four new searches returned 106 distinct evidence IDs after deduplication, with 71 distinct eligible GBP prices. Every excluded row was excluded for accepted or unknown offer status. All returned dates fell within 90 days as well as 180, so those two windows produce identical eligibility counts in this sample. The broadest searches filled page 1 with sales from October 17–19; one page does not sample the whole 180-day period.

“Usable price” means it passed date, offer and price validation, not that it is a suitable comparable. These title-based observations are an exploratory review, not a model-selected valuation. For example, the court-shoe results include pre-owned vintage interlocking-GG block heels at £56 and vintage GG monogram horsebit heels at £75.77; those amounts are displayed prices, excluding shipping, and do not establish a price for the seller's snakeskin shoes. No aggregate across these mixed styles should be offered as the item's recommendation.

This demonstrates that changing query wording materially improves retrieval. It does not isolate a UK-versus-US language effect: both specificity and wording changed, and no separate `Gucci pumps` control was run. Search results also include titles using “pumps” and non-English titles despite `country=uk`.

Recommended product experiment: combine a small, budgeted set of category synonyms such as `Gucci heels` and `Gucci court shoes` with the material-specific query, deduplicate by evidence ID, then assess similarity to the actual seller-reviewed item. Keep material/shape/condition distinctions in the selection stage and expose when only broader-category evidence is available. Avoid starting with `Gucci shoes` alone: its first page is dominated by unrelated categories. Automated query expansion is not implemented by this documentation change.

### Reproduction and traceability

Run `npm run investigate:soldgraph -- --query "QUERY" --country uk --days 180` for any query above. Each invocation can consume another credit.

| Query | Provider request ID | Local evidence directory |
| --- | --- | --- |
| Gucci shoes | `d5cfcb72-27c2-40da-af7c-1568eeb9eec2` | `.cache/soldgraph/run-Czsdm2/` |
| Gucci heels | `61a7f6aa-c778-4e23-b737-9ec46e5da188` | `.cache/soldgraph/run-G3mVt4/` |
| Gucci court shoes | `026acf9c-7538-438f-ab3f-470e208db3bc` | `.cache/soldgraph/run-EtRMYR/` |
| Gucci snakeskin shoes | `63b1924a-2c8a-406d-9b78-7149c9bbf4af` | `.cache/soldgraph/run-Ma5Zyk/` |

Each directory contains the normalized evidence, API outcome summary and analysis bundle. Local aggregate counts are saved in `.cache/soldgraph/gucci-query-comparison.json`; credentials and cached result files are not committed.

## Exact overlap and the page cap

Listing-ID intersections of the saved sets (not title matching):

| Query | Shoes | Heels | Court shoes | Snakeskin shoes | Snakeskin pumps |
| --- | ---: | ---: | ---: | ---: | ---: |
| Shoes | 40 | 2 | 0 | 0 | 0 |
| Heels | 2 | 40 | 0 | 0 | 0 |
| Court shoes | 0 | 0 | 19 | 0 | 0 |
| Snakeskin shoes | 0 | 0 | 0 | 9 | 1 |
| Snakeskin pumps | 0 | 0 | 0 | 1 | 1 |

The two shoes/heels shared IDs are `277493830407` (blue vintage one-inch heels, eligible) and `358519031716` (suede Marmont fringe heels, excluded for accepted/unknown offer status). Intersection is 5% of each 40-row set; Jaccard overlap is 2/78, approximately 2.6%. The original snakeskin-pumps result, `198615648151`, also appears in snakeskin shoes. No other pairs intersect. Across all five saved sets, there are still 106 unique listings and 71 eligible prices; the baseline adds no new ID.

The 30/40 usable shoes versus 23/40 usable heels counts measure price eligibility, not relevance or containment. Ten shoe rows and seventeen heel rows were excluded for accepted/unknown offer status. The shared listings have consistent eligibility in both searches.

`functions/soldgraph.mjs` explicitly requests `page=1`, `count=40`, and `sort=recently_sold`. This is the prototype's chosen one-page cost/response-size bound, carried into the product; it is not evidence that the provider has only 40 results or that 40 is its maximum supported page size. We currently do not paginate, even when `nextPage` is present. The collector also validates responses against page 1, so proper pagination requires changes beyond simply looping over the existing function.

A broader complete result set might include a narrower set, but its first 40 results need not. The shoes page contains October 18–19 sales; heels covers October 17–19; court shoes spans July 31–October 11. All court-shoe results are older than either broad page's oldest date. Most snakeskin results are also older; the one October 18 result shares a date with the broad page boundary, and date-only records cannot establish its ranking within that day. Provider search matching may also differ by query; these saved pages do not prove strict set containment of complete searches.

Recommended change: make retrieval an explicit bounded process, with pagination and query variation, stopping when enough relevant evidence is found, the date window is exhausted, no further page exists, or the request budget is reached. Surface truncation and exclusions in the result. Verify provider pagination limits and billing before selecting the budget; do not assume a larger requested count is supported or free. No additional API requests or pagination implementation were made for this overlap analysis.

## Verified page billing — 19 October 2026

The current [Soldgraph billing documentation](https://soldgraph.com/docs/api/usage) charges one credit per completed eBay page. Requesting 200 rows costs the same as 40. Polling and failed searches are free; a page beyond the end is free. Ordinary empty searches and fresh requests served from cache are charged. Reusing the same idempotency key for the same request avoids duplicate charging.

The [sold endpoint reference](https://soldgraph.com/docs/api/sold) supports `count` values 40, 60, 120 and 200. Keep count fixed across pages and follow `next_page`. Thus one query across three nonempty 200-row pages costs three credits, just as three separate one-page queries do. The budget should count paid pages across all queries, not merely unique query strings.

The existing 40-row choice bounds response size, but saves no credits per page. Increasing to 200 is the clearest retrieval-efficiency improvement. Recommend testing one moderately broad category query at 200 rows, filtering locally, and only then deciding whether another page or another query is warranted. The observed `Gucci shoes` results were dominated by unrelated categories, so the broadest possible query is not necessarily cheapest per relevant comparable. Local filtering costs no Soldgraph credits; model analysis can have separate costs.

For scale only: the saved searches reported 2,661 matches for shoes and 1,315 for heels. At 200 rows per page these would nominally require 14 and 7 credits respectively to retrieve all reported matches, assuming stable totals and full pages. Those totals are provider-reported estimates, not verified sales counts or guaranteed retrieval sizes. A 180-day local window does not make these rows arrive in one request.

No paid searches or collector changes were made to answer this billing question. The current implementation still requests 40 rows until the proposed change is implemented and tested.

## Shoes versus heels at 200 rows — 19 October 2026

Two live UK searches requested page 1, `count=200`, `sort=recently_sold`, using the same 180-day local filter. Each returned 200 unique rows, reported `page_size=200`, completed via HTTP 202 then 200, and cost one credit. Both exposed another page. Total cost: two credits. An experiment-only transport wrapper set count to 200 before sending the shared collector's search request and recorded actual request URLs and returned page sizes; product code was unchanged.

| Measure | Gucci shoes | Gucci heels |
| --- | ---: | ---: |
| Returned listings | 200 | 200 |
| Price-eligible listings | 154 | 130 |
| Excluded for accepted/unknown offer status | 46 | 70 |
| Heel-related title screen | 7 | 169 |
| Title screen plus price eligibility | 5 | 106 |
| Oldest returned sale | October 13 | October 5 |
| Newest returned sale | October 19 | October 19 |

For a reproducible category screen, match the title case-insensitively with `\b(?:heels?|heeled|pumps?|stilettos?|wedges?|court\s+shoes?)\b`, then exclude titles matching `\b(?:sneakers?|trainers?|boots?|stiefeletten)\b|\b3[ -]set\b`. Apply exactly the same screen to both sets. These counts measure explicit title wording, not verified relevance or model-selected comparables. The screen misses vague/non-English titles and some sandals/mules; it does not establish material, model, size, vintage or condition compatibility. It is an exploratory comparison, not a proposed production classifier.

The two sets share **8 IDs**, or 4% of each set (8/392 = 2.04% Jaccard overlap); five shared IDs have eligible prices. Shared IDs: `117451523737`, `127782225897`, `277493830407`, `278207880140`, `285696113112`, `358519031716`, `800770407754`, `840018438875`. This yields 392 unique listings and 279 unique price-eligible listings across both pages.

**Recency truncation alone does not explain the difference:** 64 heels results absent from shoes have sold dates strictly newer than October 13, the oldest shoes result. Therefore we cannot assume that these keyword searches produce nested result sets. We have not established the provider's exact search-expansion or matching behavior. Local filtering cannot recover candidates that the chosen query never returned.

Recommendation for this item: include the reliable category (`heels`) in retrieval and use later filtering for material, shape, model and condition. The shoes page spends most slots on men's footwear, trainers, flats, accessories and other irrelevant items. The heels page yields approximately 21 times as many title-screened, price-eligible candidates per credit (106 versus 5), although true comparable yield is still unmeasured. Do not lock in uncertain specifics such as snakeskin, exact model or size in the first query. If category is uncertain, test an alternate category query rather than assuming shoes contains everything. No price recommendation or automated query-policy change was made in this experiment.

Evidence is retained locally:

- Shoes: `.cache/soldgraph/compare-200-Gucci-shoes-1792429743632/`; provider request `607329a7-57df-4250-a52a-e59491c03154`.
- Heels: `.cache/soldgraph/compare-200-Gucci-heels-1792429743631/`; provider request `9d9f026a-472e-449d-9c22-37e50966372b`.

Each directory contains `report.json` (normalized evidence and eligibility) and `calls.json` (credential-free actual URLs, HTTP/job statuses, credit costs and returned page size). The previous 40-row comparisons remain historical observations of smaller pages.

## Product retrieval refinement — 19 October 2026

The shared CLI/product collector now requests up to 200 results, newest sold first, for one search credit. It still fetches one page and uses a 180-day local eligibility window. Fresh product queries use the known brand plus a useful UK category, omitting model, material, colour, size, condition and age from retrieval keywords; these remain in the full seller-reviewed item supplied to the comparable selector. Unknown brands are omitted rather than invented. Query model provenance is checkpointed with prompt version `brand-category-v1`. Existing completed checkpoints remain reusable without another charge; use a fresh research request to evaluate the new strategy.

The current query instruction is exported as `marketQueryPrompt` in `functions/market.mjs`. Its example maps vintage Gucci snakeskin pumps to `Gucci heels`. Brand/category selection remains model-generated, not a guarantee that every generated query follows the instruction.

A live test used the saved seller-reviewed Gucci item, actual Vertex AI query generation and selection, and the real Soldgraph API. Generated query: `Gucci heels`; provider request `17fe0172-91db-46f5-b7f1-925150d92eaf`; 200 results, 130 eligible GBP prices, 70 excluded, one credit. The comparison model selected zero matches and explained that the candidates did not match snakeskin material. Therefore retrieval improved but this item still did not receive a recommendation. No price was fabricated or relevance rule weakened. Local checkpoint/result: `.cache/soldgraph/brand-category-live-1792429940328/`. The test did not mutate the user's saved listing.

Twelve collector/recommendation tests pass, including a 200-row end-to-end service test selecting evidence from the end of the page, query provenance persistence, and retry reuse without another credit.

Condition is a useful next refinement: [Soldgraph supports structured condition filters](https://soldgraph.com/docs/api/sold), including `new` and `used`. Prefer a supported filter when seller-reviewed condition is unambiguous. Vintage is not a supported condition group and is not synonymous with used; consider a separate vintage query when age is established and initial evidence is insufficient. Condition filtering and extra queries are not implemented in this change.
