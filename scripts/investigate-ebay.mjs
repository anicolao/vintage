#!/usr/bin/env node
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';

const help = `Fetch up to five known eBay items through Trading GetItem.

Usage: node scripts/investigate-ebay.mjs --site-id SITE_ID [--sandbox] ITEM_ID ...

Set EBAY_USER_TOKEN to an OAuth USER access token (not an application token).
Default: Production. --sandbox requires a Sandbox user token and Sandbox item IDs.
Output: table, results.json and filtered XML excerpts under .cache/ebay/.
No automatic retries. Exit 1 if any lookup fails; exit 2 for setup errors.
`;
const fields = {
  itemId: 'Item.ItemID',
  title: 'Item.Title',
  listingType: 'Item.ListingType',
  endTime: 'Item.ListingDetails.EndTime',
  endingReason: 'Item.ListingDetails.EndingReason',
  listingStatus: 'Item.SellingStatus.ListingStatus',
  currentPrice: 'Item.SellingStatus.CurrentPrice',
  bidCount: 'Item.SellingStatus.BidCount',
  reserveMet: 'Item.SellingStatus.ReserveMet',
  quantitySold: 'Item.SellingStatus.QuantitySold',
  soldAsBuyItNow: 'Item.SellingStatus.SoldAsBin'
};
const parser = new XMLParser({
  ignoreAttributes: false, removeNSPrefix: true,
  parseTagValue: false, parseAttributeValue: false
});
const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const scalar = value => typeof value === 'string' ? value :
  typeof value?.['#text'] === 'string' ? value['#text'] : null;

async function readResponse(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new Error('Response exceeded 2 MiB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseResponse(xml) {
  // This proof needs ordinary XML only; reject custom/external entity declarations.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsupported XML declaration.');
  const validation = XMLValidator.validate(xml);
  if (validation !== true) throw new Error('Invalid XML response.');
  const root = parser.parse(xml).GetItemResponse;
  if (!root || Array.isArray(root) || typeof root !== 'object') {
    throw new Error('Response has no GetItemResponse root.');
  }
  const acknowledgement = scalar(root.Ack);
  const errors = (root.Errors ? [root.Errors].flat() : []).map(error => ({
    code: scalar(error.ErrorCode), severity: scalar(error.SeverityCode),
    message: scalar(error.ShortMessage), detail: scalar(error.LongMessage)
  }));
  const item = {};
  const excerpt = { Ack: acknowledgement, Errors: errors.map(error => ({
    ErrorCode: error.code, SeverityCode: error.severity,
    ShortMessage: error.message, LongMessage: error.detail
  })), Item: {} };
  for (const [name, path] of Object.entries(fields)) {
    const original = get(root, path);
    item[name] = scalar(original);
    // Rebuild only allowlisted scalar fields, before numeric/boolean conversion.
    if (item[name] !== null) {
      const parts = path.split('.');
      const leaf = parts.pop();
      let target = excerpt;
      for (const part of parts) target = target[part] ??= {};
      target[leaf] = name === 'currentPrice' ? {
        '#text': item[name], ...original?.['@_currencyID'] && {
          '@_currencyID': original['@_currencyID']
        }
      } : item[name];
    }
  }
  item.currency = scalar(get(root, 'Item.SellingStatus.CurrentPrice.@_currencyID'));
  const fieldIssues = [];
  for (const name of ['bidCount', 'quantitySold']) {
    if (item[name] === null) continue;
    const value = Number(item[name]);
    if (!/^\d+$/.test(item[name]) || !Number.isSafeInteger(value)) {
      fieldIssues.push(`Invalid ${name}`);
      item[name] = null;
    } else item[name] = value;
  }
  for (const name of ['reserveMet', 'soldAsBuyItNow']) {
    if (item[name] === null) continue;
    if (['true', '1'].includes(item[name])) item[name] = true;
    else if (['false', '0'].includes(item[name])) item[name] = false;
    else { fieldIssues.push(`Invalid ${name}`); item[name] = null; }
  }
  if (item.currentPrice !== null && !/^\d+(\.\d+)?$/.test(item.currentPrice)) {
    fieldIssues.push('Invalid currentPrice');
    item.currentPrice = null;
  }
  return { acknowledgement, errors, item, fieldIssues,
    missingFields: Object.keys(item).filter(key => item[key] === null),
    excerpt: builder.build({ GetItemResponse: excerpt }) };
}

async function main() {
  const { values, positionals: ids } = parseArgs({ allowPositionals: true, options: {
    'site-id': { type: 'string' }, sandbox: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' }
  } });
  if (values.help) { console.log(help); return; }
  if (!/^\d{1,3}$/.test(values['site-id'] ?? '') || !ids.length || ids.length > 5 ||
      ids.some(id => !/^\d{1,20}$/.test(id))) {
    throw new Error('Supply --site-id and 1–5 numeric item IDs. Use --help for usage.');
  }
  const token = process.env.EBAY_USER_TOKEN?.trim();
  if (!token || /[\r\n]/.test(token)) {
    throw new Error('Set EBAY_USER_TOKEN to an eBay OAuth user access token. See EBAY_INVESTIGATION_PROTOTYPE.md.');
  }
  const environment = values.sandbox ? 'Sandbox' : 'Production';
  const endpoint = values.sandbox ? 'https://api.sandbox.ebay.com/ws/api.dll' :
    'https://api.ebay.com/ws/api.dll';
  const parent = resolve('.cache/ebay');
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(`${parent}/run-`);
  const results = [];
  console.log(`${environment} — Trading GetItem — site ${values['site-id']}`);
  for (const id of [...new Set(ids)]) {
    const record = { requestedItemId: id, fetchedAt: new Date().toISOString(),
      environment, siteId: values['site-id'], httpStatus: null, ok: false };
    try {
      const response = await fetch(endpoint, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'X-EBAY-API-CALL-NAME': 'GetItem',
          'X-EBAY-API-SITEID': values['site-id'],
          'X-EBAY-API-COMPATIBILITY-LEVEL': '1477',
          'X-EBAY-API-IAF-TOKEN': token
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<ItemID>${id}</ItemID>
${Object.values(fields).map(path => `<OutputSelector>${path}</OutputSelector>`).join('\n')}
</GetItemRequest>`
      });
      record.httpStatus = response.status;
      const xml = (await readResponse(response)).split(token).join('[REDACTED]');
      const { excerpt, ...parsed } = parseResponse(xml);
      Object.assign(record, parsed);
      if (['Success', 'Warning'].includes(parsed.acknowledgement) && parsed.item.itemId !== id) {
        parsed.fieldIssues.push('Returned ItemID is missing or differs from requested ID');
      }
      record.ok = response.ok && ['Success', 'Warning'].includes(parsed.acknowledgement) &&
        !parsed.errors.some(error => error.severity === 'Error') && !parsed.fieldIssues.length;
      record.xmlExcerpt = `${id}.xml`;
      await writeFile(`${directory}/${record.xmlExcerpt}`, excerpt, { mode: 0o600 });
    } catch (error) {
      record.ok = false;
      record.error = error.name === 'TimeoutError' ? 'Request timed out after 15 seconds.' :
        error.message.split(token).join('[REDACTED]');
    }
    results.push(record);
    // Preserve completed requests even if the operator stops a later lookup.
    await writeFile(`${directory}/results.json`, `${JSON.stringify(results, null, 2)}\n`, { mode: 0o600 });
  }
  console.table(results.map(row => ({
    itemId: row.requestedItemId, HTTP: row.httpStatus, ack: row.acknowledgement ?? '',
    ok: row.ok, status: row.item?.listingStatus ?? '', type: row.item?.listingType ?? '',
    price: row.item?.currentPrice ?? '', currency: row.item?.currency ?? '',
    bids: row.item?.bidCount ?? '', sold: row.item?.quantitySold ?? '',
    reserveMet: row.item?.reserveMet ?? '', buyItNow: row.item?.soldAsBuyItNow ?? ''
  })));
  for (const row of results) {
    if (row.error) console.error(`${row.requestedItemId}: ${row.error}`);
    for (const error of row.errors ?? []) console.error(`${row.requestedItemId}: ${error.severity} ${error.code}: ${error.message}`);
    for (const issue of row.fieldIssues ?? []) console.error(`${row.requestedItemId}: ${issue}`);
  }
  console.log(`Saved ${directory}/results.json and filtered XML excerpts (not full wire responses).`);
  console.log('CurrentPrice is not necessarily a sale price; payment is unverified.');
  if (results.some(row => !row.ok)) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 2; });
