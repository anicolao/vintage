# v0 UX Design

## Experience goal

Vintage turns a handful of item photos into an editable Vinted listing and a revenue-oriented price recommendation. The experience should feel like handing an item to a skilled listing partner: the seller supplies the item, Vintage does the research and drafting, and the seller makes the final call.

The v0 is a mobile-first Svelte SPA designed at a canonical 393 × 852 CSS-pixel viewport. Desktop uses the same focused flow in a centered mobile-width workspace.

## Core flow

```text
Google sign-in
     ↓
Learn from existing listings
     ↓
Add item photos + optional one-line context
     ↓
Analyze photos, seller style, and market position
     ↓
Review and edit listing + pricing recommendation
     ↓
Approve listing
```

Progress is preserved after every meaningful action. Returning to an in-progress listing resumes at the latest state reconstructed from its event stream.

## Screen 1: sign in and learn the seller

![Vintage sign-in screen](./docs/mockups/01-sign-in.png)

Purpose: establish identity with Google and explain how the seller's listing history improves the result.

The primary action opens Google Account login. After authentication, Vintage creates the user's workspace and imports the existing listing material available to the account. Those listings become style and pricing context for future drafts.

The learning summary sets the expectation that Vintage studies:

- title and description structure;
- vocabulary, tone, formatting, and typical level of detail;
- the seller's treatment of condition and flaws; and
- their historical pricing approach.

The first import has a visible progress state and finishes at the photo screen. Later sessions move directly to the seller's latest in-progress draft or a new-item action.

### States

- Ready: `Continue with Google` is active.
- Authenticating: the button shows progress and remains in place.
- Learning: the screen reports listings found and analyzed.
- Ready to list: the new-item flow opens.
- Recoverable error: the message explains the failed step and offers `Try again`.

## Screen 2: add photos

![Add item photos screen](./docs/mockups/02-add-photos.png)

Purpose: gather enough visual evidence for a strong first proposal with minimal typing.

The seller can select files, use the device camera, reorder thumbnails, replace a photo, and remove a photo. The grid encourages complementary views: front, back, label, construction details, and visible wear. Each tile has an accessible name based on position and purpose.

`Anything else?` is an optional single-line input for information beyond the images, such as provenance, fit, fabric feel, or an unpictured detail. `Create my draft` becomes active when at least one image has uploaded successfully.

Upload progress appears on each tile. The CTA reports the aggregate state and advances only when every selected photo is durably stored.

### Interaction details

- File and camera input accept JPEG, PNG, HEIC, and WebP.
- Photos preserve their selected order.
- A photo opens into a full-screen inspection view.
- Reordering uses drag, keyboard move controls, and touch-friendly move actions.
- The browser confirms navigation while uploads are active.
- An interrupted upload can resume from the saved draft.

## Screen 3: build the draft

![AI draft generation screen](./docs/mockups/03-building-draft.png)

Purpose: make useful work and progress legible while Vintage produces the proposal.

The stage list corresponds to durable generation events:

1. Reading the photos
2. Matching the seller's listing style
3. Comparing the market
4. Building the price strategy

Completed stages remain checked after refresh because the screen is a projection of the listing event stream. The active stage is announced through an `aria-live="polite"` status region. The seller can leave the screen and return while processing continues.

The market message reinforces the pricing objective: determine the item's best market position using the complete relevant price distribution, item differentiation, demand, and negotiation room.

## Screen 4: review, edit, and approve

![Listing and pricing review screen](./docs/mockups/04-review.png)

Purpose: let the seller evaluate one coherent proposal and approve it confidently.

The review is a single scrollable form with two clear sections.

### Listing proposal

- Ordered photos
- Editable title
- Editable category, brand, size, colour, material, condition, and other attributes
- Editable description
- Visible markers for inferred fields and uncertain observations
- A `Written in your style` explanation showing which recurring seller patterns shaped the draft

Edits save as the seller works. Field-level undo restores the latest AI proposal. Vintage records the difference between generated and approved content as learning evidence for later drafts.

### Pricing proposal

The recommended listing price is the visual anchor. It is accompanied by:

- an expected sale-price range;
- the relationship between price, expected revenue, and time to sale;
- a seller-adjustable price control;
- evidence supporting premium positioning;
- relevant comparable groups and their price distributions; and
- room reserved for likely offers.

Selecting an evidence row opens a bottom sheet with the underlying comparable group, why it is relevant, its condition and attributes, and its contribution to the recommendation. Changing the price updates the expected range and sale-speed estimate.

`Approve listing` commits the current title, attributes, description, photo order, and chosen price as one approved proposal.

## Approval confirmation

Approval resolves to a compact success state within the review screen. It shows the approved price, confirms that the listing is ready, and provides a primary `Copy listing` action. The approved result remains available in the user's listing history.

## Visual language

The interface pairs a warm editorial sensibility with practical form controls:

- warm ivory canvas;
- deep charcoal type;
- rich plum for primary actions and pricing emphasis;
- muted sage for evidence, success, and completion;
- generous whitespace and an 8-pixel spacing grid;
- rounded surfaces with restrained borders and shadows;
- highly legible sans-serif type; and
- photography as the strongest visual element after price.

Motion communicates continuity between stages. The reduced-motion experience uses immediate state changes and static progress indicators.

## Accessibility contract

- Every control has a programmatic name and visible focus treatment.
- Touch targets are at least 44 × 44 CSS pixels.
- Text and interactive controls meet WCAG 2.2 AA contrast.
- The complete flow works with keyboard-only input.
- Validation and generation statuses are announced to assistive technology.
- Colour always has a text or icon counterpart.
- Photo order and AI uncertainty are available as text.
- Zoom and text scaling preserve action access and reading order.

## UX acceptance criteria

- A signed-in seller can reach photo entry immediately.
- A seller can provide photos and optional one-line context as the complete generation input.
- Generation progress survives reload and reports the current stage.
- The draft reflects recognizable patterns from the seller's prior listings.
- Inferred and uncertain content is easy to identify and edit.
- Pricing presents one recommendation, an expected range, and inspectable evidence.
- Approval captures exactly the content and price visible to the seller.
