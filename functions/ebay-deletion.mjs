import { createHash, createPublicKey, verify } from 'node:crypto';

export const deletionEndpoint = 'https://europe-west1-vintage-review-anicolao.cloudfunctions.net/ebayAccountDeletion';
const hash = value => createHash('sha256').update(value).digest('hex');
export function challengeResponse(challenge, token, endpoint) {
  if (typeof challenge !== 'string' || !challenge || challenge.length > 1024) throw new Error('Invalid challenge');
  if (!/^[a-zA-Z0-9_-]{32,80}$/.test(token)) throw new Error('Invalid configuration');
  return hash(challenge + token + endpoint);
}

export function publicKeyLoader(credentials, transport = fetch) {
  const cache = new Map(); let access; let expires = 0;
  async function json(url, options) {
    const r = await transport(url, {...options,redirect:'error',signal:AbortSignal.timeout(10000)});
    if (!r.ok) throw new Error('eBay verification service unavailable');
    return r.json();
  }
  return async kid => {
    if (cache.has(kid) && cache.get(kid).until > Date.now()) return cache.get(kid).key;
    const base = 'https://api.ebay.com';
    if (!access || Date.now() >= expires) {
      const c = credentials();
      const token = await json(`${base}/identity/v1/oauth2/token`, {method:'POST',headers:{
        Authorization:`Basic ${Buffer.from(`${c.appId}:${c.certId}`).toString('base64')}`,
        'Content-Type':'application/x-www-form-urlencoded'
      },body:new URLSearchParams({grant_type:'client_credentials',scope:'https://api.ebay.com/oauth/api_scope'}).toString()});
      if (typeof token.access_token !== 'string') throw new Error('Invalid token response');
      access = token.access_token; expires = Date.now() + Math.min(Number(token.expires_in) || 60, 3600)*1000 - 30000;
    }
    const result = await json(`${base}/commerce/notification/v1/public_key/${encodeURIComponent(kid)}`,{headers:{Authorization:`Bearer ${access}`}});
    const pem = String(result.key).replace('-----BEGIN PUBLIC KEY-----','-----BEGIN PUBLIC KEY-----\n').replace('-----END PUBLIC KEY-----','\n-----END PUBLIC KEY-----');
    const key = createPublicKey(pem);
    if (key.asymmetricKeyType !== 'ec') throw new Error('Invalid notification key');
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(kid,{key,until:Date.now()+3600000}); return key;
  };
}

export function handler({token, endpoint=deletionEndpoint, getKey, record, revision}) {
  return async (req,res) => {
    res.set('Cache-Control','no-store');
    if (req.method === 'GET') {
      if (req.query.challenge_code !== undefined) {
        try {return res.status(200).json({challengeResponse:challengeResponse(req.query.challenge_code,token(),endpoint)});}
        catch {return res.status(400).json({error:'Invalid verification challenge'});}
      }
      try {return res.status(200).json({revision:await revision()});}
      catch {return res.status(503).json({error:'Deletion state unavailable'});}
    }
    if (req.method !== 'POST') return res.set('Allow','GET, POST').status(405).end();
    const header = req.get('x-ebay-signature');
    if (typeof header !== 'string' || header.length > 4096 || !req.rawBody || req.rawBody.length > 65536) return res.status(412).end();
    let signature, body;
    try {
      signature = JSON.parse(Buffer.from(header,'base64').toString('utf8'));
      if (typeof signature.kid !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(signature.kid) || typeof signature.signature !== 'string' || !/^[a-zA-Z0-9+/]+=*$/.test(signature.signature)) throw new Error();
      body = JSON.parse(req.rawBody.toString('utf8'));
      if (body.metadata?.topic !== 'MARKETPLACE_ACCOUNT_DELETION' || typeof body.notification?.notificationId !== 'string' || !body.notification.notificationId || body.notification.notificationId.length>200 || !body.notification.data || !['username','userId','eiasToken'].some(k=>typeof body.notification.data[k]==='string'&&body.notification.data[k].length>0)) throw new Error();
    } catch {return res.status(400).end();}
    let key;
    try { key = await getKey(signature.kid); }
    catch {return res.status(503).end();} // eBay retries; never acknowledge an unverified notification.
    try {
      // eBay's official Node SDK verifies compact JSON using SHA-1/ECDSA.
      if (!verify('sha1',Buffer.from(JSON.stringify(body)),key,Buffer.from(signature.signature,'base64'))) return res.status(412).end();
    } catch {return res.status(412).end();}
    try {
      // Conservatively invalidate every prototype result: no seller mapping needed,
      // and no deleted user's identifiers retained in Firestore or application logs.
      await record(hash(body.notification.notificationId));
      return res.status(204).end();
    } catch {return res.status(503).end();}
  };
}

export async function recordDeletion(stateRef, notificationHash) {
  return stateRef.firestore.runTransaction(async tx => {
    const receipt=stateRef.collection('receipts').doc(notificationHash);
    const [seen,state]=await Promise.all([tx.get(receipt),tx.get(stateRef)]);
    if(seen.exists)return;
    tx.create(receipt,{receivedAt:new Date()});
    tx.set(stateRef,{revision:(state.data()?.revision || 0)+1,updatedAt:new Date()});
  });
}
