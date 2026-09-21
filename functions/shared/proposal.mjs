import { z } from 'zod';
export const fields = ['title', 'description', 'category', 'brand', 'size', 'colour', 'material', 'condition'];
export const moneySchema = z.object({ currency: z.literal('GBP'), minor: z.number().int().min(1).max(10000000) }).strict();
export const copySchema = z.object(Object.fromEntries(fields.map(f => [f, z.string().max(f === 'description' ? 5000 : 200)]))).strict();
export const photoSchema = z.object({ id: z.string().max(64), path: z.string().max(1024), previewPath: z.string().max(1024), digest: z.string().regex(/^[a-f0-9]{64}$/), type: z.string(), size: z.number().int().positive(), width: z.number().int().positive(), height: z.number().int().positive() }).strict();
export const modelSchema = z.object({provider:z.literal('vertex-ai'),model:z.string().min(1),promptVersion:z.string().min(1)}).strict();
export const snapshotSchema = z.object({ copy: copySchema, price: moneySchema, photos: z.array(photoSchema).min(1).max(8), proposalId: z.string().min(1), model: modelSchema }).strict();
export const proposalSchema = z.object({
  schemaVersion:z.literal(2), copy:copySchema.refine(c=>c.title.trim() && c.description.trim()),
  confidence:z.object(Object.fromEntries(fields.map(f=>[f,z.number().min(0).max(1)]))).strict(),
  observations:z.array(z.object({text:z.string().max(500),photoIds:z.array(z.string()).min(1)}).strict()).max(30),
  model:modelSchema, inputFingerprint:z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
export const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
export const initialWorkflow = () => ({ version: 0, status: 'draft', proposal: null, proposalId: '', copy: null, price: null, approved: null, input: null, error: '' });
export function resolvedSnapshot(state) {
  return snapshotSchema.parse({ copy: state.copy, price: state.price, photos: state.input.photos, proposalId: state.proposalId, model: state.proposal.model });
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
