import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeighingOrder, handlingMetadataFor } from '../../core/weighing-order.mjs';

const solutes = ['khco3','nahco3','mglac','calac','mgso4','cacl2','mgcl2'].map(id => ({id,name:id}));

test('places more moisture-sensitive salts last even when their dose is larger', () => {
  const result = buildWeighingOrder({dosesG:{cacl2:100,mgso4:3,khco3:.1,mglac:10,calac:2,mgcl2:1},solutes});
  assert.deepEqual(result.steps.map(step => step.id), ['khco3','mglac','calac','mgso4','cacl2','mgcl2']);
  assert.deepEqual(result.steps.map(step => step.order), [1,2,3,4,5,6]);
  assert.equal(result.steps.at(-1).sources.length, 1);
});

test('same handling group uses descending actual dose and a deterministic tie break', () => {
  const result = buildWeighingOrder({dosesG:{khco3:1,nahco3:2,mglac:0},solutes});
  assert.deepEqual(result.steps.map(step => step.id), ['nahco3','khco3']);
  const tie = buildWeighingOrder({dosesG:{nahco3:1,khco3:1},solutes});
  assert.deepEqual(tie.steps.map(step => step.id), ['khco3','nahco3']);
});

test('respects product metadata without claiming measured bulk volume or a low unknown risk', () => {
  const custom = [{id:'x',name:'batch x',handlingOrder:5,moistureClass:'当前包装说明',handlingNote:'本批快封',sourceUrls:['https://example.org/coa']}];
  const result = buildWeighingOrder({dosesG:{x:4},solutes:custom});
  assert.equal(result.steps[0].handlingOrder, 5);
  assert.equal(result.steps[0].note, '本批快封');
  assert.equal(result.steps[0].sources[0].url, 'https://example.org/coa');
  assert.equal(result.volumeBasis, 'not-estimated-without-batch-bulk-density');
  assert.match(handlingMetadataFor('unknown').moistureClass, /复核/);
  assert.match(handlingMetadataFor('unknown').evidence, /unverified/);
});

test('does not mutate recipes or salt metadata; scaled recipe order remains the same', () => {
  const doses = {khco3:1,mglac:2,cacl2:.5};
  const before = JSON.stringify({doses,solutes});
  const first = buildWeighingOrder({dosesG:doses,solutes});
  const scaled = buildWeighingOrder({dosesG:{khco3:10,mglac:20,cacl2:5},solutes});
  assert.deepEqual(first.steps.map(step => step.id), scaled.steps.map(step => step.id));
  assert.equal(JSON.stringify({doses,solutes}), before);
});

test('rejects unknown nonzero salts and invalid doses rather than silently omitting them', () => {
  for (const dose of [null,'1',true,NaN,Infinity,-1]) assert.throws(() => buildWeighingOrder({dosesG:{khco3:dose},solutes}), /finite number/);
  assert.throws(() => buildWeighingOrder({dosesG:{missing:1},solutes}), /Unknown solute/);
  assert.throws(() => buildWeighingOrder({dosesG:{khco3:1},solutes:[{id:'khco3',handlingOrder:'10'}]}), /handlingOrder/);
  assert.throws(() => buildWeighingOrder({dosesG:{},solutes:[{id:'x'},{id:'x'}]}), /unique/);
  assert.deepEqual(buildWeighingOrder({dosesG:{},solutes}).steps, []);
});
