# v0 Technical Design

## Scope

The v0 implements one end-to-end product capability: a Google-authenticated seller adds photos and optional context, Vintage generates a personalized listing and revenue-oriented price recommendation, and the seller edits and approves the proposal.

The application is a static SvelteKit SPA backed by Firebase Authentication, Cloud Firestore, Cloud Storage, and callable Cloud Functions. Firestore stores append-only domain events; deterministic reducers reconstruct application state for rendering and debugging.

## System shape

```text
Svelte SPA
  ├── Firebase Auth SDK ───────── Google Account / Auth emulator
  ├── Firestore repository ───── append-only event streams
  ├── Storage repository ─────── original item photos
  └── callable command client ── Cloud Functions
                                  ├── listing-history ingestion
                                  ├── multimodal draft generation
                                  └── market/pricing analysis
```

Production is built with `@sveltejs/adapter-static` and hosted as static assets. Navigation uses client-side routes with a Firebase Hosting rewrite to `index.html`.

## Client architecture

```text
src/
├── lib/
│   ├── auth/                 Google login and auth state
│   ├── firebase/             SDK initialization and emulator connection
│   ├── events/               event types, validation, ordering, reducers
│   ├── repositories/         Firestore and Storage adapters
│   ├── commands/             typed callable-function clients
│   ├── projections/          selectors for screens and view models
│   └── components/           shared UI controls
└── routes/
    ├── +page.svelte          sign-in / resume
    ├── listings/new/         photo input
    └── listings/[id]/        generation and review
```

Routes render projections and dispatch commands. Domain behavior resides in pure reducers and typed command handlers. Firebase access is contained in adapters so unit tests can use in-memory implementations and E2E tests can use emulator implementations.

## Identity and ownership

Google Account login is provided through Firebase Authentication using `GoogleAuthProvider`. The Firebase `uid` is the stable owner ID for every listing, event stream, photo, style profile, and generation request.

The auth observer is the entry point for client state. After login, the client subscribes only to streams owned by that `uid`. Firestore and Storage rules enforce the same ownership boundary independently of the UI.

## Event-sourced model

### Event envelope

Every domain event uses a shared envelope:

```ts
interface DomainEvent<TType extends string, TPayload> {
  id: string;
  streamId: string;
  type: TType;
  payload: TPayload;
  actorUid: string;
  clientSeq: number;
  correlationId: string;
  causationId: string | null;
  createdAt: Timestamp;
  schemaVersion: number;
  reducerVersion: number;
}
```

Client-authored IDs are deterministic: `${actorUid}-${deviceId}-${clientSeq}`. Function-authored IDs use `${commandId}-${stage}`. Repeated delivery therefore resolves to the same document.

Events are ordered by server `createdAt`, then event ID. Locally pending events follow acknowledged events and are ordered by `clientSeq`, following Jaipur's replay model. Every reducer accepts an ordered event array and returns a new projection plus diagnostics.

### Streams

Firestore paths are:

```text
users/{uid}
users/{uid}/events/{eventId}                       account/style stream
users/{uid}/listings/{listingId}
users/{uid}/listings/{listingId}/events/{eventId} listing stream
users/{uid}/commands/{commandId}                  command status
```

The listing document is a small stream descriptor containing `ownerUid`, creation time, and latest activity time. User-facing listing state derives from the event subcollection.

### v0 event vocabulary

```text
account/created
history/import-requested
history/import-progressed
history/import-completed
style/profile-generated

listing/created
photo/upload-requested
photo/uploaded
photo/removed
photo/reordered
context/changed
generation/requested
generation/stage-completed
generation/proposed
field/edited
price/selected
listing/approved
```

`generation/proposed` records the model request version, structured listing proposal, pricing proposal, evidence references, confidence per field, and prompt/input fingerprints. Debugging a result means replaying its stream and inspecting the exact generation inputs and outputs.

### Projection

`reduceListing(events)` yields:

```ts
interface ListingState {
  id: string;
  status: 'capturing' | 'generating' | 'reviewing' | 'approved';
  photos: PhotoRef[];
  context: string;
  generationStage: GenerationStage | null;
  generated: ListingProposal | null;
  edits: Record<ListingField, unknown>;
  selectedPrice: Money | null;
  approved: ApprovedListing | null;
  diagnostics: string[];
}
```

Reducers are total, pure, versioned, and fixture-tested. Unknown event types are retained in diagnostics. Schema migration transforms stored event versions into the current reducer input while preserving the original documents.

## Photos

Original photos are stored at `users/{uid}/listings/{listingId}/photos/{photoId}/original`. A `photo/uploaded` event is appended after Storage confirms the upload and records path, content type, byte size, dimensions, SHA-256 digest, and display order.

Cloud Functions create normalized analysis derivatives with stable dimensions and orientation. Generation inputs reference immutable photo versions by digest, making AI results reproducible from captured evidence.

## Existing-listing style profile

The history-ingestion command captures normalized listing examples with title, description, attributes, price, status, and available outcome data. A style-profile function derives a versioned profile containing:

- common title patterns;
- description structure and formatting;
- recurring vocabulary;
- treatment of measurements, fit, condition, and flaws;
- typical detail level; and
- pricing behavior by category and condition.

The profile and its source listing IDs are recorded through `style/profile-generated`. Draft generation receives a bounded selection of representative source listings plus the current profile. The proposal records which examples influenced it.

## AI generation contract

`generateListing({ uid, listingId, expectedVersion })` is a callable command. The function verifies ownership and stream version, writes `generation/requested`, and moves through durable stages. Its structured result follows a versioned schema:

```ts
interface ListingProposal {
  title: Proposed<string>;
  description: Proposed<string>;
  attributes: Record<string, Proposed<string>>;
  conditionObservations: Proposed<string>[];
  pricing: {
    currency: string;
    recommendedListPrice: number;
    expectedSaleRange: [number, number];
    expectedRevenueByPrice: Array<{
      price: number;
      saleProbability: number;
      expectedRevenue: number;
      expectedDaysToSale: number;
    }>;
    evidence: PricingEvidence[];
    rationale: string;
  };
  model: { provider: string; model: string; promptVersion: string };
}

interface Proposed<T> {
  value: T;
  confidence: number;
  evidence: string[];
  source: 'photo' | 'seller-context' | 'seller-history' | 'market' | 'combined';
}
```

The pricing engine optimizes expected seller revenue across candidate list prices. Comparable evidence is scored for semantic similarity, brand, category, condition, age, size, style, and outcome quality. The recommendation uses the weighted price distribution, demand estimate, likely offers, premium item evidence, and the seller's sale-speed preference. The UI receives the recommendation and the values needed to explain it.

## Commands and consistency

The client writes simple user-intent events directly when rules can validate them. AI and import operations use callable Functions because they require credentials, privileged writes, and idempotent orchestration.

Each command has a stable command ID and expected stream version. A Firestore transaction claims the command and records its correlation ID. Retries continue the same command. Function stages append idempotent events, and the client renders progress from those events.

Approval appends one `listing/approved` event containing the fully resolved listing and price visible on screen. This creates a durable audit point independent of later reducer or model versions.

## Security rules

Firestore rules require authenticated ownership for every user and listing read. Client event creation validates:

- `actorUid == request.auth.uid`;
- the path owner equals `request.auth.uid`;
- allowed client-authored event types;
- immutable event documents;
- envelope shape, supported versions, and bounded payload sizes; and
- listing descriptors whose `ownerUid` matches the path.

Function-authored generation events are written through the Admin SDK. Storage rules apply the same owner path, accepted content types, and upload size limits. Emulator-based rules tests cover owner access, cross-user isolation, event immutability, and invalid envelopes.

## Observability and debugging

Every command and generated event shares a `correlationId`. Structured logs include UID hash, listing ID, command ID, event type, model and prompt versions, duration, and result status. Photo content and listing copy stay in Firebase data stores and are referenced in logs by IDs and digests.

A development-only event inspector shows ordered raw events, replay diagnostics, and the current reduced projection. Exporting a redacted event stream produces a stable debugging fixture.

## Determinism boundaries

Production AI is variable; the application contract is deterministic. The generation adapter has two implementations:

- production provider, selected in deployed Functions; and
- fixture provider, selected in the Firebase Functions emulator for tests.

E2E fixtures map a stable photo digest and style-profile fixture to a checked-in `ListingProposal`. Event IDs, clocks, user identity, generated progress, and image derivatives are fixed in E2E mode. This allows exact behavioral and visual assertions around the complete asynchronous flow.

## v0 acceptance

- Google authentication establishes one durable user workspace.
- Existing listing examples produce a traceable seller style profile.
- Photos upload to Firebase Storage and appear in event-replayed order.
- Generation progress and results survive reload.
- Draft fields carry confidence and evidence.
- Pricing provides a recommended list price, expected sale range, revenue curve, and relevant evidence.
- Seller edits replay on top of the generated proposal.
- Approval records exactly the resolved proposal shown by the UI.
- Firestore and Storage rules isolate every user's data.
- Emulator E2E scenarios demonstrate the complete flow at zero-pixel tolerance.
