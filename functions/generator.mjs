import { readFileSync } from 'node:fs';
import { proposalSchema } from './shared/proposal.mjs';
export class FixtureListingGenerator {
  constructor(projectId) {
    if (!['demo-vintage', 'vintage-review-anicolao'].includes(projectId)) throw new Error('Sample providers are restricted to emulator and designated review projects.');
  }
  generate(input) {
    const proposal = JSON.parse(readFileSync(new URL('./fixtures/proposal.json', import.meta.url)));
    proposal.evidence[0].sourceIds = input.photos.map(p => p.id);
    proposal.evidence[1].sourceIds = input.examples.map(e => e.id);
    return proposalSchema.parse(proposal);
  }
}
