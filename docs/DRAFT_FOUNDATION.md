# Appearance and durable drafts

Milestones 1–2 add `/listings/new` and `/listings/{id}` to the live Firebase SPA. Google sign-in restores the requested route. Home lists saved drafts by their replayed names; signing out or changing accounts detaches subscriptions and removes the old projection. Photos and generation remain later milestones.

## Appearance

`src/lib/styles.css` contains system-driven linen/rust and charcoal/apricot tokens. Inline canvas colours and native `color-scheme` in `src/app.html` apply before JavaScript. CSS media queries respond without replacing controls, so input, route and focus survive a system change. Glass has an opaque base fallback, with blur added only through `@supports`; reduced transparency uses solid surfaces and reduced motion disables animation. No image tint or mockup background is applied.

Shared cards, buttons and status components accompany shared native input, chip and focus styles. The browser suite covers four phone/desktop light/dark projects, 44px targets, text/control contrast, focus across theme changes and the reduced-transparency fallback. Snapshot changes require visual review at the pinned renderer and zero-pixel threshold.

## Cloud layout and compatibility

All paths retain milestone 0's PR/main scope:

```text
workspaces/{workspace}/users/{uid}                   existing connection-check note
workspaces/{workspace}/accounts/{uid}                account descriptor
workspaces/{workspace}/accounts/{uid}/events/{id}     account creation event
workspaces/{workspace}/accounts/{uid}/listings/{id}   listing descriptor
workspaces/{workspace}/accounts/{uid}/listings/{id}/events/{eventId}
```

The account stream is separate from the existing note document so older previews keep their exact schema. This is the scoped implementation of the conceptual `users/{uid}` streams in `V0_DESIGN.md`. New rules are additive: the old note and Storage contracts are unchanged. Update the approved backend digest when deploying these rules; older workflow revisions cannot redeploy an obsolete ruleset afterward. Queries read direct owner collections without filters or server ordering; no composite indexes are required. The default single-field indexes suffice.

## Events and command version

New writes use schema 2, reducer 1. Supported client events are `account/created` (`{}`), `listing/created` (`{title}`, 1–100 characters), and `context/changed` (`{context}`, at most 2,000 characters). Every envelope has the design's IDs, owner, sequence, correlation, causation and timestamps, plus `deviceId` and `streamVersion`. Schema 1's `context/changed` payload `{text}` is upgraded in memory to `{context}`. Original documents are never rewritten.

A descriptor and its event are written in one transaction. The descriptor's integer `version` advances exactly once per event; its `lastEventId` references that event. Rules enforce this relationship in both directions, reject skipped versions, deny descriptor/event deletion and event modification, and allow only the bounded client vocabulary. Future server commands must advance the same descriptor version for **every** event that can affect their inputs. Their `expectedVersion` must compare this integer inside the command transaction, not timestamps or a local event count. No client generation/approval privileges are introduced.

Pure replay validates envelopes and payloads, upgrades known old schemas, orders acknowledged events by server timestamp (including nanoseconds) and ID, places pending events afterward by client sequence and ID, and deduplicates IDs. An acknowledged copy supersedes its pending copy. Unknown/malformed/foreign events produce diagnostics and are not applied. Only acknowledged events advance the projected command version.

## Device identity, delivery and recovery

IndexedDB stores a stable random device ID, a monotonic sequence and an owner/workspace-partitioned delivery queue. One read/write transaction allocates sequence and intent atomically across tabs. Clearing browser site data creates a new random device identity rather than reusing an old sequence. No test identity or endpoint override is shipped in live builds; emulator browser tests use the actual Google popup with deterministic test email/display name through the same auth observer. Emulator builds require explicit E2E flags, the demo project and localhost; all three SDK endpoints are fixed to loopback.

Event IDs are `${uid}-${deviceId}-${clientSeq}`. Retries keep the original ID and payload. Delivery reads the event first; an identical acknowledged event returns successfully without writing again. Transactions create/advance the descriptor only for a new event. A tab closing after server acknowledgement but before queue cleanup therefore produces no duplicate on resume.

Pending actions are kept on the device until acknowledged, retried after sign-in/reload or reconnect, and surfaced as waiting rather than saved. Failed delivery exposes Retry saving and Discard unsaved change; discard removes only that draft's rejected local intent. Previously acknowledged cloud events remain immutable. Local queue errors are shown instead of claiming persistence. An entirely offline cold start cannot restore an account or cloud draft: this milestone does not promise offline-first browsing. Unsaved keystrokes are preserved through a theme change, but must be submitted with Save details to survive reload.

## Review checklist

Use the PR's live preview, not the emulator:

1. On a phone, sign in with Google, create a named draft and save details.
2. Reload its `/listings/{id}` URL and verify the title and details. Return home and resume it.
3. Change the system appearance with the textarea focused; verify its text, focus and route remain.
4. Sign out. Sign in with a second account and reopen the first draft URL: it must be unavailable.
5. Run the existing connection checks, including Storage, and record browser/device, revision and outcome on the PR.

Automated tests separately cover rules, replay/schema diagnostics, two-tab sequence allocation, an acknowledged retry, a rejected intent across reload/retry/discard, themes and screenshots. Real Google and phone results remain explicit review evidence.

Implementation references: [Firestore atomic transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [snapshot listeners and detachment](https://firebase.google.com/docs/firestore/query-data/listen), and [reduced transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-transparency).
