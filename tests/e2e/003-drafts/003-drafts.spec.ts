import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { resetAuth, signIn } from '../helpers/sign-in';

test('draft survives direct reload, follows appearance and clears on account changes', async ({ page, context, request }, testInfo) => {
  await resetAuth(request);
  await page.goto('/');
  await signIn(page, context);
  await page.getByRole('link', { name: 'Start a new draft' }).click();
  await page.getByLabel('Draft name').fill('Favourite linen jacket');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Favourite linen jacket' })).toBeVisible();
  const draftUrl = page.url();
  await page.getByLabel('What should we know?').fill('Relaxed fit. A tiny mark on the left cuff.');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByText('Saved to your account', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('What should we know?')).toHaveValue('Relaxed fit. A tiny mark on the left cuff.');
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Durable listing drafts', 'Create and replay a private cloud-backed draft. The same Firebase auth observer handles the emulator Google identity and live Google accounts.');
  await steps.step('draft-restored', { description: 'A draft and its saved details survive a direct reload', verifications: [
    { spec: 'The title is reconstructed from its creation event', check: async () => expect(page.getByRole('heading', { name: 'Favourite linen jacket' })).toBeVisible() },
    { spec: 'Details are replayed from acknowledged events', check: async () => expect(page.getByLabel('What should we know?')).toHaveValue('Relaxed fit. A tiny mark on the left cuff.') }
  ] });
  steps.generateDocs();
  const input = page.getByLabel('What should we know?');
  await input.fill('Unsaved detail stays through a theme change.');
  await input.focus();
  const original = testInfo.project.use.colorScheme;
  await page.emulateMedia({ colorScheme: original === 'dark' ? 'light' : 'dark' });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Unsaved detail stays through a theme change.');
  expect(page.url()).toBe(draftUrl);
  await expect(page.locator('html')).toHaveCSS('color-scheme', original === 'dark' ? 'light' : 'dark');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(input).toHaveCount(0);
  await signIn(page, context, 'second.seller@example.test', 'Second Seller');
  await expect(page.getByRole('heading', { name: 'Draft unavailable' })).toBeVisible();
  await expect(page.getByText('Favourite linen jacket', { exact: true })).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your drafts', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Saved drafts' })).toHaveCount(0);
});

test('device sequence allocation is atomic across tabs', async ({ page, context, request }) => {
  await resetAuth(request); await page.goto('/'); await signIn(page, context);
  await expect(page.getByRole('link',{name:'Start a new draft'})).toBeVisible();
  // Exercise the shipped UI across tabs, including shared IndexedDB sequence allocation.
  const second=await context.newPage(); await second.goto('/listings/new'); await page.goto('/listings/new');
  await page.getByLabel('Draft name').fill('First tab draft'); await second.getByLabel('Draft name').fill('Second tab draft');
  await Promise.all([page.getByRole('button',{name:'Create draft',exact:true}).click(),second.getByRole('button',{name:'Create draft',exact:true}).click()]);
  await expect(page.getByRole('heading',{name:'First tab draft'})).toBeVisible();
  await expect(second.getByRole('heading',{name:'Second tab draft'})).toBeVisible();
  expect(page.url()).not.toBe(second.url());
  const commands=await page.evaluate(async () => {
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('vintage-delivery-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return new Promise<number>((resolve,reject)=>{const r=db.transaction('identity').objectStore('identity').get('device');r.onsuccess=()=>resolve(r.result.sequence);r.onerror=()=>reject(r.error);});
  });
  expect(commands).toBeGreaterThanOrEqual(4);
  await second.close();
  await page.goto('/'); await expect(page.getByRole('region',{name:'Saved drafts'}).getByRole('link')).toHaveCount(2);
});

test('a persisted retry acknowledges the existing event without duplicating the draft', async ({ page, context, request }) => {
  await resetAuth(request); await page.goto('/'); await signIn(page, context);
  await page.getByRole('link',{name:'Start a new draft'}).click();
  await page.getByLabel('Draft name').fill('Retry-safe jacket');
  await page.getByRole('button',{name:'Create draft',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Retry-safe jacket'})).toBeVisible();
  const id=new URL(page.url()).pathname.split('/').at(-1)!;
  // Restore a delivery intent as if the tab closed after server acknowledgement
  // but before local cleanup. Production retries use this exact IndexedDB queue.
  await page.evaluate(async id => {
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('vintage-delivery-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(['identity','commands'],'readwrite');const r=tx.objectStore('identity').get('device');
      r.onsuccess=()=>{const deviceId=r.result.id; const actorUid=id.slice(0,id.indexOf(`-${deviceId}-`));const clientSeq=Number(id.split('-').at(-1));tx.objectStore('commands').put({id,actorUid,deviceId,clientSeq,workspace:'e2e',streamId:id,type:'listing/created',payload:{title:'Retry-safe jacket'},status:'pending'});};
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
    });
  },id);
  await page.reload();
  await expect(page.getByText('Saved to your account',{exact:true})).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('region',{name:'Saved drafts'}).getByRole('link')).toHaveCount(1);
});

test('rejected delivery stays visible across reload and retry uses the same intent', async ({ page, context, request }) => {
  await resetAuth(request); await page.goto('/'); await signIn(page, context);
  await page.getByRole('link',{name:'Start a new draft'}).click();
  await page.getByLabel('Draft name').fill('Recovery jacket');
  await page.getByRole('button',{name:'Create draft',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Recovery jacket'})).toBeVisible();
  const streamId=new URL(page.url()).pathname.split('/').at(-1)!;
  // Simulate an old/offline client retaining an intent that current rules reject.
  await page.evaluate(async streamId => {
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('vintage-delivery-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(['identity','commands'],'readwrite');const r=tx.objectStore('identity').get('device');
      r.onsuccess=()=>{const d=r.result;d.sequence++;tx.objectStore('identity').put(d,'device');const actorUid=streamId.slice(0,streamId.indexOf(`-${d.id}-`));const id=`${actorUid}-${d.id}-${d.sequence}`;tx.objectStore('commands').put({id,actorUid,deviceId:d.id,clientSeq:d.sequence,workspace:'e2e',streamId,type:'context/changed',payload:{context:'x'.repeat(2001)},status:'pending'});};
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
    });
  },streamId);
  await page.reload();
  await expect(page.getByRole('button',{name:'Retry saving'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('hasn’t reached the cloud');
  await page.getByRole('button',{name:'Retry saving'}).click();
  await expect(page.getByRole('button',{name:'Retry saving'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'Retry saving'})).toBeVisible();
  await expect(page.getByText('Saved to your account',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Discard unsaved change'}).click();
  await expect(page.getByLabel('What should we know?')).toHaveValue('');
  await expect(page.getByText('Saved to your account',{exact:true})).toBeVisible();
});
