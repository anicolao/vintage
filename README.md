# Vintage

[![CI](https://github.com/anicolao/vintage/actions/workflows/verify-and-preview.yml/badge.svg?branch=main&event=push)](https://github.com/anicolao/vintage/actions/workflows/verify-and-preview.yml?query=branch%3Amain+event%3Apush)

Vintage is an AI-first listing assistant for Vinted sellers. It turns photos into a complete listing draft written in the seller's own style and recommends a price designed to maximize expected revenue.

## The v0

The first version focuses on one complete workflow:

1. The seller provides photos of an item and, optionally, a one-line description.
2. Vintage studies the seller's existing Vinted listings to understand their language, structure, level of detail, and selling approach.
3. AI examines the photos, identifies relevant item details, and creates a listing proposal that matches the seller's established style.
4. Vintage recommends a pricing strategy based on the item, comparable listings, demand signals, and the tradeoff between sale price and likelihood of sale.
5. The seller reviews, edits, and approves the listing and price.

The v0 succeeds when this flow produces drafts and price recommendations that sellers trust and can approve quickly.

## AI-first listing creation

The photos are the primary input. Vintage uses them to propose:

- a title;
- category and item attributes;
- brand, size, colour, material, and condition where visible;
- a clear description;
- relevant condition details and visible defects; and
- a recommended price and pricing rationale.

The optional one-line description lets the seller add context beyond the photos, such as provenance, fit, fabric feel, or an unpictured detail.

Before generating a draft, Vintage analyzes the seller's existing listings. The proposal should feel like it belongs alongside their current listings: familiar wording, formatting, tone, detail, and conventions, strengthened by useful information detected in the new photos.

Every result is a proposal. The review screen makes the generated content, inferred attributes, and price recommendation easy to inspect and edit before approval.

## Pricing for seller revenue

Pricing guidance is a central part of the product. Vintage helps the seller choose the price that maximizes expected revenue. It evaluates the full relevant market and gives appropriate weight to the item's particular strengths and higher-value comparable listings.

The recommendation considers:

- the item's brand, category, condition, size, style, and apparent quality;
- the seller's historical listings and sales;
- the relevance and quality of comparable items;
- the distribution of comparable prices, including meaningful higher-value examples;
- buyer demand and expected time to sale;
- room for offers and negotiation; and
- the seller's preferred balance between price and speed.

Vintage presents a recommended listing price, an expected sale range, and a concise explanation of the evidence and tradeoffs behind them. Comparable listings provide market context while the recommendation reflects the value of the specific item and the seller's objective.

## v0 product goals

- Generate a credible listing from photos with minimal seller input.
- Match each seller's recognizable listing style and approach.
- Extract useful item details accurately from images.
- Make uncertain inferences visible during review.
- Recommend prices that improve expected seller revenue.
- Explain pricing clearly enough for sellers to make confident decisions.
- Reduce the time from taking photos to approving a listing.

## v0 success measures

We will evaluate the product using:

- median time from photo upload to approved draft;
- percentage of generated drafts approved;
- amount and type of editing before approval;
- accuracy of proposed item attributes and condition details;
- seller acceptance of recommended prices;
- achieved sale price relative to relevant market comparables;
- expected and realized revenue compared with the seller's usual pricing approach; and
- seller-reported confidence in the listing and recommendation.

## Project status

The production UI now follows the approved sign-in and photo-entry design with system appearance, live Google authentication, owner-scoped photos and automatically saved context. See [Product UI and saved items](./docs/DRAFT_FOUNDATION.md) and [Firebase setup](./docs/FIREBASE_SETUP.md). Seller-history learning and AI generation remain planned.

## Recording prompts

`PROMPTS.md` records user prompts verbatim, in append-only order. Start each entry with `Prompt N: Three word summary`, using the next number and exactly three summary words, then a blank line and the prompt exactly as typed. Preserve typos and line breaks. For multiple commits answering the same request, append that request again under the next number for each commit.

`npm install` and `npm ci` install the tracked pre-commit hook through the `prepare` script. For an existing checkout, run `npm run setup:hooks`. This sets this repository's `core.hooksPath` to `.githooks` (replacing any previous custom hooks-path setting).

Every commit must stage a new prompt entry along with its changes. The hook compares the **Git index** with `HEAD`, rejects edits or deletion of earlier prompt bytes, and checks sequential numbering, three-word summaries and nonempty prompt text. An unstaged entry does not count. Run `npm run check:prompts` to check the index and `npm run test:hooks` to exercise the hook in temporary repositories.

This is a local pre-commit check, not a server-side guarantee. It cannot establish that recorded text is authentic or semantically related to a change; preserving the exact user request remains the contributor's responsibility. The initial history covers the nine project prompts available in the recovery conversation, not unavailable earlier conversations. All work goes through a PR for review.

## License

Vintage is free software licensed under the [GNU General Public License version 3](./LICENSE).

Milestones 1–2 add system-following terracotta/linen appearances and durable listing drafts. See [Draft foundation](./docs/DRAFT_FOUNDATION.md) for the event/version contract, recovery behavior and live review steps.
