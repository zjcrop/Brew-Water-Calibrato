import test from 'node:test';
import assert from 'node:assert/strict';
import {createWaterTransferRecord} from '../../core/water-transfer.mjs';
import {assessThermalWater} from '../../core/thermal-water.mjs';
const loads={Ca:10,Mg:8,Na:5,K:3,HCO3:30,CO3:0,Cl:2,SO4:4};
const formulation={loads,volumeL:5,ionicAccountingComplete:true};
const heatingAssessment=assessThermalWater({ionsMgL:loads,context:'kettle',heatingTemperatureC:93}).heatingAssessment;

test('water transfer preserves pre-heating ledger and unknown measurements',()=>{
  const record=createWaterTransferRecord({formulation,profileId:'geisha',heatingAssessment});
  assert.equal(record.water.calciumMgL,10);assert.equal(record.water.bicarbonateMgL,30);
  for(const key of ['tdsMgL','pH','alkalinityMgLAsCaCO3'])assert.equal(record.water[key],null);
  assert.equal(record.water.concentrationBasis,'pre-heating-calculated');
  assert.equal(record.water.heatingAssessment.predictions.heatedCalciumMgL,null);
  assert.deepEqual(record.water.heatingAssessment.brewAdjustment,{automatic:false,temperatureDeltaC:0,timeDeltaSec:0,reason:heatingAssessment.brewAdjustment.reason});
  record.water.heatingAssessment.history.heatingTemperatureC=80;
  assert.equal(heatingAssessment.history.heatingTemperatureC,93,'Export edits cannot alter source thermal record');
});
test('incomplete ionic accounting remains explicit across transfer',()=>{
  assert.equal(createWaterTransferRecord({formulation:{...formulation,ionicAccountingComplete:false},profileId:'custom',heatingAssessment}).water.ionicAccountingComplete,false);
});
test('water transfer rejects malformed concentrations and volume',()=>{
  for(const bad of [null,'10',-1,NaN])assert.throws(()=>createWaterTransferRecord({formulation:{...formulation,loads:{...loads,Ca:bad}},profileId:'geisha',heatingAssessment}));
  assert.throws(()=>createWaterTransferRecord({formulation:{...formulation,volumeL:0},profileId:'geisha',heatingAssessment}));
});
