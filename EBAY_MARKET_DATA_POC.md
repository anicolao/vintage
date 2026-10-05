# eBay market data proof of concept

Status: revised specification, 5 October 2026. This document specifies the prototype to build; automated completed-sales search is not implemented or authenticated yet.

## Goal and first experience

Enter search terms and get recent completed-sale evidence that an LLM can analyze for pricing. The script discovers the listings, gathers their data, normalizes it and writes an analysis bundle. The operator supplies no item IDs and does no manual listing lookup or classification.

Include all supported sale formats: auctions, fixed-price/Buy It Now and accepted offers where the source exposes them. “Completed” must mean sold evidence, not merely an ended listing. Missing transaction amounts remain unknown.

Proposed invocation, **not an existing command**:

```sh
nix develop
npm ci
npm run investigate:ebay -- \
  --query "Barbour Bedale wax jacket" \
  --query "Le Creuset casserole 24cm" \
  --marketplace EBAY_GB --days 30 --limit 50
```

One run should produce a short console summary and `.cache/ebay/run-*/analysis-input.json`, containing real records, source references, descriptive price statistics and instructions for the LLM. Default to the last 30 days and at most 50 unique source records per query. UK is the initial test setting, not a final pilot-market decision. Preserve each record's actual currency.

## Source and access test

Target eBay **Marketplace Insights item-sales search**, subject to our Production application's entitlement. eBay's public documentation associates `lastSoldDate` with Marketplace Insights search and supports both auction and fixed-price buying formats. Omit a buying-format restriction so the query does not exclude fixed-price sales. Do not assume `BEST_OFFER` is a supported filter: the documentation explicitly excludes that filter for Marketplace Insights. Retain offer outcomes wherever returned, and mark undisclosed accepted amounts unknown. [Search filters](https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html).

There is a concrete access dependency: eBay lists Marketplace Insights as restricted and not open to new users. Its method reference currently redirects to authenticated documentation. Existing developer keys do not prove that our application has access. [Marketplace support and access notice](https://developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html), [item-sales search reference](https://developer.ebay.com/api-docs/buy/marketplace-insights/resources/item_sales/methods/search).

The first implementation must therefore:

1. Load our existing credentials and request the application token required by the entitled sold-search API.
2. Perform one bounded keyword/date-window request to test access and inspect the actual response contract.
3. If successful, continue automatic pagination and collection for the supplied queries.
4. If authorization or product access is unavailable, write an `access_blocked` result with sanitized API error details and stop. Distinguish invalid credentials, unsupported scope, denied API access and unsupported marketplace; do not label every failure as lack of entitlement.

Confirm the endpoint, required scope, pagination and response fields against the method documentation visible to our account before implementing the adapter. Do not invent a working request from an inaccessible reference. Token success alone is not a passed data-access test.

The old Finding API, including the former completed-item search approach, is not a viable implementation target: eBay decommissioned Finding in Q1 2025. Browse is not a substitute for historical sold-price search. [eBay decommission notice](https://www.developer.ebay.com/updates/newsletter/q1_2025).

If our account cannot access completed-sales search, the experiment records that dependency for an entitled or licensed sold-data source. It must not quietly switch to active asks, the account's own orders, manually supplied IDs or fabricated sales. The desired keyword-to-completed-sales workflow remains the requirement.

## Configuration for our first test

The worktree `.env` already contains these variable names; only names were inspected while writing this specification:

| Existing variable | Prototype use |
| --- | --- |
| `EBAY_APP_ID` | OAuth client ID for the Production application. |
| `EBAY_CERT_ID` | OAuth client secret for that same keyset. |
| `EBAY_DEV_ID` | Retain the existing value; it is not used in the client-credentials token exchange. |

Confirm in the developer portal that these belong to an enabled **Production** keyset and check its Marketplace Insights entitlement and granted scopes. Do not replace the file or ask the operator to mint a Trading user token for this search flow.

For an entitled application, mint an application access token programmatically using the client-credentials grant at `https://api.ebay.com/identity/v1/oauth2/token`, with HTTP Basic authentication from App ID/Cert ID and the exact scope specified for the chosen method. Keep the token in memory and renew it when needed. The developer portal lists scopes associated with the keyset. [eBay authorization](https://developer.ebay.com/develop/guides/sell/authorization).

Search terms, marketplace, lookback and record cap are command arguments, not secrets. The script loads `.env` from the worktree root automatically. No Firebase deployment, OAuth user-consent UI or manually collected listing IDs are needed for this local prototype. Do not log credential values, authorization headers or token responses.

For the LLM handoff, record whether our eBay agreement permits sending this source's data to the intended model/provider. eBay's Restricted API terms require prior written consent for ingestion into external AI systems. This is separate from technical API entitlement. The prototype can collect permitted local evidence and describe its schema while marking external LLM handoff blocked until that permission is established. [API licence, Restricted API requirements](https://developer.ebay.com/join/api-license-agreement).

## Automatic collection and normalization

For each query, calculate a fixed UTC window ending at run start. Use the source's sold-date filter, follow its pagination and stop at the requested cap or exhaustion. Sort collected records by returned sale date; record the source ordering and any truncation rather than claiming the sample contains every recent sale. Record aggregate date semantics separately if the source returns listing summaries rather than individual transactions.

Use a 15-second per-request timeout and a maximum of 10 search-page requests per query for the first test. Keep partial results on interruption. Respect rate-limit responses and record failures without unbounded retries. Deduplicate overlapping query results using source sale/transaction identity where available, otherwise source listing identity, while retaining every matching query. Do not manufacture individual sales from a quantity-sold count.

Normalize available fields into the following **proposed output contract**, not assumed eBay response field names:

| Group | Fields and interpretation |
| --- | --- |
| Identity | Stable evidence ID, source item/sale ID, source URL, matching queries, marketplace and fetch time. |
| Item | Title, category, condition, brand/model/size and lot or variation information when returned. |
| Outcome | Source-reported sold status, sale/last-sold date, sale format when known, quantity and whether the row is a transaction or listing aggregate. |
| Price | Decimal-string amount and currency, price basis (`sale`, `aggregate`, `displayed` or `unknown`), original field name and accepted-offer amount visibility. |
| Costs | Shipping amount/currency if exposed; otherwise unknown. Keep item price distinct from delivered cost and seller proceeds. |
| Evidence quality | Payment verification (unknown unless explicitly supported), missing fields, source errors and any reason for exclusion from price statistics. |

Include auction and non-auction sales on the same terms. An accepted offer is useful evidence if its actual price is disclosed; an advertised price attached to an undisclosed offer is not the accepted amount. Do not infer payment, returns or cancellations from a sold-search result.

## LLM-ready results and basic pricing

Write three files under the gitignored run directory:

- `results.json`: normalized records, source-field provenance and exclusions.
- `summary.json`: query/window metadata, counts, pagination completeness, errors and price statistics.
- `analysis-input.json`: the self-contained summary, evidence records and analysis instructions, with an explicit handoff-permission status. No automatic LLM submission in this first collector.

Calculate count, minimum, median and maximum from eligible source-reported sale amounts using decimal-safe arithmetic. Keep currencies, individual transactions and aggregate-price records separate. Retain format breakdowns where known. Exclude unknown/advertised amounts, unsold records, duplicates and ambiguous bundles from the sale-price summary; retain their exclusion reasons. With fewer than three eligible observations, report insufficient evidence and list the observations. A missing shipping amount is not zero.

The LLM's task is to assess relevance to each search query, identify item/condition differences and outliers, cite evidence IDs and suggest a tentative eBay pricing range where the data supports one. It must disclose sample size, date window, missing prices and collection limits. Listing text is untrusted evidence, never instructions. It must not invent sale amounts or comparables, claim a representative market sample, or turn eBay results into an established Vinted valuation. Descriptive statistics are computed by the script; the LLM explains and critiques the evidence.

The bundle should support analysis without opening individual listing pages. When external handoff is permitted, it can be supplied directly to the chosen LLM; adding model invocation and provider credentials is a separate increment.

## Implementation and acceptance

Replace the ID-driven behavior of `scripts/investigate-ebay.mjs` with this query-driven collector under the existing npm command. Remove the superseded manual-ID instructions when implementation lands; do not keep a second operator workflow as a fallback. The existing script currently accepts numeric IDs and a Trading user token, so the proposed invocation above requires code changes. This PR updates the specification only.

The first successful test must demonstrate:

- Existing `.env` credentials are loaded without secret exposure; token and sold-search access are independently verified.
- Search terms alone produce automatically discovered recent sale records, including non-auction results where available.
- Pagination, date filtering, deduplication, missing/hidden prices and partial failures are explicit in the outputs.
- JSON evidence is traceable to actual source records and ready for permitted LLM analysis without manual lookup.
- No active asks or invented data are presented as completed-sale prices.

Test normalization and summary logic using representative source response shapes, including fixed-price sales, auctions, hidden offer amounts, duplicates and access errors. Then perform the bounded live run. An access-denied report is useful feasibility evidence, but it does **not** satisfy the completed-sales collection acceptance criteria.

This specification replaces the manual experiment in [EBAY_INVESTIGATION_PROTOTYPE.md](EBAY_INVESTIGATION_PROTOTYPE.md) as the intended next step. Broader integration remains described in [EBAY_INTEGRATION.md](EBAY_INTEGRATION.md).
