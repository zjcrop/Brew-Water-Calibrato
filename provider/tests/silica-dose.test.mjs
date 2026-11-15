import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculateSilicaPowderDose,calculateActualSilicaPowderDose} from '../../core/silica-dose.mjs';
import {computeUiFormulation} from '../../core/ui-engine.mjs';
import {calculateIonLoads} from '../../core/water-engine.mjs';
import {extractEmbeddedDataset} from '../scripts/extract-embedded-data.mjs';
const near=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const dataset=extractEmbeddedDataset(fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8'),{sourceAppVersion:'2.8.0'});
const options={dataset,target:{Ca:10,Mg:8,HCO3:30,naShare:.6},selectedIds:['calac','mgso4','khco3','nahco3'],outputMode:'direct',outputAmount:5,scaleResolutionG:.001};
const powder=nominalTargetMgL=>({enabled:true,route:'silica',powderDoseMode:'water',nominalTargetMgL,purity:.99999999});

test('SiO2 engineering vectors give 0/2.5/5/10/25 mg pure nominal mass in 5L',()=>{
  for(const [target,pureMg]of [[0,0],[.5,2.5],[1,5],[2,10],[5,25]]){
    const r=calculateSilicaPowderDose({baseSaltG5L:.75,powderDoseMode:'water',nominalTargetMgL:target,purity:1});
    near(r.doseG5L*1000,pureMg);near(r.nominalPureSiO2MgL,target);
    near(r.finalDoseG5L,.75+pureMg/1000);
    assert.equal(r.dissolvedSiO2MgL,null);assert.equal(r.colloidalSiO2MgL,null);
  }
});

test('SiO2 percentage describes final blend and assay changes nominal pure mass only',()=>{
  // Adding 20mg product to 980mg salts makes precisely 2% of a 1g final blend.
  const r=calculateSilicaPowderDose({baseSaltG5L:.98,powderDoseMode:'percent',powderPct:2,purity:.98});
  near(r.doseG5L,.02);near(r.finalDoseG5L,1);near(r.finalPremixPct,2);near(r.nominalPureSiO2MgL,3.92);
  // Conversely 4.9mg/L pure SiO2 in 5L is 24.5mg: 25mg of 98% product.
  const water=calculateSilicaPowderDose({baseSaltG5L:.98,powderDoseMode:'water',nominalTargetMgL:4.9,purity:.98});
  near(water.doseG5L,.025);
  const high=calculateSilicaPowderDose({baseSaltG5L:.75,powderDoseMode:'water',nominalTargetMgL:1,purity:.99999999});
  near(high.doseG5L,.00500000005,1e-15);assert.equal(high.purity,.99999999);
});

test('powder input bounds and purity are strict; input limits do not claim safety',()=>{
  for(const bad of [null,0,-1,1.00001,NaN,Infinity,'99.999999',true])assert.throws(()=>calculateSilicaPowderDose({baseSaltG5L:1,purity:bad}));
  assert.throws(()=>calculateSilicaPowderDose({baseSaltG5L:1,powderDoseMode:'water',nominalTargetMgL:10}),/不是饮用安全限量/);
  assert.throws(()=>calculateSilicaPowderDose({baseSaltG5L:1,powderPct:3}),/不是安全限量/);
  assert.throws(()=>calculateSilicaPowderDose({baseSaltG5L:1,powderDoseMode:'dissolved'}));
  for(const bad of [null,-1,'1',Infinity]){
    assert.throws(()=>calculateSilicaPowderDose({baseSaltG5L:bad}));
    assert.throws(()=>calculateSilicaPowderDose({baseSaltG5L:1,powderDoseMode:'water',nominalTargetMgL:bad}));
  }
});

test('rounding 2.5mg to a 3mg displayed dose gives 0.6mg/L nominal, not the requested 0.5',()=>{
  const c=computeUiFormulation({...options,silica:powder(.5)});
  near(c.displaySilicaG,.003);near(c.silica.actualProductG5L,.003);near(c.silica.actualProductMg5L,3);
  near(c.silica.requestedNominalSiO2MgL,.5);near(c.silica.nominalSiO2MgL,.599999994);
  assert.equal(c.silica.doseMatched,false);assert.equal(c.silicaDoseMatched,false);assert.equal(c.matched,false);
  assert.equal(c.ionMatched,true);assert.ok(c.warnings.some(s=>s.includes('量化后名义投料偏离')));
});

test('small powder amount rounded to zero is a visible deviation while zero requested dose is valid',()=>{
  const small=computeUiFormulation({...options,silica:powder(.01)});
  assert.equal(small.displaySilicaG,0);assert.equal(small.silica.nominalSiO2MgL,0);
  assert.equal(small.silica.doseMatched,false);assert.equal(small.matched,false);assert.ok(small.warnings.some(s=>s.includes('实际投加为0')));
  const zero=computeUiFormulation({...options,silica:powder(0)});
  assert.equal(zero.displaySilicaG,0);assert.equal(zero.silica.nominalSiO2MgL,0);assert.equal(zero.silica.doseMatched,true);
});

test('adding neutral powder never reduces salt targets or changes salt ions, GH, carbonate contribution or EC',()=>{
  const before=computeUiFormulation(options);
  for(const C of [.5,1,2,5]){
    const after=computeUiFormulation({...options,silica:powder(C)});
    assert.deepEqual(after.baseAmounts,before.baseAmounts);assert.deepEqual(after.displayDosesG,before.displayDosesG);
    assert.deepEqual(after.loads,before.loads);assert.deepEqual(after.metrics,before.metrics);
    assert.deepEqual(after.conductivity,before.conductivity);
    near(after.exactTotal-before.exactTotal,after.silica.doseG5L);
    assert.equal(after.silica.dissolvedSiO2MgL,null);assert.equal(after.silica.colloidalSiO2MgL,null);
  }
});

test('actual 100g blend and daily dose independently reproduce nominal SiO2 and salt ions',()=>{
  for(const target of [.5,1,2,5]){
    const c=computeUiFormulation({...options,outputMode:'premix',outputAmount:100,silica:powder(target)});
    const actualProductG5L=c.displaySilicaG/c.actualBatchG*c.total;
    const nominalMgL=actualProductG5L*.99999999*1000/5;
    near(c.silica.actualProductG5L,actualProductG5L);
    near(c.silica.nominalSiO2MgL,nominalMgL);
    near(c.silica.actualPremixPct,c.displaySilicaG/c.actualBatchG*100);
    const salts=Object.fromEntries(Object.entries(c.displayDosesG).map(([id,g])=>[id,g/c.actualBatchG*c.total]));
    const ledger=calculateIonLoads({dosesG:salts,volumeL:5,dataset});
    assert.deepEqual(c.loads,ledger.ionsMgL);
    assert.equal(c.loads.Silica,0,'powder nominal SiO2 is a separate non-ionic mass ledger');
  }
});

test('phase concentrations stay unknown and actual mass cannot exceed the entire dose',()=>{
  const requested=calculateSilicaPowderDose({baseSaltG5L:.75,powderDoseMode:'water',nominalTargetMgL:1,purity:1});
  const r=calculateActualSilicaPowderDose({requested,actualProductG5L:.005,actualTotalG5L:.755});
  assert.equal(r.dissolvedSiO2MgL,null);assert.equal(r.colloidalSiO2MgL,null);near(r.nominalSiO2MgL,1);
  assert.throws(()=>calculateActualSilicaPowderDose({requested,actualProductG5L:.8,actualTotalG5L:.755}));
  assert.throws(()=>computeUiFormulation({...options,silica:{...powder(1),purity:null}}));
});
