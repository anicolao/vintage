import { z } from 'zod';
export const fields = ['title', 'description', 'category', 'brand', 'size', 'colour', 'material', 'condition'];
export const moneySchema = z.object({ currency: z.literal('GBP'), minor: z.number().int().min(1).max(10000000) }).strict();
export const copySchema = z.object(Object.fromEntries(fields.map(f => [f, z.string().max(f === 'description' ? 5000 : 200)]))).strict();
export const exampleSchema = z.object({ id: z.string().uuid(), title: z.string().max(200), description: z.string().max(5000) }).strict();
export const examplesSchema = z.array(exampleSchema).max(20).refine(rows => new Set(rows.map(r => r.id)).size === rows.length);
export const photoSchema = z.object({ id: z.string().max(64), path: z.string().max(1024), previewPath: z.string().max(1024), digest: z.string().regex(/^[a-f0-9]{64}$/), type: z.string(), size: z.number().int().positive(), width: z.number().int().positive(), height: z.number().int().positive() }).strict();
export const snapshotSchema = z.object({ copy: copySchema, price: moneySchema, photos: z.array(photoSchema).min(1).max(8), proposalId: z.string().min(1), sample: z.literal(true) }).strict();
export const proposalSchema = z.object({
  schemaVersion: z.literal(1), sample: z.literal(true), copy: copySchema,
  confidence: z.record(z.enum(fields), z.number().min(0).max(1)),
  observations: z.array(z.string().max(500)),
  pricing: z.object({ recommended: moneySchema, expectedSaleRange: z.null(), estimates: z.array(z.never()), rationale: z.string() }).strict(),
  evidence: z.array(z.object({ id: z.string(), kind: z.enum(['photo','history','market']), label: z.string(), sourceIds: z.array(z.string()), unavailable: z.boolean() }).strict()),
  model: z.object({ provider: z.literal('review-sample'), model: z.literal('fixed-proposal-v1'), promptVersion: z.literal('1') }).strict()
}).strict();
export const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
export const initialWorkflow = () => ({ version: 0, status: 'draft', proposal: null, proposalId: '', copy: null, price: null, approved: null, input: null, error: '' });
export function resolvedSnapshot(state) {
  return snapshotSchema.parse({ copy: state.copy, price: state.price, photos: state.input.photos, proposalId: state.proposalId, sample: true });
}
export function copyText(snapshot) {
  return `${snapshot.copy.title}\n\n${snapshot.copy.description}\n\n${fields.slice(2).map(f => `${f[0].toUpperCase()+f.slice(1)}: ${snapshot.copy[f]}`).join('\n')}\n\n£${(snapshot.price.minor / 100).toFixed(2)}`;
}
export function reduceWorkflow(events) {
  let state = initialWorkflow();
  const ordered = [...new Map(events.map(e => [e.id,e])).values()].sort((a,b) => a.version-b.version);
  for (const event of ordered) {
    if (event.schemaVersion !== 1 || event.version !== state.version+1) throw new Error('Unsupported or incomplete workflow stream');
    state = { ...event.state };
  }
  return state;
}
