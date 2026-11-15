// Engineering mass bookkeeping for hydrophilic SiO2 powder. Nominal SiO2 mass
// is not a measured dissolved concentration or a recommended drinking dose.
export const SILICA_DOSE_BOUNDS = Object.freeze({powderPctMax:2,nominalTargetMgLMax:5});
export const DEFAULT_SILICA_PURITY = 0.99999999; // User's labeled 99.999999%.
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
function nonNegative(value,label){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new TypeError(`${label}必须是非负有限数值`);
  return value;
}
export function calculateSilicaPowderDose({baseSaltG5L,powderDoseMode='percent',purity=DEFAULT_SILICA_PURITY,powderPct=0,nominalTargetMgL=0}){
  nonNegative(baseSaltG5L,'每5L基础盐质量');
  if(typeof purity!=='number'||!Number.isFinite(purity)||purity<=0||purity>1)throw new RangeError('SiO₂标称纯度必须大于0且不超过100%');
  let doseG5L;
  if(powderDoseMode==='percent'){
    nonNegative(powderPct,'最终母粉SiO₂产品质量百分比');
    if(powderPct>SILICA_DOSE_BOUNDS.powderPctMax)throw new RangeError('当前母粉百分比模式范围为0–2%；这是工程输入范围，不是安全限量');
    doseG5L=baseSaltG5L*powderPct/(100-powderPct);
  }else if(powderDoseMode==='water'){
    nonNegative(nominalTargetMgL,'水中名义SiO₂投料目标');
    if(nominalTargetMgL>SILICA_DOSE_BOUNDS.nominalTargetMgLMax)throw new RangeError('当前名义投料工程对照范围为0–5 mg/L，不是饮用安全限量');
    doseG5L=nominalTargetMgL*5/1000/purity;
  }else throw new Error('SiO₂粉体剂量模式须为percent或water');
  const total=baseSaltG5L+doseG5L;
  const nominalPureSiO2MgL=doseG5L*purity*1000/5;
  return {
    powderDoseMode,purity,powderPct:total>0?doseG5L/total*100:0,
    nominalTargetMgL:powderDoseMode==='water'?nominalTargetMgL:nominalPureSiO2MgL,
    doseG5L,doseG:doseG5L,nominalPureSiO2MgL,requestedNominalSiO2MgL:nominalPureSiO2MgL,
    finalPremixPct:total>0?doseG5L/total*100:0,finalDoseG5L:total,
    dissolvedSiO2MgL:null,colloidalSiO2MgL:null,
    phaseInterpretation:'nominal-mass-only-dissolved-and-colloidal-fractions-unmeasured'
  };
}

export function calculateActualSilicaPowderDose({requested,actualProductG5L,actualTotalG5L}){
  if(!requested||typeof requested!=='object')throw new TypeError('需先提供SiO₂名义投料换算结果');
  nonNegative(actualProductG5L,'实际每5L SiO₂产品质量');nonNegative(actualTotalG5L,'实际每5L母粉总质量');
  if(actualProductG5L>actualTotalG5L+1e-10)throw new RangeError('SiO₂产品质量不能超过同批总质量');
  const purity=requested.purity;
  if(typeof purity!=='number'||!Number.isFinite(purity)||purity<=0||purity>1)throw new RangeError('SiO₂标称纯度无效');
  if(!own(requested,'requestedNominalSiO2MgL'))throw new Error('缺少请求的名义SiO₂投料量');
  const target=nonNegative(requested.requestedNominalSiO2MgL,'请求的名义SiO₂投料量');
  const nominalSiO2MgL=actualProductG5L*purity*1000/5,deviation=nominalSiO2MgL-target;
  // A declared weighing comparison tolerance, not assay uncertainty or a sensory limit.
  const toleranceMgL=Math.max(.01,target*.05);
  const doseMatched=!(target>0&&actualProductG5L===0)&&Math.abs(deviation)<=toleranceMgL;
  return {
    ...requested,actualProductG5L,actualProductMg5L:actualProductG5L*1000,
    actualPremixPct:actualTotalG5L>0?actualProductG5L/actualTotalG5L*100:0,
    nominalSiO2MgL,nominalDeviationMgL:deviation,nominalDoseToleranceMgL:toleranceMgL,doseMatched,
    dissolvedSiO2MgL:null,colloidalSiO2MgL:null
  };
}
