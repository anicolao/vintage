# Current app screen references

These are browser captures of the merged application at `e13c6ba` (the main-branch merge containing the photo-first flow and typography/glass refinements). They supplement the original concept images in `docs/mockups/`; they are not generated mockups or previews of unimplemented features.

Captures use the repository's pinned Playwright/Nix renderer, a 393 × 852 CSS-pixel viewport, device scale 1, and both system appearances. Firebase emulators provide an isolated sample account, Alex Seller. The garment image is `static/images/wardrobe.png`; it is sample input, not an automatically inserted item photo. The `not-found` pair was captured separately from the signed-out live main site at an unmatched URL. No live account or private listing data is pictured.

| File pair | State exercised |
| --- | --- |
| `listings-empty-{light,dark}.png` | Sign in with an account that has no items |
| `listings-populated-{light,dark}.png` | Return to Your listings after creating an item |
| `photos-empty-{light,dark}.png` | Choose New listing before selecting any photo |
| `photo-inspection-{light,dark}.png` | Upload an image, then open its thumbnail |
| `account-{light,dark}.png` | Open the avatar dialog from photo entry |
| `item-unavailable-{light,dark}.png` | Open a nonexistent item URL while signed in |
| `upload-error-{light,dark}.png` | Select an unsupported text file alongside a valid photo |
| `not-found-{light,dark}.png` | Open an unmatched URL on the signed-out main site |
| `offline-edits-{light,dark}.png` | Disconnect after one saved photo; enter context and select another photo |

The capture run also reconnects and verifies that the second photo completes upload before returning to Your listings. Native Google and camera UI are deliberately not simulated in these images; their provider/platform-owned behavior is described in `UX_DESIGN.md`.
