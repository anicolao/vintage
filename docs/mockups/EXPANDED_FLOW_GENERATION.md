# Expanded flow generation prompts

Generated on 2026-09-14 with the **built-in image generation tool** (`image_gen`). These are new target-experience concepts. No application screenshots were used as generation inputs.

The approved terracotta-and-linen photo concepts were inspected for visual direction. Each initial board below was generated from text, by concatenating the common prompt and its screen prompt with one separating space. Each board pairs light (left) and dark (right). Selected outputs are stored in this directory and embedded compactly in [UX_DESIGN.md](../../UX_DESIGN.md).

Targeted refinements used generated concepts as edit inputs. For a refinement mentioning Image 2, that reference was `05-your-listings.png`. Other refinements used that board's preceding generated version. Intermediate rejected versions are not project assets. The existing approved four screen pairs are unchanged.

## Common prompt

```text
Use case: ui-mockup. Generate a polished new Vintage mobile app design concept. Follow the approved design language: sophisticated terracotta-and-linen glassmorphism, airy rounded modern sans typography, fine glass edge highlights, blurred warm cloud backgrounds and generous spacing. No purple. Natural garment photography stays untinted. Light: linen #F7F0E6, rust #984831, charcoal text. Dark: warm charcoal #211C19, translucent charcoal glass, linen text, apricot #EDB59B buttons. Muted sage for supporting details. Design the desired product, not an implementation screenshot. Output a single board with TWO COMPLETE FLAT MOBILE SCREENS side by side, identical layout and content: LIGHT on left and DARK on right. SQUARE OUTPUT CANVAS, 2048 by 2048. Each mobile screen occupies exactly HALF THE WIDTH and the FULL HEIGHT of the square, making each screen a natural 1:2 mobile aspect ratio. Do not produce a tall portrait canvas or narrow stretched screens. No phone hardware, no perspective, no outer captions, no marketing slogans, no theme switch. Use 9:41 status bar and bottom safe area. Readable restrained text, 24px side padding, 44px minimum touch targets, crisp fine line icons, nuanced luminous translucent controls, no heavy blocky headings. All content must fit with comfortable spacing.
```

## 05-your-listings.png

```text
Screen: Your listings populated. Compact top bar with small elegant serif Vintage wordmark at left, round account avatar at right. Heading "Your listings". Three spacious vertical glass listing cards each with a generous square natural garment thumbnail at left, text at right and small chevron. First green chore jacket, "Green chore jacket", sage badge "Ready to review", "Just now". Second oatmeal knit, "Oatmeal knit", "Draft · 2 photos", "Yesterday". Third brown leather bag, "Leather shoulder bag", "Approved · £35", "12 Sep". Photo recognition is primary; no analytics or generic numbered names. Bottom anchored full-width rust/apricot glass button with plus icon "New listing". Small quiet line above button "Start with a photo." Keep airy breathing room.
```

## 06-first-listing.png

```text
Screen: Your listings empty. Same compact serif Vintage header and account avatar. Heading "Your listings". In middle, one elegant frosted-glass card with a fine sage camera icon inside translucent circle, heading "Your first listing", short two-line copy "Start with a photo. Add the details as you go." Small tasteful stack of blank linen photo frames behind the camera icon, not an illustration mascot. Lots of calm breathing space. Bottom anchored full-width glass primary button with plus icon "New listing". No fake sample listing, no marketing or onboarding tour.
```

Targeted refinement:

```text
Use case: ui-mockup edit. Image 1 is the edit target: paired light/dark empty Your listings concepts. Image 2 is the design reference for header and typography. Preserve square canvas, paired light/dark layouts, camera/photo empty-state illustration, exact copy, generous spacing and glass palette. Change only the header and typography: remove the hamburger menu entirely; place small serif Vintage wordmark top LEFT and avatar top RIGHT exactly as reference. Use the reference's modern rounded SANS-SERIF for Your listings, Your first listing, body and New listing button. Only Vintage wordmark remains serif. Keep headings restrained medium weight. No extra navigation, no other additions.
```

## 07-first-photo.png

```text
Screen: New listing photo entry before capture. Glass top bar back arrow, "1 of 3 · Add photos", avatar. Glass intro card "Show us the item" with "Start with the front. Add labels and any wear next." Large rounded frosted capture card, generous camera line icon, primary button "Take photo", secondary neutral glass button "Choose photos". Beneath capture card an optional text field in its own glass card, label "Anything else?", placeholder "Fit, provenance, or an unpictured detail". Bottom quieter unavailable button "Create my draft" with small helper "Add a photo to continue". No listing name field, no keyboard in image.
```

## 08-photo-inspection.png

```text
Screen: Photo inspection. Top floating translucent bar with close X on left, "Photo 1 of 3" centered and overflow ellipsis right. Large sharp olive chore jacket front photograph on neutral linen fills central 60% of screen, uncropped item and no tint. Under it compact horizontal strip with 3 thumbnails (front jacket selected with terracotta ring; back; woven label). Bottom floating glass toolbar with clearly labelled line-icon actions "Make cover", "Replace", "Remove". Remove is restrained warning tone, not dominant. Small caption under thumbnails "Cover photo" with sage check. Elegant image-first composition; no giant dark modal or action grid.
```

## 09-account.png

```text
Screen: Your account as an elegant tall bottom sheet over softly blurred Your listings. Small drag handle, heading "Your account", circular close X. Avatar, name "Alex", email "alex@example.com" in one calm identity row. Separate glass navigation row with fine sparkle icon "Your listing style", smaller "3 examples · Ready", chevron. Supporting copy "Examples help drafts sound like you." Neutral glass row "Privacy" with lock icon and chevron. Bottom separated restrained "Sign out" action. Sheet occupies lower two-thirds, focused purposeful controls, no theme chooser or technical connection panels.
```

Targeted refinement:

```text
Use case: ui-mockup edit. Image 1 is edit target: paired light/dark Your account sheet. Image 2 is the correct Your listings background reference. Preserve square canvas, both themes, account sheet geometry, rounded modern sans typography, identity, listing-style row, closing X and Sign out. Change ONLY two details: replace underlying blurred home with the reference home (Vintage at top left, avatar top right, Your listings heading, VERTICAL horizontal photo-and-text cards; no search icon, no top plus icon, no multi-column gallery). Replace the Privacy navigation row with small understated inline lock icon and exact text 'Your photos and drafts are private to your account.' No chevron or button for privacy. Keep the elegant glass styling and breathing room.
```

## 10-style-examples.png

```text
Screen: Your listing style / input. Glass top bar back arrow and "Your listing style". Heading "Make it sound like you". Short supporting copy "Paste a listing you've written. Your photos are saved." A glass form card labelled "Example 1" with text field label "Title" value "Oatmeal wool jumper" and multiline field label "Description" value "Lovely soft knit with a relaxed fit. A little bobbling at the cuffs, shown in the photos." Small removable chip below "1 example added". Secondary glass button plus "Add another example". Bottom primary glass button "Learn my style". Quiet helper "You can add more examples later." No Vinted login, no invented automatic account import, no pricing required.
```

## 11-learning-style.png

```text
Screen: Background style learning. Glass top bar back arrow, "Your listing style", avatar. Heading "Learning your style". Supporting copy "Looking at the examples you shared." Beautiful compact stack of frosted listing excerpt cards, subtle sage quotation-mark icon rather than big spinner. Glass progress list with completed sage tick "Reading 3 examples", current thin terracotta ring "Finding your tone", pending subdued circle "Saving your style". Below small calm copy "Your photos are saved. You can keep editing." Bottom neutral glass button "Back to photos". No percentage or countdown, no fake completion, no modal blocking.
```

Targeted refinement:

```text
Use case: ui-mockup edit. Edit this paired light/dark board. Keep the square canvas, layout, modern sans, glass palette, titles, three progress rows and Back to photos action unchanged. Replace ONLY the central stack of photographic listing cards with a similarly sized elegant stack of frosted TEXT EXCERPT cards. Seller examples are pasted title and description only, so there must be NO garment photos, NO favorite hearts or marketplace UI. Front card exact title 'Oatmeal wool jumper', excerpt 'Lovely soft knit with a relaxed fit. A little bobbling at the cuffs, shown in the photos.' Behind cards use 'Green chore jacket' and 'Leather shoulder bag' titles with short text lines. Add a small sage quote icon on the front card. Preserve readable text and generous spacing.
```

## 12-price-evidence.png

```text
Screen: Price evidence as a near-full-height frosted bottom sheet over blurred listing review. Handle, heading "Why £48?", close X. Short copy "Comparable items help explain the range." Glass summary card with large rust/apricot "£48", label "Suggested listing price", smaller "Expected sale £42–£48". Heading "Comparable listings". Two elegant rows with small jacket thumbnails, "Cotton chore jacket" / "Asking £52" / "Similar fabric and condition", and "Vintage work jacket" / "Sold £44" / "Similar cut; more wear". Each row has source link "View source" with external-link icon. Quiet small note "Illustrative evidence" because this is a concept. Supporting section "Room for offers" with one line "Start higher while leaving space to negotiate." Bottom neutral glass button "Back to review". Make evidence understandable; no invented accuracy percentages or unlabeled graph.
```

Targeted refinement:

```text
Use case: ui-mockup edit. Preserve this square paired light/dark price-evidence sheet's layout, typography, evidence rows, prices, glass surfaces and copy except the following small corrections. In the visible background above the sheet use a blurred review header '3 of 3 · Review' with back arrow and tiny olive jacket thumbnails; remove heart and overflow icons and the brown garment. Replace 'Illustrative evidence' note with 'Observed 12 Sep' (these values are illustrative only in the accompanying documentation, not a product state). Make Back to review a neutral translucent glass button in BOTH modes, with charcoal label in light and linen label in dark. Keep all other details unchanged.
```

## 13-approved-listing.png

```text
Screen: Approved listing and copy. Glass header back arrow, "Approved listing", avatar. Subtle sage check circle above heading "Ready to copy". Short line "Your approved version is saved." Beautiful glass card with olive chore jacket thumbnail left and "Green cotton chore jacket", price "£48" right. A second glass card preview labelled "Listing text", compact title and 4 lines of natural listing description, then small "View full listing" disclosure. Primary bottom glass button copy icon "Copy listing"; neutral secondary button "Your listings". Quiet explanatory line "Paste it into Vinted when you're ready." No confetti, no automatic publishing, no edit fields on immutable approved version.
```

Targeted refinement:

```text
Use case: ui-mockup edit. Make exactly one targeted accessibility correction to this square paired light/dark approved-listing board. On the DARK RIGHT screen only, change the Copy listing button label and copy icon from white to opaque warm charcoal #2B2521, retaining the apricot button background. Preserve all other pixels/layout/content/palette as closely as possible. Light left button remains rust with white icon and text.
```

## 14-offline-photos.png

```text
Screen: Photo editor during offline work. Glass header back arrow "1 of 3 · Add photos", avatar. Heading "Show us the item". Compact sage-tinted translucent status strip cloud icon "Saved on this phone", smaller "Photos will sync when you're connected." Two-column glass grid: two natural olive jacket front/back images, each discreet cloud-outline badge; third dashed glass Add photo tile. Anything else glass text field contains "Fits oversized; small mark on the cuff." Bottom primary button "Create my draft". Small helper below "We'll start when you're connected." All camera, text and navigation controls remain available. No zero-percent progress bar, technical jargon, scary error dialog, or falsely successful cloud save.
```

## 15-recovery.png

```text
Screen: Calm unavailable listing recovery. Glass header back arrow, small Vintage wordmark, account avatar. A spacious centered frosted card with small fine-line folded-photo icon in sage, heading "Listing unavailable", body "This link may be out of date, or this listing belongs to another account." Primary glass button "Your listings". Secondary text action "Switch account". Small reassuring footer "Your other listings are safe." No framework 404, stacktrace, robot mascot, alarming red banner, no invented listing details. Layout feels part of the same premium calm app.
```

Targeted refinement:

```text
Use case: ui-mockup edit. Make one targeted typography consistency correction to this square paired light/dark recovery board: change ONLY the 'Vintage' wordmark in both top headers to the refined serif brand typography used in the approved designs. All other headings and controls stay modern sans-serif. Preserve composition, glass, colours, copy and all other details.
```
