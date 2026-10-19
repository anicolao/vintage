# eBay account-deletion endpoint

The public Firebase function `ebayAccountDeletion` serves eBay's verification challenge and accepts signed Production marketplace account-deletion notifications.

## Enter these settings in eBay

In **Application Keys → Production → Notifications → Marketplace Account Deletion**, enter your alert email and:

- **Notification Endpoint URL:** `https://europe-west1-vintage-review-anicolao.cloudfunctions.net/ebayAccountDeletion`
- **Verification token:** the `EBAY_DELETION_VERIFICATION_TOKEN` value in the local, gitignored `.cache/ebay-notifications/setup.env` file.

The generated token is 64 hexadecimal characters. It is stored in Google Secret Manager, bound only to the function, and saved locally with mode 0600. Do not include it in commits or PR text. Use the exact URL above, without a trailing slash: it is part of the challenge hash. Save the configuration, then use eBay's **Send Test Notification** control.

The challenge uses SHA-256 over the challenge code, token and configured endpoint. POST signatures are checked against public keys fetched from eBay's Production Notification API, using the SHA-1/ECDSA compact-JSON verification performed by eBay's official Node SDK. Key lookups require the Production App ID/Cert ID stored in the separate `EBAY_NOTIFICATION_CREDENTIALS` secret. The GET challenge does not require successful eBay OAuth; it can activate the keyset before POST verification uses it. [eBay setup](https://developer.ebay.com/develop/guides/sell/marketplace-user-account-deletion), [official verifier](https://github.com/eBay/event-notification-nodejs-sdk/blob/main/lib/validator.js).

## What happens to notifications and cached data

A valid notification transactionally advances `_operations/ebay-deletions.revision`. A receipt keyed by the SHA-256 hash of the notification ID makes retries idempotent. Firestore retains receipt times and a revision counter, not the deleted account's identifiers or notification body. Existing rules deny client access to this server-only path. HTTP 204 follows the durable write; bad signatures receive 412 and transient key-fetch/storage errors receive 503 so delivery can retry.

The prototype has no imported eBay data in Vintage's Firestore or Storage. Its evidence is in local `.cache/ebay/run-*` directories. Since the records have no reliable seller-deletion mapping, any verified deletion invalidates **all** those cached runs conservatively. A public GET without a challenge exposes only the revision number with `Cache-Control: no-store`.

Run this on each machine retaining collector output:

```sh
npm run ebay:sync-deletions -- --watch
```

It checks immediately and every minute, removing generated run directories when the revision changes. The first sync also clears pre-existing runs with no revision marker. The setup-token directory is separate and preserved. A one-shot cleanup uses `npm run ebay:sync-deletions`.

Production collection synchronizes before starting and after completion; unavailable deletion state prevents starting a Production run. Keep the watcher running while retaining results, including when not collecting. Firebase cannot delete files on an offline or stopped computer: cleanup resumes when the watcher or collector reconnects. Copies exported outside the managed cache and any later external LLM uploads need their own deletion process; this endpoint does not erase those copies. Do not claim remote deletion of local files is immediate.

## Deploy or rotate credentials

The operator setup uses the existing Firebase CLI login, reads `.env.production`, preserves an existing local verification token, and writes secret versions without printing their values:

```sh
nix develop --command node scripts/configure-ebay-notifications.mjs
nix develop --command firebase deploy \
  --only functions:vintage-pipeline:ebayAccountDeletion \
  --project vintage-review-anicolao --non-interactive
```

If eBay keys change, rerun setup and redeploy. To deliberately rotate the verification token, first replace its local setup value with a new random 32–80 character alphanumeric/underscore/hyphen value, then run setup, deploy and update eBay together. No automatic token rotation occurs during ordinary deployments.

Verification covers challenge hashing, signed/forged requests, transient failures, transactional receipt idempotency and local invalidation. Live deployment checks can verify GET and rejection of unsigned POSTs; an actual eBay-signed notification is only verified after portal configuration and its test notification.
