# eBay data collection proof

Status: local collection script implemented; real eBay access and response coverage have not yet been verified. Background: [completed-auction access research](./EBAY_INTEGRATION.md#completed-auctions-pricing-evidence-and-actual-access).

## What we need to prove

Can we call eBay with our credentials, retrieve real completed-auction information, and parse the response into useful fields?

Start with one local Node.js script, run manually against a few known item IDs. Its output is enough to review whether the basics work. A cloud function and a webpage can follow if collection succeeds.

## Authentication and trying it

Trading `GetItem` requires a user token. An application-only token or anonymous request is not sufficient. One investigator's eBay account is enough to try this; we do not need to build a Vintage login flow. Request public item details by item ID, including a non-owned auction, to establish actual visibility. [Trading authentication](https://developer.ebay.com/api-docs/user-guides/static/make-a-call/using-xml.html).

Obtain a **Production OAuth user access token** for your developer application through eBay's user consent/token process. Use an eBay account for that consent; a developer application key alone is not a user token. This script consumes the resulting token directly: it does not need the client secret and does not implement token generation or refresh. Auth'n'Auth tokens are not supported by this script. [eBay authorization guide](https://developer.ebay.com/develop/guides/sell/authorization).

In zsh, paste the token into a hidden prompt so it is not saved in shell history:

```sh
read -rs 'EBAY_USER_TOKEN?eBay OAuth user token: '
export EBAY_USER_TOKEN
```

Then run the command below, replacing `SITE_ID` and the item-ID placeholders with actual numbers. Add `--sandbox` only when using a Sandbox token and Sandbox items. Use `--help` for usage. Afterward, `unset EBAY_USER_TOKEN`. Keep tokens out of chat and committed files.

## Inputs and one run

Provide an existing eBay user access token through an environment variable and 3–5 known item IDs as command arguments. Include a recently completed successful auction, an unsuccessful auction if available, and an active listing for comparison. Include a non-owned listing: reading only our own listings would not prove comparable-item access.

Run from the worktree after `npm ci`:

```sh
npm run investigate:ebay -- --site-id SITE_ID ITEM_ID_1 ITEM_ID_2 ITEM_ID_3
```

The token is not a command argument or committed configuration. Supply the Trading site ID for the marketplace being investigated. Label Sandbox and Production results explicitly; only real listings establish whether useful market data is accessible.

For each ID, the script makes one Trading API `GetItem` request, records the HTTP status and eBay acknowledgement/errors, and parses the XML response. Use a request timeout; report a failure and continue to the next ID. Retry manually if necessary. HTTP 200 alone is not success: inspect the eBay response too.

This is a lookup of known items. `GetItem` does not discover completed auctions, and its documentation says listing details are unavailable more than 90 days after ending. The first experiment establishes actual visibility with our credentials before we design discovery. [GetItem reference](https://developer.ebay.com/devzone/xml/docs/Reference/ebay/GetItem.html).

## Output to inspect

Print a small table and save a JSON file with one record per requested ID:

| Field | Purpose |
| --- | --- |
| Item ID, fetched time, site/environment | Identify what was requested |
| HTTP status, eBay acknowledgement/error | Establish whether access worked |
| Title, listing type, end time, listing status | Identify the item and whether it has ended |
| Current price and currency | Extract the numeric price without losing its meaning |
| Bid count, reserve met, quantity sold, sold-as-Buy-It-Now flag | Inspect whether the auction appears to have sold |
| Missing fields / parse error | Make incomplete responses visible |

Preserve missing values as missing, not zero or false. Beside the JSON, save a sanitized XML response excerpt containing the relevant item and error fields so we can compare the parser's output with eBay's response. The excerpts are rebuilt from allowlisted XML fields before numeric/boolean conversion; they are not full wire-response captures. Each run writes `.cache/ebay/run-*/results.json` and an XML excerpt per parseable response. This directory is gitignored; exclude credentials, bidder/buyer details and unrelated personal data.

For now, inspect the outcome fields directly. An ended listing is not necessarily sold, and its current price may be a starting price or highest bid rather than a paid transaction. Do not build a price estimator until we have seen the actual responses. [Selling status fields](https://developer.ebay.com/devzone/xml/docs/Reference/ebay/types/SellingStatusType.html).

## Done when

The implementation uses one request per distinct ID (maximum five), a 15-second timeout, and no automatic retries. It reports missing or invalid fields, preserves price as a decimal string with currency, and distinguishes eBay errors from HTTP success. Exit status is 0 for successful lookups, 1 if any lookup fails, and 2 for setup errors. Failed or non-XML responses appear as errors in JSON; no unsanitized body is saved.

Run the script once with real credentials and inspect the saved response fields against the JSON. Write a short findings note: which IDs worked, whether non-owned completed auctions were readable, which price/outcome fields were present, and what remains unclear. Access denial or missing data is a useful result; record it without fabricating sample output.

No automated test suite is required for this proof. Manual comparison of a handful of actual responses is the verification. Keep real-data findings separate until an authenticated run has happened.

Defer scheduling, Cloud Functions, Firestore, dashboards, account-linking UI, automatic discovery/retries, price history, statistical estimates and production operations. Review the collection findings before choosing the next step.
