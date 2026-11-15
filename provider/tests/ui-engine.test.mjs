import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractEmbeddedDataset} from '../scripts/extract-embedded-data.mjs';
import {computeUiFormulation,applyLinkedDoseEdit,getWeighingOrder,estimateConductivity} from '../../core/ui-engine.mjs';
import {calculateIonLoads} from '../../core/water-engine.mjs';
const data=extractEmbeddedDataset(fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8'),{sourceAppVersion:'2.8.0'});
const options={dataset:data,target:{Ca:10,Mg:8,HCO3:30,naShare:.6},selectedIds:['calac','mgso4','khco3','nahco3'],outputMode:'direct',outputAmount:5,scaleResolutionG:.001,meterFactor:.5};
const near=(x,y,e=.00001)=>assert.ok(Math.abs(x-y)<=e,`${x} vs ${y}`);
test('UI only-potassium buffer keeps full bicarbonate target',()=>{
  const c=computeUiFormulation({...options,selectedIds:['calac','mgso4','khco3']});near(c.loads.HCO3,30,.1);assert.equal(c.matched,true);
});
test('calcium citrate is not double allocated as potassium buffer',()=>{
  const c=computeUiFormulation({...options,selectedIds:['cacit','mgso4','nahco3']});near(c.loads.Ca,10,.05);near(c.loads.HCO3,30,.1);assert.ok(c.warnings.some(x=>x.includes('溶解性')));
});
test('displayed direct doses and volume reproduce reported ions',()=>{
  for(const outputAmount of [1,5,10]){
    const c=computeUiFormulation({...options,outputAmount});const actual=calculateIonLoads({dosesG:c.displayDosesG,volumeL:outputAmount,dataset:data});
    for(const ion of ['Ca','Mg','HCO3','SO4','Lactate'])near(c.loads[ion],actual.ionsMgL[ion]);
  }
});
test('mother powder rounding and daily dose reproduce reported ions',()=>{
  const c=computeUiFormulation({...options,outputMode:'premix',outputAmount:50,scaleResolutionG:.01});
  const sample=Object.fromEntries(Object.entries(c.displayDosesG).map(([id,g])=>[id,g/c.actualBatchG*c.total]));
  const actual=calculateIonLoads({dosesG:sample,volumeL:5,dataset:data});for(const ion of ['Ca','Mg','HCO3'])near(c.loads[ion],actual.ionsMgL[ion]);
});
test('linked +10% reaches exact desired salt mass and conserves total',()=>{
  const base={mgso4:1,calac:1,khco3:1};const r=applyLinkedDoseEdit({baseDosesG:base,currentDosesG:base,id:'mgso4',percentage:10});
  near(r.dosesG.mgso4,1.1);near(r.dosesG.calac,.95);near(Object.values(r.dosesG).reduce((a,b)=>a+b),3);
});
test('linked extremes remain nonnegative and recover when other salts were zero',()=>{
  const base={a:1,b:2};const max=applyLinkedDoseEdit({baseDosesG:base,currentDosesG:base,id:'a',percentage:9999});
  near(max.dosesG.a,3);near(max.dosesG.b,0);assert.equal(max.limited,true);
  const restored=applyLinkedDoseEdit({baseDosesG:base,currentDosesG:max.dosesG,id:'a',percentage:0});near(restored.dosesG.b,2);
});
test('independent salt edits do not renormalize other quantities',()=>{
  const before=computeUiFormulation(options),after=computeUiFormulation({...options,tweaks:{mgso4:10}});
  near(after.amounts.calac,before.amounts.calac);near(after.amounts.khco3,before.amounts.khco3);near(after.amounts.mgso4,before.amounts.mgso4*1.1,.001);
});
test('linked reallocation to a tiny base salt keeps mass without an arbitrary percentage ceiling',()=>{
  const base={a:1,b:.00001},edit=applyLinkedDoseEdit({baseDosesG:base,currentDosesG:base,id:'a',percentage:-100});
  near(edit.dosesG.b,1.00001);near(edit.dosesG.a,0);assert.ok((edit.dosesG.b/base.b-1)*100>10000);
});
test('empty salt selection and zero-output mass do not report success',()=>{
  assert.throws(()=>computeUiFormulation({...options,selectedIds:[]}),/选择/);assert.throws(()=>computeUiFormulation({...options,outputAmount:0}));
  assert.throws(()=>computeUiFormulation({...options,selectedIds:['nacit']}),/无法提供/);
});

test('zero-base experimental salts accept explicit g per 5L and join the forward ledger',()=>{
  const before=computeUiFormulation(options);
  const c=computeUiFormulation({...options,selectedIds:[...options.selectedIds,'nacit','nacl','kcl','kcit'],manualDosesG:{nacit:.1,nacl:.02,kcl:.01,kcit:.05}});
  const extra=calculateIonLoads({dosesG:{nacit:.1,nacl:.02,kcl:.01,kcit:.05},volumeL:5,dataset:data});
  for(const ion of ['Na','K','Cl','Citrate'])near(c.loads[ion]-before.loads[ion],extra.ionsMgL[ion]);
  near(c.loads.HCO3,before.loads.HCO3);
  assert.equal(c.baseAmounts.nacit,.1);assert.equal(c.manualDosesG.nacit,.1);
  assert.equal(c.metrics.totalAlkalinityMgLAsCaCO3,null);
  assert.ok(c.warnings.some(x=>x.includes('手动试验盐')));
});

test('manual doses cannot silently select salts, coerce unknowns, or overwrite solved base amounts',()=>{
  assert.throws(()=>computeUiFormulation({...options,manualDosesG:{nacit:.1}}),/勾选/);
  assert.throws(()=>computeUiFormulation({...options,manualDosesG:{unknown:.1}}),/勾选/);
  assert.throws(()=>computeUiFormulation({...options,manualDosesG:{mgso4:.1}}),/局部微调/);
  for(const bad of [null,undefined,'',false,'0.1',-1,NaN,Infinity]){
    assert.throws(()=>computeUiFormulation({...options,selectedIds:[...options.selectedIds,'nacit'],manualDosesG:{nacit:bad}}));
  }
  assert.throws(()=>computeUiFormulation({...options,manualDosesG:null}));
});

test('manual dose supplies a linked baseline and is quantized consistently in mother powder mode',()=>{
  const opts={...options,selectedIds:[...options.selectedIds,'nacit'],manualDosesG:{nacit:.1},outputMode:'premix',outputAmount:100,scaleResolutionG:.01};
  const before=computeUiFormulation(opts);
  const edited=applyLinkedDoseEdit({baseDosesG:before.baseAmounts,currentDosesG:before.baseAmounts,id:'nacit',percentage:10});
  const tweaks=Object.fromEntries(Object.entries(before.baseAmounts).map(([id,g])=>[id,g>0?(edited.dosesG[id]/g-1)*100:0]));
  const after=computeUiFormulation({...opts,tweaks});
  near(after.exactTotal,before.exactTotal);
  const sample=Object.fromEntries(Object.entries(after.displayDosesG).map(([id,g])=>[id,g/after.actualBatchG*after.total]));
  const actual=calculateIonLoads({dosesG:sample,volumeL:5,dataset:data});
  for(const ion of ['Ca','Mg','HCO3','Citrate','Na'])near(after.loads[ion],actual.ionsMgL[ion]);
});

test('unweighable direct and daily mother-powder doses fail instead of reporting a zero-dose solution',()=>{
  assert.throws(()=>computeUiFormulation({...options,outputAmount:.001,scaleResolutionG:.01}),/天平分辨率/);
  assert.throws(()=>computeUiFormulation({...options,outputMode:'premix',outputAmount:50,scaleResolutionG:10}),/每5L母粉取用量/);
});
test('silicate known potassium is counted but incomplete counterions not marked balanced',()=>{
  const c=computeUiFormulation({...options,silica:{enabled:true,route:'potassium',doseG:.02,solidInPremix:true,kPct:.30}});
  assert.equal(c.ionicAccountingComplete,false);assert.equal(c.chargeBalance.status,'incomplete');assert.ok(c.warnings.some(x=>x.includes('硅酸钾')));
});
test('conductivity meter coefficient changes displayed reference only',()=>{
  const a=computeUiFormulation({...options,meterFactor:.5}),b=computeUiFormulation({...options,meterFactor:.7});
  near(a.loads.Ca,b.loads.Ca);near(a.conductivity.meterTdsPpm*1.4,b.conductivity.meterTdsPpm);
  assert.throws(()=>estimateConductivity(a.loads,data.ionMolarMasses,0));
});
test('weighing follows moisture handling then actual dose not molecular mass',()=>{
  const steps=getWeighingOrder({cacl2:10,mgso4:8,khco3:1,nahco3:2},data.solutes);
  assert.deepEqual(steps.map(x=>x.id),['nahco3','khco3','mgso4','cacl2']);
});
