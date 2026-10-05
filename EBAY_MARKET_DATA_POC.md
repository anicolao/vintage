# eBay market data proof of concept

Status: first-test specification, 5 October 2026. No authenticated eBay run or market-data access has been verified for this document.

## Goal

Use our existing eBay developer account to retrieve a few real listings and answer two questions:

1. Can our application read useful price and outcome fields, including for another seller's recently ended auction?
2. Can we make a small, clearly labelled price comparison from those responses?

Run the existing [local collector](scripts/investigate-ebay.mjs) manually. It already implements Trading API `GetItem`, JSON output and sanitized XML excerpts. The [earlier prototype notes](EBAY_INVESTIGATION_PROTOTYPE.md) describe its implementation; this document is the first-test checklist and basic pricing exercise. No collector changes are required to try it.

## Smallest useful experiment

Choose one narrow item type, such as one brand and model of used jacket, and gather **3–5 numeric eBay listing IDs** manually from listing URLs or our account history:

- One active fixed-price listing, for asking-price context.
- Two recently ended auctions that appear to have sold, ideally comparable items.
- One ended auction that appears unsold, if available.
- Optionally one listing owned by the account granting access, to compare field visibility.

Include at least one **non-owned ended auction**. Prefer single-item listings without variations or bundles. Record each source URL and why the item belongs in the comparison. If appropriate examples cannot be found, record that limitation rather than substituting unrelated items.

Use UK/GBP as the proposed first-test market; this is an experiment default, not a pilot-market decision. UK Trading site ID is `3`. Preserve the actual response currency even when requesting site 3. [eBay site codes](https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/SiteCodeType.html).

`GetItem` retrieves known IDs; it does not search for completed sales. eBay documents a 90-day limit on retrieving ended listing details, and some fields depend on whether the caller owns the listing. Prefer listings ended within the last week, after end-of-listing processing has settled. [GetItem reference](https://developer.ebay.com/devzone/xml/docs/Reference/ebay/GetItem.html).

## Configure before the first test

| Setting | What we need |
| --- | --- |
| Developer application | An enabled **Production** keyset in our eBay developer account. Sandbox credentials do not retrieve real market listings. |
| Authorizing account | One real eBay user who can consent to our application. Developer-account access alone is not a user access token. |
| Token | A fresh **OAuth User access token** from that Production keyset. The collector does not accept an application-only token, refresh token or Auth'n'Auth token. |
| Local secret | `EBAY_USER_TOKEN` in the worktree-root `.env` file. This file is already gitignored. |
| Marketplace | `--site-id 3` for this UK test. |
| Inputs | 3–5 real numeric item IDs, with source URLs and expected listing types recorded separately. |
| Runtime | The repository's Nix development environment and installed npm dependencies. |

### Obtain the token

In the developer portal, open **Application Keys → Production → User Tokens**. Under **Get a User Token Here**, choose **OAuth (new security)**, sign in with the real eBay account and grant access. Copy the returned user access token. Generate it shortly before testing; it is short-lived.

If the portal requires sign-in configuration, configure the Production RuName with the application's display title, privacy-policy URL and accepted/declined URLs. Follow the portal's OAuth setup; the collector itself needs only the resulting token and implements no callback or refresh flow. [eBay authorization and portal token instructions](https://developer.ebay.com/develop/guides/sell/authorization).

Confirm the Production keyset is enabled before testing. If the portal flags account-deletion notification requirements, resolve those in the application settings under eBay's documented process. Record an unresolved account requirement as a setup blocker. [Account-deletion setup](https://developer.ebay.com/develop/guides/sell/marketplace-user-account-deletion).

Add this entry to `.env`, preserving any existing entries:

```dotenv
EBAY_USER_TOKEN="paste-the-production-OAuth-user-access-token-here"
```

The collector reads this file automatically; its token takes precedence over an exported variable. No App ID, client secret, refresh token, Firebase setting or browser UI change is needed in the collector configuration. Keep the token out of commands, screenshots, findings and commits.

## Run once

From the repository root:

```sh
nix develop
npm ci
npm run investigate:ebay -- --help
```

Then replace the placeholders below with the selected numeric IDs:

```sh
npm run investigate:ebay -- --site-id 3 ITEM_ID_1 ITEM_ID_2 ITEM_ID_3
```

Production is the default; do not add `--sandbox` for this test. The script performs one request per distinct ID, up to five, with a 15-second timeout per request and no automatic retries. It prints a table and saves `.cache/ebay/run-*/results.json` plus allowlisted XML excerpts. These local outputs are gitignored.

Inspect HTTP status **and** eBay acknowledgement/errors. Exit status `0` means the lookups succeeded, `1` means at least one failed, and `2` means setup failed. Lookup success does not establish that a price is usable. If authentication expires, replace the token and rerun manually. If an ID is unavailable, retain the error as a finding; do not treat it as an unsold item.

## Data and basic pricing exercise

The collector already records:

| Fields | What to inspect |
| --- | --- |
| Requested/returned item ID, fetch time, site, environment | Identity and provenance |
| HTTP status, acknowledgement, errors, missing/invalid fields | Whether the response is usable |
| Title, listing type, end time, ending reason, listing status | Item context and completion state |
| Current price as a decimal string, currency | Observed amount and units |
| Bid count, reserve met, quantity sold, sold-as-Buy-It-Now | Evidence needed to interpret an auction outcome |

Compare the JSON with the corresponding sanitized XML. Preserve missing values as unknown. The script does **not** collect shipping, fees, paid-order confirmation or enough attributes to rank comparables automatically.

For the first run, manually annotate each record in a local findings note:

| Price group | Treatment |
| --- | --- |
| Active fixed-price ask | Report as an asking price only. |
| Active auction | Report as a starting price/current bid; exclude from completed-auction summaries. |
| Completed auction with consistent winning-sale evidence | Report as an observed winning bid, payment unverified. Require completed processing, positive bids and sold quantity, satisfied reserve, and no contradictory ending reason or Buy It Now outcome. Missing decisive fields leave the outcome unknown. |
| Unsold, Buy It Now, missing or ambiguous outcome | Keep separately with the reason; exclude from the winning-bid summary. |

`CurrentPrice` can mean a starting price, current highest bid or fixed asking price; it does not establish payment. Buy It Now outcomes must not be valued from an auction's bid field. [SellingStatus field semantics](https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/SellingStatusType.html).

Within each comparable group and currency, report the included IDs, count and individual prices. If at least three suitable observations exist, manually calculate minimum, median and maximum, keeping asks and winning bids separate. With fewer observations, list the prices and state **insufficient sample for a summary**. Use exact decimal amounts; do not convert currencies or interpret missing shipping as free shipping.

This is a descriptive comparison of a hand-selected sample. It does not produce a Vintage recommended price, paid-sale range, sale probability or time-to-sale estimate. The first mixed sample may yield no aggregate at all; useful field-access evidence still makes the test worthwhile.

## First-test result and next decision

Write a short local findings note alongside the output, containing:

- Run date, environment/site, source URLs and selected item IDs; no credentials.
- Which owned/non-owned lookups worked, and which fields were absent.
- Per-item price interpretation, inclusion/exclusion reasons and any eligible summary.
- Errors or discrepancies found when comparing JSON with XML.
- Conclusion: **access demonstrated**, **access blocked**, or **access works but pricing evidence is insufficient**.

The first test is complete when every selected ID has a recorded response/error and its price meaning has been reviewed. Successful external ended-auction reads establish limited known-item access, not market-wide discovery or pricing quality.

If the results are useful, propose a second bounded collection with more comparable items and the missing condition/shipping fields. Decide discovery and repeat collection from the observed access results. Scheduling, cloud storage, dashboards, AI processing and integration into Vintage pricing are outside this first test. Broader integration questions remain in [EBAY_INTEGRATION.md](EBAY_INTEGRATION.md).
