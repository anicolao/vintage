# End-to-End Testing Guide

## Contract

Playwright E2E tests are the primary executable demonstration of the v0. Every user-visible state is verified semantically and compared with a committed screenshot at zero-pixel tolerance.

The approach follows Food's unified `TestStepHelper` and screenshot convention, combined with Jaipur's Firebase emulator orchestration, deterministic Chromium rendering, event replay assertions, and per-viewport baselines. Vintage sets `maxDiffPixels: 0` globally and at every screenshot call.

## What an E2E run contains

One command starts and owns:

- the Firebase Auth emulator;
- the Firestore emulator;
- the Storage emulator;
- the Functions emulator with the deterministic AI fixture provider;
- the built Svelte SPA on a fixed localhost port; and
- Playwright Chromium.

The command exits with the Playwright result and shuts down the processes it started.

```sh
npm run test:e2e
```

Snapshot updates are deliberate:

```sh
npm run test:e2e:update-snapshots
```

CI runs the same package script in the pinned development environment.

## Emulator configuration

`firebase.json` assigns fixed local ports and enables one emulator project:

```json
{
  "emulators": {
    "auth": { "host": "127.0.0.1", "port": 9299 },
    "firestore": { "host": "127.0.0.1", "port": 8280 },
    "storage": { "host": "127.0.0.1", "port": 9290 },
    "functions": { "host": "127.0.0.1", "port": 5101 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

The test script uses an explicit demo project and emulator execution:

```json
{
  "scripts": {
    "test:e2e": "firebase emulators:exec --project vintage-e2e --only auth,firestore,storage,functions \"playwright test\"",
    "test:e2e:update-snapshots": "firebase emulators:exec --project vintage-e2e --only auth,firestore,storage,functions \"playwright test --update-snapshots\""
  }
}
```

Vite receives explicit emulator environment values through Playwright's `webServer.env`. The client calls `connectAuthEmulator`, `connectFirestoreEmulator`, `connectStorageEmulator`, and `connectFunctionsEmulator` before its first Firebase operation.

## Test tree

Each scenario owns its specification, generated verification document, and committed screenshots:

```text
tests/e2e/
├── fixtures/
│   ├── jacket/                         stable input photos
│   ├── seller-history.json             stable prior listings
│   └── jacket-proposal.json            stable AI result
├── helpers/
│   ├── emulator.ts                     reset and seed APIs
│   ├── auth.ts                         deterministic emulator user
│   └── test-step-helper.ts              unified verify/capture/docs API
├── 001-google-auth-and-style/
│   ├── 001-google-auth-and-style.spec.ts
│   ├── README.md
│   └── screenshots/
├── 002-add-photos/
├── 003-generate-draft/
├── 004-review-edit-and-approve/
├── 005-reload-and-replay/
└── 006-user-data-isolation/
```

Scenario directories use a stable numeric prefix. Screenshots use the helper-generated pattern `000-step-name-project-platform.png`.

## Canonical scenarios

### 001 — Google auth and seller style

Verify the signed-out screen, emulator authentication, user ownership, seeded existing-listing import, visible import progress, style profile completion, and transition to photo capture.

### 002 — Add photos

Upload the checked-in jacket fixtures, verify thumbnail order and persisted Storage objects, enter optional context, reload, verify event-replayed state, and start generation.

### 003 — Generate a draft

Use the Functions emulator fixture provider. Verify each durable generation stage, the sync marker, completion, and the exact structured proposal written to the event stream.

### 004 — Review, edit, and approve

Verify generated title, attributes, description, evidence, recommended price, expected range, and revenue curve. Edit copy, choose a price, approve, then assert the `listing/approved` event contains the exact resolved UI values.

### 005 — Reload and replay

Reload during capture, generation, review, and after approval. Assert that reducer output, route, focus target, and rendered state match the latest durable event stream.

### 006 — User data isolation

Create two emulator users. Verify each user sees their own listing streams and Storage objects, and assert Firestore and Storage rules reject cross-user reads and writes.

## Deterministic authentication

Production uses Firebase Google Account login. E2E creates a fixed Auth emulator user and enters the application through an E2E-only auth adapter selected at build time. The adapter signs in through the Auth emulator and then follows the same `onAuthStateChanged` path as Google login.

The fixed identity is:

```text
uid: seller-alex-e2e
email: alex.seller@example.test
displayName: Alex Seller
```

The test build exposes the adapter only when `VITE_E2E=true` and every Firebase endpoint targets localhost. A startup invariant rejects the E2E adapter with production Firebase configuration.

## Emulator reset and seed

Each test starts from its own deterministic state. A worker-scoped fixture resets Auth, Firestore, and Storage through emulator APIs, then seeds data through Firebase SDK or Admin SDK helpers. Scenario fixtures use stable IDs, timestamps, event sequences, and content hashes.

Tests run with one worker initially because emulator state is shared:

```ts
fullyParallel: false,
workers: 1,
retries: 0
```

Parallel execution becomes available by assigning each worker its own emulator project and port block. Isolation is proven before increasing the worker count.

## Deterministic AI

The Functions emulator selects `FixtureListingGenerator`. It validates the request's photo digests, style profile version, and optional context, then appends the same staged events as production using a virtual clock. The final proposal comes from `tests/e2e/fixtures/jacket-proposal.json`.

The fixture contains the complete model contract: fields, confidence, evidence, comparable groups, expected-revenue curve, recommended list price, expected sale range, and rationale. Contract tests run the fixture through the same schema validator used for production responses.

## Zero-pixel Playwright configuration

The canonical screenshot environment is Chromium in the pinned Linux toolchain. Font files are checked into the dependency graph and loaded before capture.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5195',
    trace: 'retain-on-failure',
    actionTimeout: 2_000,
    navigationTimeout: 2_000,
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    timezoneId: 'Etc/UTC',
    locale: 'en-GB',
    colorScheme: 'light',
    launchOptions: {
      args: [
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning',
        '--disable-lcd-text',
        '--force-device-scale-factor=1',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--use-gl=swiftshader',
        '--disable-smooth-scrolling',
        '--disable-partial-raster'
      ]
    }
  },
  snapshotPathTemplate: '{testDir}/{testFileDir}/screenshots/{arg}{ext}',
  projects: [
    {
      name: 'phone',
      use: { browserName: 'chromium', viewport: { width: 393, height: 852 } }
    },
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 1000 } }
    }
  ],
  expect: {
    timeout: 2_000,
    toHaveScreenshot: {
      maxDiffPixels: 0,
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css'
    }
  }
});
```

Every screenshot call repeats `maxDiffPixels: 0`, keeping the contract explicit at both levels.

## Waiting policy: events only, 2,000 ms maximum

**NEVER call `page.waitForTimeout()` or `frame.waitForTimeout()`. NEVER use `sleep`, shell `sleep`, timer promises, busy loops, or any other elapsed-time delay in an E2E test or E2E helper.** A passing test must be caused by an observable application event, never by hoping enough time has passed.

Every in-test action, assertion, locator wait, navigation wait, polling interval, and custom event wait has a maximum timeout of **2,000 ms**. Playwright's `actionTimeout`, `navigationTimeout`, and `expect.timeout` are all `2_000`. An individual call may choose a shorter timeout and may NEVER override the limit with a value above `2_000`.

Emulator and web-server process startup uses Playwright's `webServer.timeout` because it occurs before a test begins. Once the page is available, the 2,000 ms ceiling applies to every wait in the scenario.

### Event-driven wait examples

Wait for the exact observable condition that enables the next action:

```ts
// DOM state emitted after Firebase Auth resolves.
await expect(page.getByTestId('signed-in-user')).toHaveText('Alex Seller');

// Durable sync state emitted after Firestore acknowledges pending events.
await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'synced');

// Generation stage rendered from the event-stream subscription.
await expect(page.getByRole('status')).toHaveText('Comparing the market');

// Network response caused by the user action.
const response = page.waitForResponse(
  response => response.url().includes('generateListing') && response.ok(),
  { timeout: 2_000 }
);
await page.getByRole('button', { name: 'Create my draft' }).click();
await response;

// Image readiness exposed by browser state.
await expect
  .poll(() => page.locator('[data-testid="item-photo"]').evaluate(
    image => (image as HTMLImageElement).complete
  ))
  .toBe(true);
```

For state that has no visible representation, the application exposes a deterministic test seam such as an ARIA status, `data-status` attribute, repository subscription signal, or specific response. Adding that observable signal is part of implementing the feature.

### Enforcement

The E2E lint check rejects:

- any `waitForTimeout` call;
- any `sleep` command or sleep helper;
- any timer used as a delay;
- any explicit in-test timeout above `2_000`; and
- Playwright configuration whose action, navigation, or assertion timeout exceeds `2_000`.

Code review treats a forbidden wait as a correctness defect. Repeated timeout failures indicate a missing event or observable state; the fix is to expose and await that event.

## Unified step pattern

Tests use one atomic helper operation for verification, stabilization, screenshot comparison, and scenario documentation:

```ts
const steps = new TestStepHelper(page, testInfo);
steps.setMetadata(
  'Review and approve a listing',
  'A seller reviews AI copy and pricing, edits it, and approves the resolved proposal.'
);

await steps.step('recommended-price', {
  description: 'The complete AI proposal is ready for review',
  status: 'synced',
  verifications: [
    {
      spec: 'The revenue-oriented recommended price is visible',
      check: async () =>
        expect(page.getByTestId('recommended-price')).toHaveText('£48')
    },
    {
      spec: 'The expected sale range is visible',
      check: async () =>
        expect(page.getByText('Expected sale: £42–£48')).toBeVisible()
    }
  ]
});

steps.generateDocs();
```

`TestStepHelper.step()` performs these operations in order:

1. Run semantic verifications.
2. Wait for `[data-status]` to equal the requested durable sync state.
3. Wait for `document.fonts.ready`, decoded images, and settled CSS animations.
4. Move the pointer to `(0, 0)` and blur transient editable carets.
5. Assert that viewport width and content width match.
6. Call `expect(page).toHaveScreenshot(filename, { maxDiffPixels: 0 })`.
7. Record the image and checked specifications for the scenario README.

The helper owns counters and filenames. Scenario code supplies semantic step IDs only.

## Stabilization rules

- Use checked-in fonts and wait for `document.fonts.ready`.
- Use fixture photos with stable bytes and decoded-image assertions.
- Use a virtual clock fixed at `2026-08-27T12:00:00Z`.
- Use `Etc/UTC`, `en-GB`, fixed currency, and fixed number formatting.
- Seed stable Firestore IDs and timestamps.
- Select the fixture AI provider in emulator Functions.
- Disable animation during screenshot comparison.
- Wait on UI state, Firestore sync state, a specific response, or a specific event, with a maximum timeout of 2,000 ms.
- Capture the full page at CSS scale with a one-times device scale factor.
- Keep baselines per project and canonical platform.

## Assertion layers

Every important step combines four layers:

1. **Accessible UI:** roles, names, focus order, live status, and enabled state.
2. **Visual output:** exact full-page screenshot comparison.
3. **Durable state:** emulator event documents, Storage objects, and auth owner.
4. **Replay:** reducer output reconstructed from the stored ordered event stream.

The approved-listing test compares the visible form values with the payload stored in `listing/approved`. This is the key v0 boundary.

## Screenshot review workflow

1. Run `npm run test:e2e` and inspect the first pixel diff.
2. Determine whether the product changed intentionally or rendering became unstable.
3. Fix unstable inputs, fonts, timing, layout, or rendering flags at their source.
4. For an intentional visual change, run `npm run test:e2e:update-snapshots` in the canonical environment.
5. Review every changed PNG alongside its scenario README and semantic assertions.
6. Commit the specification, README, and screenshots together.

Snapshot updates represent reviewed product changes. The zero-pixel threshold remains constant.

## Required CI checks

```text
npm run check
npm run test:unit
npm run test:rules
npm run test:e2e
```

Artifacts retained on failure include the Playwright HTML report, traces, actual screenshots, expected screenshots, pixel diffs, Functions logs, and a redacted ordered event stream for the failing listing.

## Completion standard

A v0 change is complete when its canonical scenario:

- passes against fresh Firebase emulators;
- uses deterministic auth, time, IDs, photos, and AI output;
- verifies accessible behavior and durable event state;
- reconstructs the expected screen through event replay;
- matches every committed screenshot with zero differing pixels; and
- generates current human-readable scenario documentation.
