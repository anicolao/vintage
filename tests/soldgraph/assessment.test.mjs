import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAssessments,assessSelection} from '../../functions/market-assessment.mjs';
const criteria=[{id:'material',value:'Python print'},{id:'colour',value:'Brown'}];
const rows=[{evidenceId:'a'},{evidenceId:'b'},{evidenceId:'c'}];
const assessments=[{evidenceId:'a',failedCriteria:['material'],unsafe:false},{evidenceId:'b',failedCriteria:['material','colour'],unsafe:false},{evidenceId:'c',failedCriteria:[],unsafe:true}];
test('overlapping exclusions and marginal restoration are computed from per-item assessments',()=>{
 const selected=assessSelection(criteria,assessments);
 assert.equal(selected.criteria[0].excludedCount,2);assert.equal(selected.criteria[0].restoredCount,1);
 assert.equal(selected.criteria[1].excludedCount,1);assert.equal(selected.criteria[1].restoredCount,0);
 assert.equal(assessSelection(criteria,assessments,[]).matchingCount,2);
 assert.equal(assessSelection(criteria,assessments,['colour']).matchingCount,1);
});
test('incomplete, invented and duplicate assessment IDs and unknown criteria are rejected',()=>{
 assert.equal(validateAssessments(assessments,rows,criteria).length,3);
 for(const input of [assessments.slice(1),[...assessments,assessments[0]],assessments.map(r=>({...r,evidenceId:'invented'})),assessments.map(r=>({...r,failedCriteria:['size']}))])assert.throws(()=>validateAssessments(input,rows,criteria));
 assert.throws(()=>assessSelection(criteria,assessments,['brand']));
});
