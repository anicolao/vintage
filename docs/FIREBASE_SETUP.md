# Live Firebase review environment

Milestone 0 uses real Firebase services for PR review. Emulators are only used by automated tests. The visual redesign is milestone 1; this increment keeps the original home styling.

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

`npm run test:e2e:update-snapshots` deliberately updates screenshots after the rules suite passes. Review changes before committing them. Theme variants arrive in milestone 1.

## PR deployment

The Verify and preview workflow checks the code, then builds a live frontend and deploys identical approved backend rules and a Hosting channel. Fork PRs have no deployment credential access. The GitHub Actions job summary and `live-preview` artifact contain the URL, Firebase project, workspace and Git revision. `version.json` is checked after deployment, together with the `/connection-check` SPA rewrite.

Repository variables configured for this project:

- `FIREBASE_WORKLOAD_IDENTITY_PROVIDER`: `projects/114604451197/locations/global/workloadIdentityPools/github/providers/vintage`
- `FIREBASE_SERVICE_ACCOUNT`: `vintage-preview-deploy@vintage-review-anicolao.iam.gserviceaccount.com`
- `FIREBASE_BACKEND_SHA256`: approved combined digest of `firestore.rules` and `storage.rules`, printed by `node scripts/backend-digest.mjs`

The Google identity provider accepts only repository ID `1348672645` owned by ID `1145048`. The deployment account has Hosting admin, Rules admin, Auth admin (for preview authorized domains), Firebase viewer and Service Usage Consumer roles in this project. It has no Firestore data-admin or project-owner role. Deployment jobs serialize against the shared backend.

The project and Google provider were provisioned once using the authenticated Firebase CLI and Google Cloud APIs. OIDC, IAM, billing, database/bucket creation and bucket CORS are operator-managed configuration; feature PR workflows do not re-provision them. Auth configuration is retained in `firebase.json` for intentional operator deployment with `firebase deploy --only auth`; it is not changed on every PR. Check the deployed preview's hostname in Firebase Auth authorized domains if sign-in reports an unauthorized domain; Hosting channel deployment normally synchronizes this domain.

## Data and backend compatibility

Firestore workspace documents live at `workspaces/{main|pr-N}/users/{uid}`. Storage verification objects live beneath the same scope at `checks/{uuid}.txt`. Scope separates each PR's own test data; authenticated ownership is enforced independently. Changing scope never permits access to another user's data. Auth accounts are shared across the review project's previews.

Only a bounded note, immutable owner/creation fields and server update timestamps are allowed in Firestore. Only new text check files up to 1 KiB can be created; owners may read and delete them. Photos, domain events and other paths remain denied until their feature ships. The Storage check reads authenticated bytes and removes its own object; it does not generate a publicly shareable download-token URL. Bucket GET CORS permits browser downloads; authentication/rules still protect the bytes.

Hosting channels do not isolate backend rules or APIs. The workflow therefore refuses a rules digest that differs from the operator-approved live contract. A future incompatible schema/rule change needs a separate project, or an explicitly reviewed additive migration proven compatible with all active channels before updating the approved digest. Do not update the digest just to make a failing deploy pass. The stable milestone 0 contract must continue working while its previews exist.

## Live smoke check

1. Open the PR URL on the phone. Confirm Continue with Google opens the real Google flow, complete sign-in, and check the displayed account.
2. Save a distinctive workspace note. Confirm the read-back message, reload `/connection-check`, and confirm both the restored session and note.
3. Open Preview connection checks and choose Verify file storage. Confirm upload, authenticated read and cleanup succeed. Record the project, workspace and revision shown there.
4. Sign out, then sign in with a second Google account. Its workspace should be empty and independent. Emulator rules tests additionally assert that direct cross-user reads/writes/deletes fail.
5. Record browser/device, revision and outcomes in the PR review. Popup cancellation and popup blocking must leave a usable retry action. Check Chrome and phone Safari; this implementation uses the documented popup flow, not redirect authentication.

Automated emulator checks do not count as live Google/browser verification. Until this checklist is performed on the deployed revision, its human sign-in check remains pending.

## Cleanup and rollback

The check action deletes its temporary file after read-back, including on a read failure where possible. Network interruption can leave an orphan; an operator can remove objects only under the affected `workspaces/pr-N/users/{uid}/checks/` prefix. On PR closure, delete the Hosting channel (`firebase hosting:channel:delete pr-N --project vintage-review-anicolao`) and, when no longer needed, the corresponding Firestore documents and Storage prefix. Do not clear all project data or delete shared Auth accounts as part of PR cleanup. A 30-day channel expiry does not delete data.

Redeploy a previous reviewed Git revision to roll back the frontend. Backend rules must remain at the compatible approved digest; do not roll back rules to a version that exposes or invalidates another live preview's data. Review new rules and their emulator tests before updating the project-wide contract. Operational cleanup uses explicit project/scope identifiers and authorized operator credentials, never an E2E reset command.

References: [Google popup authentication](https://firebase.google.com/docs/auth/web/google-signin), [Hosting preview deployments](https://firebase.google.com/docs/hosting/test-preview-deploy), and [authenticated Storage downloads and CORS](https://firebase.google.com/docs/storage/web/download-files).
