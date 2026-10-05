# eBay market data proof of concept

Implemented 5 October 2026 in [scripts/investigate-ebay.mjs](scripts/investigate-ebay.mjs). Sandbox authentication and search work. A follow-up US `camera` query returned and normalized one actual Sandbox test listing. Production access and representative market-data coverage remain unverified.

## Run the Sandbox prototype

The existing `.env` was renamed to **`.env.sandbox`**, preserving its contents. Both `.env.sandbox` and `.env.production` are gitignored. The collector loads only the file matching the explicitly selected environment; it never falls back to another file or exported credentials.

| Variable | Use |
| --- | --- |
| `EBAY_APP_ID` | OAuth client ID for the selected environment. |
| `EBAY_CERT_ID` | OAuth client secret from the same keyset. |
| `EBAY_DEV_ID` | Existing value can remain; OAuth does not use it. |

From the repository root:

```sh
nix develop
npm ci
npm run investigate:ebay -- --help
npm run investigate:ebay -- \
  --environment sandbox \
  --query "Barbour Bedale wax jacket" \
  --query "iphone" \
  --marketplace EBAY_GB --days 30 --limit 50
```

Supply up to five search terms. No item IDs or manual listing lookup are required. Defaults are UK, 30 days and 50 records per query; limits are 90 days and 200 records. The program uses the same environment for token requests and search requests. Credentials, headers and access tokens are excluded from saved output and console reports.

## What the script does

1. Tests client-credentials OAuth with the basic eBay scope to distinguish working credentials from sold-search entitlement.
2. Obtains a separate token with `https://api.ebay.com/oauth/api_scope/buy.marketplace.insights`.
3. Searches `/buy/marketplace_insights/v1_beta/item_sales/search` using the terms, marketplace and fixed UTC `lastSoldDate` window. Sandbox uses `https://api.sandbox.ebay.com`; Production uses `https://api.ebay.com`.
4. Follows returned pagination, capped at ten pages per query and the requested record limit. Pagination must remain on the selected host and search path. It records truncation and preserves each completed page locally.
5. Deduplicates by source item ID across pages and queries, retaining every matching query, and writes a self-contained analysis bundle.

There is no buying-format restriction: auctions and fixed-price sales can both contribute. Offer prices are usable only when the source supplies an actual last-sold amount. The collector requests no active-listing substitute. eBay documents `lastSoldDate` for Marketplace Insights and excludes `BEST_OFFER` as a supported Insights buying-options filter. [Search filters](https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html).

Requests have a 15-second timeout and a 2 MiB response limit. There are no automatic retries or LLM submissions. Tokens stay in memory for the bounded run; expiration is reported as a failure, and rerunning obtains fresh tokens. Exit status is `0` for completed searches, `1` for API/access/partial failure and `2` for setup failure. Zero results are distinct from denied access or an unrecognized response. A capped search can complete successfully while its query status remains `truncated`.

## Results and LLM input

Each run saves three private files under the gitignored `.cache/ebay/run-*/` directory:

| File | Contents |
| --- | --- |
| `results.json` | Normalized evidence records and exclusion reasons. |
| `summary.json` | Environment, date window, authentication stages, HTTP outcomes, per-query counts/completeness and decimal-safe descriptive statistics. |
| `analysis-input.json` | Summary, evidence and analysis instructions in one JSON document. |

The exploratory adapter expects `itemSales` records with `itemId`, `title`, `condition`, `itemWebUrl`, `buyingOptions`, `lastSoldDate`, `lastSoldPrice` and `totalSoldQuantity` where available. It preserves unknown fields as null/empty values rather than fabricating facts. A changed or missing response envelope is a failure, except an explicit `total: 0` response. This field mapping has been exercised against one populated Sandbox fixed-price record; broader formats and pagination still require live coverage.

Each record is a **listing summary**, not an individual paid transaction. A quantity-sold count is never expanded into invented sales. Payment verification and shipping are unknown. Dates outside the requested window and missing/invalid last-sold prices are excluded from statistics. Records retain source IDs/URLs and matched queries; the enclosing summary supplies marketplace and collection window.

For each query/currency, the script computes count, minimum, median and maximum of eligible last-sold prices using decimal-safe arithmetic. Fewer than three observations yield `insufficient_evidence`. No returned records yield empty groups. Amounts from different currencies are never combined. These initial statistics do not perform automatic condition, bundle or variation matching; the LLM must assess relevance before suggesting a range.

The LLM instructions require evidence IDs, item/condition comparisons, outlier analysis and disclosure of missing data and sample limitations. Listing text is untrusted evidence. The model must not invent comparables or amounts, treat listing summaries as paid-order records, or use Sandbox data for real pricing. Once permitted, the bundle can be supplied to an LLM without manually opening listings. Model invocation is outside this initial implementation.

External handoff is recorded as `not_authorized_or_tested`. Confirm the permitted use before sending Restricted API data to an external model: eBay's terms require prior written consent for that use. [Restricted API terms](https://developer.ebay.com/join/api-license-agreement).

## Observed Sandbox results

Authenticated tests on 5 October 2026:

| Search | Window / cap | Result |
| --- | --- | --- |
| `Barbour Bedale wax jacket` | 30 days / 5 | Basic OAuth 200, sold-scope OAuth 200, search 200; zero records. |
| `iphone` and `camera` | 90 days / 20 per query | Both OAuth requests 200, both searches 200; zero records for each query. |

The runs produced all three output files. No credentials or token responses were saved. No Production endpoints were called, no listings were created and no data was sent to an LLM.

Follow-up diagnosis found a populated case. `iphone` returned zero in both UK and US, including without a date filter. `camera` returned zero in UK but one in US, both with and without the 90-day date filter. An intentionally invalid date filter returned HTTP 400 (100011), confirming the endpoint validates that filter.

This command also returned one normalized record through the actual collector, with its default 30-day window:

```sh
npm run investigate:ebay -- --environment sandbox --marketplace EBAY_US --query camera
```

The source record was `v1|110590598319|0`, titled `LB-SBX-202609090448-43a2069c Revised Camera Test`, with last-sold date `2026-09-09T05:06:35.000Z`, source-reported last-sold price USD 21.99 and buying options `FIXED_PRICE` / `BEST_OFFER`. Those options do not establish whether an offer was accepted. The collector retained it without a price/date exclusion and generated all output files. Its single observation correctly yields insufficient evidence for a price summary. This test record may later disappear or age out of the window.

The evidence points to sparse, marketplace-specific Sandbox data for these queries, rather than a parser dropping results or a broken date filter. It does **not** establish real-world price quality, Production entitlement or external-AI permission. Sandbox contains simulated listings and transactions, not live market data. [eBay environment guide](https://developer.ebay.com/api-docs/static/gs_understand-the-sandbox-and.html).

Seven isolated collector tests cover explicit environment/argument validation, scope denial and redaction, pagination and both sale formats, cross-query deduplication, empty/malformed/denied responses, hostile pagination URLs, record caps and decimal arithmetic. Their responses are synthetic test inputs, never a source for the collector's live output.

```sh
npm run test:ebay
```

## Next evidence needed

Extend the observed US camera case with additional populated records, formats and pagination, and validate field meanings against the entitled method reference. One populated response does not establish complete coverage. The current method documentation redirects to authenticated access. [Item-sales search reference](https://developer.ebay.com/api-docs/buy/marketplace-insights/resources/item_sales/methods/search).

For a real-data test, configure a separate Production keyset in `.env.production` and explicitly select `--environment production`. Marketplace Insights remains restricted and not open to new users according to eBay's public access notice; Sandbox success does not settle Production access. [Marketplace support](https://developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html).

The completed-sales acceptance target remains: terms alone discover recent sold records across formats, output is traceable and useful for permitted LLM pricing analysis, and missing/hidden amounts and sampling limits remain explicit. The superseded Trading user-token/manual-ID collector and its XML dependency have been removed. Broader integration questions remain in [EBAY_INTEGRATION.md](EBAY_INTEGRATION.md).
