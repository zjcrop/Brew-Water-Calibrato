import test from 'node:test';
import assert from 'node:assert/strict';
import {assessThermalWater} from '../../core/thermal-water.mjs';
const ions={Ca:10,Mg:8,HCO3:30,CO3:0};
const base={ionsMgL:ions,heatingTemperatureC:95,context:'kettle',evaporationFraction:0,visiblePrecipitate:false};

test('single open-kettle heating preserves brewing parameters and makes no heat-loss prediction',()=>{
  const r=assessThermalWater(base),a=r.heatingAssessment;
  assert.equal(a.status,'single-heat-use');assert.equal(a.applicable,true);assert.equal(a.requirePostHeatMeasurement,false);
  assert.equal(a.scenario,'single-heating');assert.equal(a.history.heatingCycles,1);
  assert.equal(a.history.scopeSource,'user-specified-single-heating');
  assert.equal(Object.hasOwn(a.history,'holdMinutes'),false);assert.equal(Object.hasOwn(a.history,'reheatCount'),false);
  assert.deepEqual(a.ionsMgL,ions);assert.deepEqual(ions,{Ca:10,Mg:8,HCO3:30,CO3:0});
  assert.equal(r.brewAdjustment.automatic,false);assert.equal(r.brewAdjustment.temperatureDeltaC,0);assert.equal(r.brewAdjustment.timeDeltaSec,0);
  assert.equal(a.brewAdjustment,r.brewAdjustment);assert.ok(Object.values(a.predictions).every(value=>value===null));
  assert.equal(a.carbonateOnlyLedgerCapacity,null);
});

test('missing measurements remain null rather than zero or a fictitious source-water pH',()=>{
  const a=assessThermalWater({ionsMgL:{Ca:10}}).heatingAssessment;
  assert.equal(a.ionsMgL.Mg,null);assert.equal(a.ionsMgL.HCO3,null);assert.equal(a.history.pHMeasured,null);
  assert.equal(a.preHeatCalculatedReference.hardnessMgLAsCaCO3,null);
  assert.equal(a.preHeatCalculatedReference.totalAlkalinityMgLAsCaCO3,null);
  assert.equal(a.history.visiblePrecipitate,null);
  assert.ok(!a.missingInputs.includes('holdMinutes'));assert.ok(!a.missingInputs.includes('reheatCount'));
  assert.equal(a.status,'history-incomplete');assert.ok(a.missingInputs.includes('ionsMgL.Mg'));
});

test('each paired calculated reference requires both known species; real zeros remain zero',()=>{
  for(const ionsMgL of [{},{Ca:0},{Mg:0},{Ca:10,Mg:null}]){
    const a=assessThermalWater({ionsMgL}).heatingAssessment;
    assert.equal(a.preHeatCalculatedReference.hardnessMgLAsCaCO3,null);
  }
  for(const ionsMgL of [{},{HCO3:0},{CO3:0},{HCO3:30,CO3:null}]){
    const a=assessThermalWater({ionsMgL}).heatingAssessment;
    assert.equal(a.preHeatCalculatedReference.carbonateAlkalinityMgLAsCaCO3,null);
  }
  const zeros=assessThermalWater({ionsMgL:{Ca:0,Mg:0,HCO3:0,CO3:0}}).heatingAssessment;
  assert.equal(zeros.preHeatCalculatedReference.hardnessMgLAsCaCO3,0);
  assert.equal(zeros.preHeatCalculatedReference.carbonateAlkalinityMgLAsCaCO3,0);
});

test('a single heating to 93 or 100 degrees cannot establish calcium loss or a need to change brewing',()=>{
  const a=assessThermalWater({...base,heatingTemperatureC:93}).heatingAssessment;
  const b=assessThermalWater({...base,heatingTemperatureC:100}).heatingAssessment;
  for(const r of [a,b]){
    assert.equal(r.status,'single-heat-use');assert.deepEqual(r.flags,[]);
    assert.equal(r.predictions.calciumLossMgL,null);assert.equal(r.predictions.precipitationOnsetTemperatureC,null);
    assert.equal(r.brewAdjustment.automatic,false);assert.equal(r.brewAdjustment.temperatureDeltaC,0);assert.equal(r.brewAdjustment.timeDeltaSec,0);
  }
  assert.deepEqual(a.advice,b.advice);assert.deepEqual(a.preHeatCalculatedReference,b.preHeatCalculatedReference);
});

test('evaporation returns a volume-only nonreactive scenario and never a heated calcium concentration',()=>{
  const a=assessThermalWater({...base,evaporationFraction:.2}).heatingAssessment;
  assert.equal(a.evaporationScenario.nonreactiveConcentrationFactor,1.25);
  assert.equal(a.evaporationScenario.heatedIonConcentrationsMgL,null);
  assert.equal(a.ionsMgL.Ca,10);assert.equal(a.predictions.permanentHardnessIncreaseMgL,null);
  assert.equal(a.requirePostHeatMeasurement,true);
});

test('visible precipitate requests checking the actual use water but is not converted to calcium loss',()=>{
  const a=assessThermalWater({...base,visiblePrecipitate:true}).heatingAssessment;
  assert.ok(a.flags.includes('visible-precipitate'));assert.equal(a.requirePostHeatMeasurement,true);
  assert.equal(a.predictions.calciumLossMgL,null);
});

test('paired measured differences never substitute calculated baseline for a missing observation',()=>{
  const onlyAfter=assessThermalWater({...base,visiblePrecipitate:true,postHeatGHmgLAsCaCO3:50,postHeatAlkalinitymgLAsCaCO3:20}).heatingAssessment;
  assert.equal(onlyAfter.requirePostHeatMeasurement,false);
  assert.equal(onlyAfter.measuredDifferences.hardnessMgLAsCaCO3,null);
  assert.equal(onlyAfter.measuredDifferences.totalAlkalinityMgLAsCaCO3,null);
  const paired=assessThermalWater({...base,preHeatGHmgLAsCaCO3:60,postHeatGHmgLAsCaCO3:50,preHeatAlkalinitymgLAsCaCO3:25,postHeatAlkalinitymgLAsCaCO3:20}).heatingAssessment;
  assert.equal(paired.measuredDifferences.hardnessMgLAsCaCO3,-10);
  assert.equal(paired.measuredDifferences.totalAlkalinityMgLAsCaCO3,-5);
  assert.equal(paired.predictions.calciumLossMgL,null);
});

test('optional capacity is a carbonate-only calcium ledger, not a modeled loss or advice input',()=>{
  // 1 mmol/L Ca and 1 mmol/L bicarbonate can supply at most 0.5 mmol/L
  // carbonate from that entered bicarbonate inventory: 50.043 mg/L as CaCO3.
  const input={...base,ionsMgL:{Ca:40.078,Mg:243.05,HCO3:61.017,CO3:0},includeCarbonateLedgerCapacity:true};
  const a=assessThermalWater(input).heatingAssessment;
  assert.equal(a.carbonateOnlyLedgerCapacity.mgLAsCaCO3,50.043);
  const noMg=assessThermalWater({...input,ionsMgL:{...input.ionsMgL,Mg:0}}).heatingAssessment;
  assert.equal(a.carbonateOnlyLedgerCapacity.mgLAsCaCO3,noMg.carbonateOnlyLedgerCapacity.mgLAsCaCO3);
  assert.equal(a.carbonateOnlyLedgerCapacity.influencesAdvice,false);
  assert.deepEqual(a.advice,noMg.advice);
  assert.equal(a.predictions.calciumLossMgL,null);
  assert.equal(assessThermalWater({ionsMgL:{Ca:10},includeCarbonateLedgerCapacity:true}).heatingAssessment.carbonateOnlyLedgerCapacity,null);
});

test('espresso-boiler and unknown context are explicitly outside open-kettle conclusions',()=>{
  const a=assessThermalWater({...base,context:'espresso-boiler',heatingTemperatureC:125}).heatingAssessment;
  assert.equal(a.applicable,false);assert.equal(a.status,'outside-kettle-scope');assert.ok(a.advice.some(text=>text.includes('不用于意式锅炉')));
  const unknown=assessThermalWater({...base,context:'unknown'}).heatingAssessment;
  assert.equal(unknown.applicable,false);assert.equal(unknown.status,'context-unconfirmed');
});

test('strict ranges and types reject invented values without coercing blanks or booleans',()=>{
  for(const bad of ['',false,'95',NaN,Infinity,-1,101])assert.throws(()=>assessThermalWater({...base,heatingTemperatureC:bad}));
  for(const bad of [-.1,1,1.1,'0.1',true])assert.throws(()=>assessThermalWater({...base,evaporationFraction:bad}));
  for(const bad of [-1,15,'7',true])assert.throws(()=>assessThermalWater({...base,pHMeasured:bad}));
  assert.throws(()=>assessThermalWater({...base,visiblePrecipitate:0}));
  assert.throws(()=>assessThermalWater({...base,context:'coffee'}));
  assert.throws(()=>assessThermalWater({...base,postHeatGHmgLAsCaCO3:-1}));
  assert.throws(()=>assessThermalWater({...base,postHeatAlkalinitymgLAsCaCO3:'30'}));
  assert.throws(()=>assessThermalWater({...base,ionsMgL:{Ca:'10'}}));
  assert.throws(()=>assessThermalWater({...base,includeCarbonateLedgerCapacity:null}));
});
