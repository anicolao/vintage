# Vintage

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

The project is currently defining and validating the v0 experience. [VISION.md](./VISION.md) describes the enduring product vision and principles.
