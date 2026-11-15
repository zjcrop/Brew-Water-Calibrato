/** Stable water fields retain their original units. A dose ledger is neither
 * a TDS measurement nor an analysis of the heated sample. */
export function createWaterTransferRecord({formulation,profileId,heatingAssessment}) {
  if(!formulation||!formulation.loads)throw new TypeError('需要已核验的配方结果');
  if(typeof profileId!=='string'||!profileId.trim())throw new TypeError('需要水型标识');
  const value=(key)=>{
    const n=formulation.loads[key];
    if(typeof n!=='number'||!Number.isFinite(n)||n<0)throw new TypeError('离子浓度无效：'+key);
    return n;
  };
  const volume=formulation.volumeL;
  if(typeof volume!=='number'||!Number.isFinite(volume)||volume<=0)throw new TypeError('配方水体积无效');
  if(!heatingAssessment||heatingAssessment.method!=='thermal-history-screening/1.0')throw new TypeError('需要已核验的加热记录');
  const ionMap={Ca:'calciumMgL',Mg:'magnesiumMgL',Na:'sodiumMgL',K:'potassiumMgL',HCO3:'bicarbonateMgL',Cl:'chlorideMgL',SO4:'sulfateMgL'};
  return {water:{
    profileId,source:'萃离配方（近零矿化RO水）',recipeVolumeL:volume,
    tdsMgL:null,pH:null,pHSource:'unknown',alkalinityMgLAsCaCO3:null,
    ...Object.fromEntries(Object.entries(ionMap).map(([ion,field])=>[field,value(ion)])),
    concentrationBasis:'pre-heating-calculated',ionicAccountingComplete:formulation.ionicAccountingComplete===true,
    heatingAssessment:structuredClone(heatingAssessment)
  }};
}
