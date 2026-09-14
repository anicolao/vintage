# Product UI and saved items

The production interface follows `UX_DESIGN.md`: the specified sign-in copy and Google control, followed by Your listings; New listing opens photo entry. Desktop keeps the same 393px workspace as the phone. There is no draft-name form, promotional dashboard, diagnostic route or workspace-note schema.

The sign-in background is an independently generated garment photograph in `static/images/wardrobe.png`; no mockup is used as an interface or background. Self-hosted Inter Variable provides the sans-serif typography at 400–600 weights; DM Serif Display renders the wordmark. Google logo, semantic icons, fine glass highlights, controls and text are rendered natively. Translucent gradient surfaces use 20px backdrop blur (including the Safari-prefixed property), with separate readable input fills and softly highlighted primary actions. System appearance is CSS-driven before JavaScript and while editing. Solid surfaces for reduced transparency and unavailable blur implement the accessibility behavior required by the design.

Your listings uses actual cover photos, current photo counts and edit dates. Drafts remain Untitled item until a real title exists. The first listing opens a camera-first capture surface with optional context underneath. Unknown routes and inaccessible items use the shared recovery design; transient fetch failure stays retryable.

## Item persistence

```text
workspaces/{workspace}/accounts/{uid}
workspaces/{workspace}/accounts/{uid}/events/{eventId}
workspaces/{workspace}/accounts/{uid}/listings/{listingId}
workspaces/{workspace}/accounts/{uid}/listings/{listingId}/events/{eventId}
workspaces/{workspace}/accounts/{uid}/listings/{listingId}/photos/{photoId}/{original|preview}
```

Each event and descriptor version advance in one atomic batch using a server-side version increment. Schema 2/reducer 1 accepts account creation, item creation, context changes and photo upload/remove/reorder events. Unsupported schemas and malformed/foreign events produce diagnostics. There is no compatibility implementation for previous schemas. Client writes cannot author generation events or modify/delete existing events.

Event IDs combine UID, stable device ID and a sequence allocated atomically in IndexedDB across tabs. Delivery intents are retained before network delivery. Retries reuse event IDs; an identical repeated batch is rejected atomically, then acknowledged by readback without advancing the version twice. A descriptor's `version` covers every relevant event and is the value future commands must check transactionally.

## Photo entry

Selecting an item starts an owned stream without asking for a name. Photo files and camera input accept JPEG, PNG, WebP and HEIC/HEIF, up to 8 photos at 10 MB each. Originals remain untinted and immutable. HEIC originals are retained alongside a browser-readable JPEG preview; this client preview conversion is not the server analysis normalization planned for milestone 3.

Selected bytes are retained in IndexedDB until upload and local event enqueue succeed. Pending tiles keep their local image and a discreet sync badge. Offline status says Saved on this phone; invalid files offer replacement/removal, and interrupted transfers offer retry. Interrupted selections can be recovered on the same device. Authenticated reads restore thumbnails after reload without shareable download tokens. Inspection uses a centered mobile-width full-height dialog with a filmstrip, Make cover, Replace and Remove. Removal offers Undo. The order menu supports keyboard/touch movement, and tiles also support drag ordering. Replacement retains position. Uploads run independently of the screen and continue after navigation. Local thumbnails appear before upload; authenticated previews are cached on the device. Navigation and controls do not wait for network acknowledgement.

`Anything else?` is a single-line field. Changes enqueue on input. Routine saves stay quiet; offline retention and actionable errors appear contextually. `data-sync` exposes delivery completion for automation without a permanent Saved label. The shared account sheet shows identity and privacy reassurance. Sign-out explains any device-only changes and offers Keep working before detaching the user's streams and removing their UI state. Local work stays scoped to its original account. Returning opens Your listings. Firestore uses persistent multi-tab cache and local batch snapshots; the retained-command projection covers the interval before those snapshots arrive. Offline edits and new listings sync on reconnection.

Seller-history ingestion and AI generation are not implemented in this PR. The generation CTA is therefore not shipped as a dead or simulated action. The remaining pipeline belongs to its implementation milestones; the UI does not claim that photos have been analyzed or a proposal generated.

## Verification

Use the live PR URL: sign in, add photos, enter context, reload, inspect/reorder/replace/remove photos, switch system appearance while editing, then verify another account cannot open the item. Production metadata is in `/version.json` and the CI artifact, outside product screens.

Automated tests cover current owner rules, event replay, actual image upload/read, HEIC conversion, direct reload, system appearance, focus, touch targets and visual comparison on all four phone/desktop appearance projects. Superseded diagnostic tests and screenshot baselines are deleted.
