import { randomUUID } from 'node:crypto';
const origin = 'https://api.soldgraph.com';
const text = value => typeof value === 'string' ? value.slice(0, 2000) : null;
function money(value) {
  const amount = String(value?.amount);
  return /^\d{1,10}(\.\d{1,2})?$/.test(amount) && /^[A-Z]{3}$/.test(value?.currency ?? '')
    ? { amount, currency: value.currency } : null;
}
export function normalize(row, window) {
  if (!row || typeof row.id !== 'string' || !row.id) throw new Error('invalid_record');
  const date = text(row.sold_date);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
  const price = money(row.displayed_price);
  let sourceUrl = null;
  try { const u = new URL(row.link); if (u.protocol === 'https:' && !u.username && !u.password) sourceUrl = u.href; } catch {}
  return {
    evidenceId: row.id, title: text(row.title), sourceUrl, condition: text(row.condition),
    format: text(row.format), soldDate: date, displayedPrice: price, displayedShipping: money(row.displayed_shipping),
    bestOfferAccepted: typeof row.best_offer_accepted === 'boolean' ? row.best_offer_accepted : null,
    paymentVerified: false,
    excludedReason: !validDate || date < window.from || date > window.to ? 'missing_invalid_or_out_of_window_date'
      : row.best_offer_accepted !== false ? 'accepted_offer_or_unknown_offer_status'
      : !price ? 'missing_or_invalid_price' : null
  };
}
export function statistics(rows) {
  const groups = new Map();
  for (const row of rows.filter(r => !r.excludedReason)) {
    const { amount, currency } = row.displayedPrice;
    const [whole, fraction = ''] = amount.split('.');
    const units = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (!groups.has(currency)) groups.set(currency, []);
    groups.get(currency).push(units);
  }
  // Thousandths preserve the exact midpoint of two prices in cents.
  const decimal = n => `${n / 1000n}.${String(n % 1000n).padStart(3, '0')}`;
  return [...groups].map(([currency, values]) => {
    values.sort((a,b) => a < b ? -1 : a > b ? 1 : 0);
    const n = values.length;
    return { currency, count: n, basis: 'displayed_prices_excluding_accepted_or_unknown_offers',
      ...(n < 3 ? { status: 'insufficient_evidence' } : {
        min: decimal(values[0]*10n), max: decimal(values[n-1]*10n),
        median: decimal(n%2 ? values[Math.floor(n/2)]*10n : (values[n/2-1]+values[n/2])*5n)
      }) };
  });
}
export async function collect(config, key, { transport = fetch, now = new Date(), pause = ms => new Promise(r => setTimeout(r, ms)), checkpoint = async () => {}, maxPolls = 15 } = {}) {
  const report = { source: 'soldgraph-ebay', query: config.query, country: config.country,
    window: { from: new Date(now.getTime()-(config.days-1)*86400000).toISOString().slice(0,10), to: now.toISOString().slice(0,10) },
    status: 'running', requestId: config.requestId, idempotencyKey: config.idempotencyKey || randomUUID(), requests: [], results: [] };
  const sanitize = () => JSON.parse(JSON.stringify(report).split(JSON.stringify(key).slice(1,-1)).join('[REDACTED]'));
  const save = () => checkpoint(sanitize());
  async function request(url, search = false) {
    let response;
    try {
      response = await transport(url, { redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${key}`, ...(search ? { 'Idempotency-Key': report.idempotencyKey } : {}) } });
    } catch { throw new Error('transport_failure'); }
    report.requests.push({ stage: search ? 'search' : 'poll', httpStatus: response.status });
    if (!response.ok) throw new Error(({401:'invalid_credentials',403:'access_denied',429:'rate_or_quota_limit'})[response.status] ?? `http_${response.status}`);
    let data;
    try {
      const reader = response.body.getReader(); const chunks = []; let size = 0;
      try { while (true) { const { done, value } = await reader.read(); if (done) break;
        size += value.length; if (size > 2*1024*1024) throw new Error(); chunks.push(value);
      } } finally { await reader.cancel(); }
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { throw new Error('invalid_response'); }
    const retry = response.headers.get('Retry-After');
    const delay = retry === null ? 2000 : /^\d+$/.test(retry) ? +retry*1000 : Date.parse(retry)-Date.now();
    return { data, delay: Math.max(2000, Number.isFinite(delay) ? delay : 2000) };
  }
  try {
    await save();
    const url = new URL('/v1/ebay/sold', origin);
    url.search = new URLSearchParams({ q: config.query, country: config.country, page: '1', count: '40', sort: 'recently_sold' });
    let reply = await request(config.requestId ? `${origin}/v1/jobs/${config.requestId}?wait=20` : url.href, !config.requestId);
    for (let polls = 0; ; polls++) {
      const { data, delay } = reply;
      if (!data || !['pending','complete','failed'].includes(data.status)) throw new Error('invalid_job_response');
      if (typeof data.request_id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.request_id)) throw new Error('invalid_request_id');
      if (report.requestId && report.requestId !== data.request_id) throw new Error('request_id_mismatch');
      report.requestId = data.request_id;
      await save();
      if (data.status === 'failed') { report.providerErrorCode = /^[a-z_]{1,80}$/.test(data.error?.code ?? '') ? data.error.code : null; throw new Error('provider_job_failed'); }
      if (data.status === 'complete') {
        const result = data.result;
        if (!result || result.provider !== 'ebay' || result.country !== config.country || result.query !== config.query || result.page !== 1 || result.schema_version !== 2 || !Array.isArray(result.data)) throw new Error('unrecognized_search_response');
        const unique = new Map();
        for (const row of result.data) { const record = normalize(row, report.window); if (!unique.has(record.evidenceId)) unique.set(record.evidenceId, record); }
        report.results = [...unique.values()];
        Object.assign(report, { status: 'complete', collectedAt: text(result.collected_at), cached: data.cached === true,
          credits: Number.isSafeInteger(data.credits) ? data.credits : null, reportedTotal: result.reported_total ?? null,
          nextPage: result.next_page ?? null, completeness: 'single_provider_page', duplicateCount: result.data.length-unique.size });
        break;
      }
      if (polls >= maxPolls || delay > 30000) throw new Error('polling_limit_resume_with_request_id');
      const expected = `/v1/jobs/${report.requestId}`;
      if (data.poll_url !== undefined && data.poll_url !== expected && data.poll_url !== origin+expected) throw new Error('unsafe_poll_url');
      await pause(delay);
      reply = await request(`${origin}${expected}?wait=20`);
    }
  } catch (error) { report.status = 'failed'; report.error = error.message; }
  report.statistics = statistics(report.results);
  await save(); return sanitize();
}
