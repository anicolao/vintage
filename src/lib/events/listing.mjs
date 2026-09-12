/** Pure replay contract. Stored documents are never migrated in place. */
export const SCHEMA_VERSION = 2;
/** @param {string | number} a @param {string | number} b */
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
/** @param {any} value */
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/** @param {any} value @param {string[]} keys */
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(k => k in value);
/** @param {any} value @param {number} max */
const text = (value, max) => typeof value === 'string' && value.length <= max;
/** @param {any} raw */
export function validateEvent(raw) {
  if (!object(raw) || !text(raw.id, 256) || !raw.id || !text(raw.streamId, 256) || !raw.streamId ||
      !text(raw.actorUid, 128) || !raw.actorUid || !text(raw.deviceId, 64) || !raw.deviceId ||
      !Number.isSafeInteger(raw.clientSeq) || raw.clientSeq < 1 ||
      !Number.isSafeInteger(raw.streamVersion) || raw.streamVersion < 1 ||
      !text(raw.correlationId, 256) || !raw.correlationId ||
      !(raw.causationId === null || text(raw.causationId, 256)) || raw.reducerVersion !== 1) return { error: 'Malformed envelope' };
  if (![1, 2].includes(raw.schemaVersion)) return { error: 'Unsupported schema version' };
  if (raw.createdAt !== null && (!object(raw.createdAt) || !Number.isInteger(raw.createdAt.seconds) || !Number.isInteger(raw.createdAt.nanoseconds) || raw.createdAt.nanoseconds < 0 || raw.createdAt.nanoseconds >= 1e9)) return { error: 'Malformed timestamp' };
  let event = { ...raw, payload: object(raw.payload) ? { ...raw.payload } : raw.payload };
  if (event.schemaVersion === 1 && event.type === 'context/changed' && exact(event.payload, ['text'])) {
    event = { ...event, payload: { context: event.payload.text }, schemaVersion: 2 };
  }
  if (event.type === 'listing/created' && exact(event.payload, ['title']) && text(event.payload.title, 100) && event.payload.title.trim()) return { event };
  if (event.type === 'context/changed' && exact(event.payload, ['context']) && text(event.payload.context, 2000)) return { event };
  if (event.type === 'account/created' && exact(event.payload, [])) return { event };
  return { error: ['listing/created', 'context/changed', 'account/created'].includes(event.type) ? 'Malformed payload' : 'Unknown event type' };
}
/** @param {any[]} events */
export function orderEvents(events) {
  return [...events].sort((a, b) => {
    if (!a.createdAt !== !b.createdAt) return a.createdAt ? -1 : 1;
    if (!a.createdAt) return compare(a.clientSeq, b.clientSeq) || compare(a.id, b.id);
    return compare(a.createdAt.seconds, b.createdAt.seconds) || compare(a.createdAt.nanoseconds, b.createdAt.nanoseconds) || compare(a.id, b.id);
  });
}
/** @param {any[]} rawEvents @param {string} streamId @param {string} actorUid */
export function reduceListing(rawEvents, streamId, actorUid) {
  const state = { id: streamId, title: '', context: '', status: 'empty', version: 0, pending: 0, diagnostics: /** @type {string[]} */ ([]) };
  const seen = new Map();
  const valid = [];
  for (const raw of rawEvents) {
    const result = validateEvent(raw);
    if (result.error) { state.diagnostics.push(`${raw?.id ?? '?'}: ${result.error}`); continue; }
    const event = result.event;
    if (event.streamId !== streamId || event.actorUid !== actorUid) { state.diagnostics.push(`${event.id}: Wrong stream or owner`); continue; }
    // An acknowledged copy replaces its pending copy regardless of arrival order.
    const previous = seen.get(event.id);
    if (previous) {
      state.diagnostics.push(`${event.id}: Duplicate event`);
      if (!previous.createdAt && event.createdAt) seen.set(event.id, event);
    } else seen.set(event.id, event);
  }
  valid.push(...seen.values());
  for (const event of orderEvents(valid)) {
    if (event.createdAt) state.version = Math.max(state.version, event.streamVersion);
    else state.pending++;
    if (event.type === 'listing/created') {
      if (state.status !== 'empty') { state.diagnostics.push(`${event.id}: Repeated creation`); continue; }
      state.title = event.payload.title; state.status = 'draft';
    } else if (event.type === 'context/changed' && state.status === 'draft') state.context = event.payload.context;
    else state.diagnostics.push(`${event.id}: Event outside listing lifecycle`);
  }
  return state;
}
