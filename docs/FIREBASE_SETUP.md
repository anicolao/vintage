# Live Firebase review environment

PR review uses real Firebase Auth, Firestore and Storage. Emulators are only used by automated tests. The app uses the approved system-following terracotta-and-linen design, with Your listings leading to photo capture.

## Provisioned resources

| Resource | Value |
| --- | --- |
| Project | `vintage-review-anicolao` (`114604451197`) |
| Google provider | Enabled; display name Vintage |
| Firestore | Native `(default)` database, `eur3`, deletion protection enabled |
| Storage | `vintage-review-anicolao.firebasestorage.app`, EU |
| Hosting | Firebase Hosting, `pr-N` preview channels; 30-day expiry, renewed on deploy |
| Billing | Existing VMs billing account, selected by the user |
| GitHub identity | Repository-restricted Workload Identity Federation; no stored service-account key |

`firebase.review.json` contains public Firebase web configuration. It is intentionally committed; access is enforced by rules, not by hiding client API keys. The CLI's own OAuth credential cannot sign in to this web app because its OAuth audience differs. Real Google popup sign-in must be checked with the web app's own flow.

## Local development and verification

```sh
nix develop
npm ci
cp .env.example .env.local
# Fill .env.local from firebase.review.json; set VITE_FIREBASE_WORKSPACE=pr-3.
npm run dev
```

For a deployable live build, configuration is loaded directly from `firebase.review.json` and emulator flags are forced off:

```sh
VINTAGE_WORKSPACE=pr-3 npm run build:live
```

Live builds reject missing Firebase configuration; test builds require both explicit E2E/emulator flags, the `demo-vintage` project and localhost. `.env.e2e` is test-only. Never point emulator reset/seed tools at the live project.

Run `npm run check`, `npm run test:config`, `npm run test:hooks` and `npm run test:foundation`. The foundation command owns Auth, Firestore and Storage emulators, runs the security rules suite, builds the SPA and runs phone/desktop browser scenarios. Rules validation happens before browser scenarios so rule compilation is complete before their 2,000 ms action/assertion limits. No in-test sleeps or increased wait thresholds are used.

`npm run test:e2e:update-snapshots` deliberately updates screenshots after the rules suite passes. Review changes before committing them. Baselines cover both system appearances on phone and desktop.

## PR deployment

The Verify and preview workflow checks the code, then builds a live frontend and deploys identical approved backend rules and a Hosting channel. Fork PRs have no deployment credential access. The GitHub Actions job summary and `live-preview` artifact contain the URL, Firebase project, workspace and Git revision. `version.json` is checked after deployment, together with the direct item-route SPA rewrite.

Repository variables configured for this project:

- `FIREBASE_WORKLOAD_IDENTITY_PROVIDER`: `projects/114604451197/locations/global/workloadIdentityPools/github/providers/vintage`
- `FIREBASE_SERVICE_ACCOUNT`: `vintage-preview-deploy@vintage-review-anicolao.iam.gserviceaccount.com`
- `FIREBASE_BACKEND_SHA256`: approved combined digest of `firestore.rules` and `storage.rules`, printed by `node scripts/backend-digest.mjs`

The Google identity provider accepts only repository ID `1348672645` owned by ID `1145048`. The deployment account has Hosting admin, Rules admin, Auth admin (for preview authorized domains), Firebase viewer and Service Usage Consumer roles in this project. It has no Firestore data-admin or project-owner role. Deployment jobs serialize against the shared backend.

The project and Google provider were provisioned once using the authenticated Firebase CLI and Google Cloud APIs. OIDC, IAM, billing, database/bucket creation and bucket CORS are operator-managed configuration; feature PR workflows do not re-provision them. Auth configuration is retained in `firebase.json` for intentional operator deployment with `firebase deploy --only auth`; it is not changed on every PR. Check the deployed preview's hostname in Firebase Auth authorized domains if sign-in reports an unauthorized domain; Hosting channel deployment normally synchronizes this domain.

## Data and backend compatibility

Production account and item streams live under `workspaces/{main|pr-N}/accounts/{uid}`. Immutable photo objects use the item's `photos/{photoId}/{original|preview}` prefix. Owners can read their own streams and photos; the rules reject other users. See [Product UI and saved items](./DRAFT_FOUNDATION.md) for the schema and photo contract.

Hosting channels share backend rules. The approved digest gates deployment of the current production contract. Superseded development interfaces and their permissions are removed rather than supported indefinitely. Updating the digest requires reviewing the rules and passing their tests.

## Live review

1. Open the PR URL on a phone and sign in with Google.
2. Add a photo and one-line context, then reload the item URL. Inspect the photo and verify the saved context.
3. Change the system appearance while editing; check that focus, content and route remain.
4. Use the account menu to sign out. A second account must not open the first account's item.
5. Record browser/device, outcome and revision from `/version.json` in the PR. Automated emulator tests do not stand in for real Google/browser review.

## Cleanup and rollback

Hosting channel expiry does not delete item data or Auth accounts. Cleanup must target the intended PR workspace and its photo prefixes explicitly. Do not delete shared Auth accounts or unrelated workspaces.

Frontend rollback uses a reviewed revision compatible with the current product schema. Do not restore superseded diagnostic rules. Production rule changes and cleanup require explicit scope and owner-rule verification.

References: [Google popup authentication](https://firebase.google.com/docs/auth/web/google-signin), [Hosting preview deployments](https://firebase.google.com/docs/hosting/test-preview-deploy), and [authenticated Storage downloads and CORS](https://firebase.google.com/docs/storage/web/download-files).

### Browser updates

Hosting requires revalidation (`Cache-Control: no-cache`) on all paths, including `/` and rewritten listing URLs. Only content-hashed `/_app/immutable/` assets receive long-lived immutable caching; `/version.json` is not stored. Deployment smoke checks inspect the actual app-route response headers, as a rule matching `/index.html` alone does not cover the incoming route URLs.

A tab already running the app keeps its loaded JavaScript until a document reload. Previously cached HTML can also remain fresh under its earlier headers; a hard reload or a new query string on the preview URL fetches the new document without clearing locally retained drafts or photos.
