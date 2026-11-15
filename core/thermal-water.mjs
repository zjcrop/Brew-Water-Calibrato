import {calculateWaterMetrics} from './water-engine.mjs';

export const THERMAL_WATER_METHOD='thermal-history-screening/1.0';
const ionKeys=['Ca','Mg','HCO3','CO3'];
function nullableNumber(value,label,min,max){
  if(value===undefined||value===null)return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new RangeError(`${label} must be a finite number within [${min},${max}], or null when unknown.`);
  return value;
}
function nullableBoolean(value,label){
  if(value===undefined||value===null)return null;
  if(typeof value!=='boolean')throw new TypeError(`${label} must be boolean or null when unknown.`);
  return value;
}
const difference=(after,before)=>after!==null&&before!==null?after-before:null;

/**
 * Newly prepared water heated once in an open kettle to brewing temperature.
 * This is use advice, not a carbonate-equilibrium or precipitation model.
 * No calculated source-water concentration is overwritten with a heated estimate.
 */
export function assessThermalWater({
  ionsMgL={},heatingTemperatureC=null,context='kettle',
  evaporationFraction=null,visiblePrecipitate=null,pHMeasured=null,
  preHeatGHmgLAsCaCO3=null,postHeatGHmgLAsCaCO3=null,
  preHeatAlkalinitymgLAsCaCO3=null,postHeatAlkalinitymgLAsCaCO3=null,
  includeCarbonateLedgerCapacity=false
}={}){
  if(!ionsMgL||typeof ionsMgL!=='object'||Array.isArray(ionsMgL))throw new TypeError('ionsMgL must be an object.');
  if(!['kettle','espresso-boiler','unknown'].includes(context))throw new Error('context must be kettle, espresso-boiler or unknown.');
  if(typeof includeCarbonateLedgerCapacity!=='boolean')throw new TypeError('includeCarbonateLedgerCapacity must be boolean.');
  const ions=Object.fromEntries(ionKeys.map(ion=>[ion,nullableNumber(ionsMgL[ion],`ionsMgL.${ion}`,0,10000)]));
  // A declared non-kettle context is retained so the caller can show the scope
  // warning; its 0-150 C recording range is not an equipment suitability claim.
  const temperature=nullableNumber(heatingTemperatureC,'heatingTemperatureC',0,context==='kettle'?100:150);
  const evaporation=nullableNumber(evaporationFraction,'evaporationFraction',0,1);
  if(evaporation===1)throw new RangeError('evaporationFraction must be below 1; a dry kettle has no remaining water concentration.');
  const visible=nullableBoolean(visiblePrecipitate,'visiblePrecipitate');
  const ph=nullableNumber(pHMeasured,'pHMeasured',0,14);
  const preGH=nullableNumber(preHeatGHmgLAsCaCO3,'preHeatGHmgLAsCaCO3',0,10000);
  const postGH=nullableNumber(postHeatGHmgLAsCaCO3,'postHeatGHmgLAsCaCO3',0,10000);
  const preAlk=nullableNumber(preHeatAlkalinitymgLAsCaCO3,'preHeatAlkalinitymgLAsCaCO3',0,10000);
  const postAlk=nullableNumber(postHeatAlkalinitymgLAsCaCO3,'postHeatAlkalinitymgLAsCaCO3',0,10000);
  const knownIons=Object.fromEntries(Object.entries(ions).filter(([,value])=>value!==null));
  const metrics=calculateWaterMetrics({ionsMgL:knownIons});
  const history={heatingCycles:1,scopeSource:'user-specified-single-heating',heatingTemperatureC:temperature,context,evaporationFraction:evaporation,visiblePrecipitate:visible,pHMeasured:ph};
  const missingInputs=[...ionKeys.filter(ion=>ions[ion]===null).map(ion=>'ionsMgL.'+ion),...Object.entries(history).filter(([key,value])=>key!=='pHMeasured'&&value===null).map(([key])=>key)];
  const applicable=context==='kettle';
  const flags=[];
  if(evaporation!==null&&evaporation>0)flags.push('evaporation-reported');
  if(visible===true)flags.push('visible-precipitate');
  const postHeatCheckAdvised=flags.length>0;
  const missingPostHeatMeasurements=[];
  if(postGH===null)missingPostHeatMeasurements.push('postHeatGHmgLAsCaCO3');
  if(postAlk===null)missingPostHeatMeasurements.push('postHeatAlkalinitymgLAsCaCO3');
  const requirePostHeatMeasurement=postHeatCheckAdvised&&missingPostHeatMeasurements.length>0;
  const advice=[];
  if(context==='espresso-boiler')advice.push('本模块只面向开放式水壶复矿水，不用于意式锅炉水垢、腐蚀或进水合规判断；请按设备要求和实测水质核对。');
  else if(context==='unknown')advice.push('请先确认是开放式水壶还是承压锅炉；当前仅保留通用记录，不给设备适用性结论。');
  else advice.push('需要冲煮时单次加热到原配方所需温度后使用；保留原有冲煮温度、时间与研磨设置作为对照。');
  advice.push('升温本身不会凭空生成新的钙镁或永久硬度；读数变化需分别核对蒸发浓缩、析出及检测条件。');
  if(missingInputs.length)advice.push('未提供的水质或单次加热记录保持未知，不能据此判断实际钙镁损失、起析温度或水垢量。');
  if(evaporation!==null&&evaporation>0)advice.push('蒸发减少水量；非反应物可能浓缩，但不能把同一倍率直接用于预测钙、镁或碳酸氢根的加热后浓度。');
  if(visible===true)advice.push('本次加热后已观察到析出或沉积：记录最终水量，再测实际使用水的硬度与碱度；不要把沉积简单换算为钙损失。');
  else if(visible===false)advice.push('未见可见沉积不等于没有物种变化或微量析出，肉眼观察不能替代硬度和碱度测量。');
  if(requirePostHeatMeasurement)advice.push('按本次单次加热条件复测实际使用水的硬度和总碱度，记录取样温度、滴定方法及终点。');
  if(preGH!==null&&postGH!==null)advice.push('前后硬度实测差值只作为样品变化记录；总硬度不能单独反推出钙损失，蒸发、取样和检测误差也需核对。');
  if(preAlk!==null&&postAlk!==null)advice.push('前后总碱度需采用相同检测方法和终点；二氧化碳逸出本身与碳酸钙析出的碱度影响不能混为一谈。');
  const brewAdjustment={automatic:false,temperatureDeltaC:0,timeDeltaSec:0,reason:'单次加热记录不证明需要改变咖啡萃取温度或时间；使用加热后实测水质与同豆杯测确认，当前不自动改动冲煮方案。'};
  const evaporationScenario=evaporation===null?null:{
    fraction:evaporation,nonreactiveConcentrationFactor:1/(1-evaporation),
    scope:'volume-only scenario for non-reacting material; not a heated Ca/Mg/HCO3 concentration prediction',
    heatedIonConcentrationsMgL:null
  };
  let carbonateOnlyLedgerCapacity=null;
  if(includeCarbonateLedgerCapacity&&ions.Ca!==null&&ions.HCO3!==null&&ions.CO3!==null){
    carbonateOnlyLedgerCapacity={
      mgLAsCaCO3:Math.min(ions.Ca/40.078,ions.HCO3/(2*61.017)+ions.CO3/60.008)*100.086,
      method:'min(nCa, nHCO3/2+nCO3) using only the entered pre-heat inventory',
      scope:'simplified carbonate-only stoichiometric ledger capacity; not expected precipitation, calcium loss or a rate',
      assumptions:['no additional inorganic carbon inventory','no acid-base/speciation or CO2-exchange model','organic ligands and their alkalinity excluded','no kinetic or surface model'],
      influencesAdvice:false
    };
  }
  const heatingAssessment={
    method:THERMAL_WATER_METHOD,
    scenario:'single-heating',
    scope:'single-heating-open-kettle-water-use-guidance-not-espresso-boiler-design-or-precipitation-equilibrium',
    applicable,context,status:!applicable?(context==='espresso-boiler'?'outside-kettle-scope':'context-unconfirmed'):postHeatCheckAdvised?'post-heat-check-advised':missingInputs.length?'history-incomplete':'single-heat-use',
    inputWaterBasis:'pre-heating-calculated-or-user-provided-ions-not-overwritten',
    ionsMgL:ions,history,flags,missingInputs,advice,requirePostHeatMeasurement,missingPostHeatMeasurements,
    preHeatCalculatedReference:{
      hardnessMgLAsCaCO3:ions.Ca!==null&&ions.Mg!==null?metrics.hardnessMgLAsCaCO3:null,
      carbonateAlkalinityMgLAsCaCO3:ions.HCO3!==null&&ions.CO3!==null?metrics.carbonateAlkalinityMgLAsCaCO3:null,
      totalAlkalinityMgLAsCaCO3:null
    },
    measurements:{preHeatGHmgLAsCaCO3:preGH,postHeatGHmgLAsCaCO3:postGH,preHeatAlkalinitymgLAsCaCO3:preAlk,postHeatAlkalinitymgLAsCaCO3:postAlk},
    measuredDifferences:{hardnessMgLAsCaCO3:difference(postGH,preGH),totalAlkalinityMgLAsCaCO3:difference(postAlk,preAlk),interpretation:'paired measurements only; not modeled thermal loss and not convertible to calcium loss from GH alone'},
    evaporationScenario,carbonateOnlyLedgerCapacity,brewAdjustment,
    predictions:{precipitationOnsetTemperatureC:null,heatedCalciumMgL:null,calciumLossMgL:null,permanentHardnessIncreaseMgL:null,pH:null,LSI:null}
  };
  return {heatingAssessment,brewAdjustment};
}
