import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateIonLoads, chargeBalance, quantizeDose, solveFormulation, validateDataset } from '../../core/water-engine.mjs';

const dataset = {
  ionMolarMasses: { Ca:40.078, Mg:24.305, Na:22.990, K:39.098, HCO3:61.017, CO3:60.008, Cl:35.45, SO4:96.06 },
  solutes: [
    { id:'cacl2', mw:110.98, purity:1, cation:'Ca', catN:1, anion:'Cl', anN:2 },
    { id:'mgso4_7h2o', mw:246.47, purity:1, cation:'Mg', catN:1, anion:'SO4', anN:1 },
    { id:'nahco3', mw:84.0066, purity:1, cation:'Na', catN:1, anion:'HCO3', anN:1 }
  ]
};

test('stoichiometric ion accounting conserves formula composition', () => {
  validateDataset(dataset);
  const result = calculateIonLoads({ dosesG:{cacl2:0.11098}, volumeL:1, dataset });
  assert.ok(Math.abs(result.ionsMgL.Ca - 40.078) < 1e-5);
  assert.ok(Math.abs(result.ionsMgL.Cl - 70.9) < 1e-5);
  const balance = chargeBalance({ ionsMgL:result.ionsMgL, ionMolarMasses:dataset.ionMolarMasses });
  assert.ok(Math.abs(balance.imbalancePct) < 1e-6);
});

test('scale quantization publishes an interval rather than false precision', () => {
  assert.deepEqual(quantizeDose(0.0124, 0.01), { exactG:0.0124, recommendedG:0.01, intervalG:[0.005,0.015], scaleResolutionG:0.01 });
});

test('solver returns doses, residuals and scientific boundary warnings', () => {
  const result = solveFormulation({
    targetIonsMgL:{Ca:20, Mg:8, Na:10, HCO3:26.54, Cl:35.38, SO4:31.61},
    volumeL:5,
    allowedSoluteIds:['cacl2','mgso4_7h2o','nahco3'],
    dataset,
    scaleResolutionG:0.001
  });
  assert.equal(result.contract, 'water-formulation/1.0');
  assert.ok(result.recommendedDosesG.cacl2 >= 0);
  assert.ok(result.warnings.some((item) => /pH/i.test(item)));
  assert.ok(result.normalizedRmse < 0.25);
});
