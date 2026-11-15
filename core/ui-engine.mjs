import { formulateBrewingWater, calculateIonLoads, calculateWaterMetrics, chargeBalance, quantizeDose, evaluateOperationalRisks } from './water-engine.mjs';
import { buildWeighingOrder } from './weighing-order.mjs';

const atomic = { Na:22.990, K:39.098 };
const sum = values => Object.values(values).reduce((a,b)=>a+b,0);
const lambdas = { Ca:119, Mg:106, Na:50.1, K:73.5, HCO3:44.5, CO3:138.6, Cl:76.3, SO4:160, Lactate:40, Citrate:70, Gluconate:35 };
function positive(value,label,zero=false) {
  if(typeof value!=='number'||!Number.isFinite(value)||(zero?value<0:value<=0))throw new TypeError(`${label}必须是${zero?'非负':'正'}有限数值`);
  return value;
}
export function getWeighingOrder(dosesG,solutes) {
  return buildWeighingOrder({dosesG,solutes}).steps;
}
export function applyLinkedDoseEdit({baseDosesG,currentDosesG,id,percentage}) {
  if(!(id in baseDosesG)||baseDosesG[id]<=0)throw new Error('该盐没有可微调的基础用量');
  if(typeof percentage!=='number'||!Number.isFinite(percentage))throw new Error('微调比例必须为有限数值');
  const total=sum(baseDosesG),requested=baseDosesG[id]*(1+percentage/100);
  const target=Math.min(total,Math.max(0,requested));
  const others=Object.keys(baseDosesG).filter(key=>key!==id&&baseDosesG[key]>0);
  if(!others.length)return {dosesG:{...baseDosesG},limited:true};
  const currentSum=others.reduce((n,key)=>n+(currentDosesG[key]||0),0);
  const weights=currentSum>0?currentDosesG:baseDosesG;
  const weightSum=others.reduce((n,key)=>n+(weights[key]||0),0);
  const result=Object.fromEntries(Object.keys(baseDosesG).map(key=>[key,0]));result[id]=target;
  for(const key of others)result[key]=(total-target)*(weights[key]||0)/weightSum;
  return {dosesG:result,limited:Math.abs(requested-target)>1e-10};
}
export function estimateConductivity(ions, masses, factor=0.5) {
  positive(factor,'TDS仪表系数');
  if(factor<0.4||factor>0.9)throw new RangeError('TDS仪表系数应在0.4–0.9之间');
  const ec=Object.entries(lambdas).reduce((total,[ion,lambda])=>total+(ions[ion]||0)/masses[ion]*lambda,0);
  return {ecUsCm:ec,meterTdsPpm:ec*factor,factor,basis:'理想稀溶液电导参考；不含络合、沉淀或温度修正，不是实测值'};
}
export function preferredRecipe({target,allowedSolutes,dataset,bias={}}) {
  const result={};
  const distribute=(list,quantity,getAmount)=>{
    const weights=list.map(m=>(m.tier==='推荐'?1:m.tier==='谨慎'?.55:.18)*(bias[m.id]||1));
    const total=weights.reduce((a,b)=>a+b,0);
    list.forEach((m,i)=>result[m.id]=(result[m.id]||0)+getAmount(m,quantity*weights[i]/total));
  };
  for(const ion of ['Ca','Mg']){
    const list=allowedSolutes.filter(m=>m.cation===ion);
    distribute(list,target[ion],(m,mgL)=>mgL*5/1000/dataset.ionMolarMasses[ion]/m.catN*m.mw/m.purity);
  }
  const buffers=allowedSolutes.filter(m=>m.anion==='HCO3');
  const sodium=buffers.filter(m=>m.cation==='Na'), potassium=buffers.filter(m=>m.cation==='K');
  const eq=target.HCO3*5/1000/dataset.ionMolarMasses.HCO3;
  const naShare=sodium.length?(potassium.length?target.naShare:1):0;
  distribute(sodium,eq*naShare,(m,n)=>n/m.anN*m.mw/m.purity);
  distribute(potassium,eq*(1-naShare),(m,n)=>n/m.anN*m.mw/m.purity);
  return result;
}
export function computeUiFormulation({dataset,target,selectedIds,bias={},tweaks={},manualDosesG={},outputMode='direct',outputAmount=5,scaleResolutionG=.001,meterFactor=.5,silica=null}) {
  positive(outputAmount,'目标总量/水量');positive(scaleResolutionG,'称量分辨率');
  if(!['direct','premix'].includes(outputMode))throw new Error('未知输出方式');
  const allowed=dataset.solutes.filter(m=>selectedIds.includes(m.id));
  if(!allowed.length)throw new Error('请至少选择一种配方盐');
  const targets={Ca:target.Ca,Mg:target.Mg,HCO3:target.HCO3};
  const preferred=preferredRecipe({target,allowedSolutes:allowed,dataset,bias});
  const solved=formulateBrewingWater({targetIonsMgL:targets,volumeL:5,allowedSoluteIds:allowed.map(m=>m.id),dataset,scaleResolutionG:.000001,preferredDosesG:preferred});
  const exact={...solved.exactDosesG};
  if(!manualDosesG||typeof manualDosesG!=='object'||Array.isArray(manualDosesG))throw new TypeError('手动投加必须是按盐ID记录的每5L克数');
  const manual={};
  for(const [id,dose] of Object.entries(manualDosesG)){
    if(!allowed.some(m=>m.id===id))throw new Error('手动投加的盐必须先在原料中勾选：'+id);
    positive(dose,'手动投加量（g/5L）',true);
    if((exact[id]||0)>1e-10)throw new Error('该盐已有基础配方用量，请使用局部微调而不是手动覆盖：'+id);
    manual[id]=dose;exact[id]=dose;
  }
  // A deliberate experimental dose is applied after target solving. It changes
  // the forward ion ledger, never masquerades as an HCO3/alkalinity substitute.
  const baseAmounts={...exact};
  for(const id of Object.keys(exact)) {
    const value=tweaks[id]??0;
    if(typeof value!=='number'||!Number.isFinite(value)||value< -100)throw new Error('微调范围超出可用界限');
    exact[id]*=1+value/100;
  }
  const saltMass=sum(exact);
  if(saltMass<1e-9)throw new Error('选中盐无法提供当前目标离子，请选择适用的钙、镁或碳酸氢盐');
  const silicon=silica?{...silica}:{enabled:false};
  if(silicon.enabled&&silicon.route==='silica')silicon.doseG=saltMass*silicon.powderPct/(100-silicon.powderPct);
  const solidSilica=silicon.enabled&&silicon.solidInPremix?(silicon.doseG||0):0;
  const exactTotal=saltMass+solidSilica;
  const round=g=>quantizeDose(g,scaleResolutionG).recommendedG;
  let displayDosesG={},amounts={},displaySilicaG=0,sampleDose5L,actualBatchG=null;
  if(outputMode==='direct') {
    displayDosesG=Object.fromEntries(Object.entries(exact).map(([id,g])=>[id,round(g*outputAmount/5)]));
    displaySilicaG=round(solidSilica*outputAmount/5);
    if(sum(displayDosesG)+displaySilicaG<=0)throw new Error('当前水量下所有投料均小于天平分辨率，请增大配方水量、配制母粉或使用更精细的天平');
    amounts=Object.fromEntries(Object.entries(displayDosesG).map(([id,g])=>[id,g*5/outputAmount]));
    sampleDose5L=(sum(displayDosesG)+displaySilicaG)*5/outputAmount;
  }else{
    displayDosesG=Object.fromEntries(Object.entries(exact).map(([id,g])=>[id,round(g/exactTotal*outputAmount)]));
    displaySilicaG=round(solidSilica/exactTotal*outputAmount);
    actualBatchG=sum(displayDosesG)+displaySilicaG;
    if(actualBatchG<=0)throw new Error('当前天平分辨率无法称出母粉，请增大总量或使用更精细的天平');
    sampleDose5L=round(exactTotal);
    if(sampleDose5L<=0)throw new Error('每5L母粉取用量小于天平分辨率，请使用更精细的天平或增大实际冲配水量');
    amounts=Object.fromEntries(Object.entries(displayDosesG).map(([id,g])=>[id,g/actualBatchG*sampleDose5L]));
  }
  const loadsResult=calculateIonLoads({dosesG:amounts,volumeL:5,dataset});
  const ions={...loadsResult.ionsMgL};
  const warnings=[];
  if(Object.values(manual).some(g=>g>0))warnings.push('手动试验盐按每5L克数加入并计入实际离子；未当作碳酸氢根或等量缓冲，也未保证符合原预设目标。');
  const actualSilicaG=outputMode==='direct'?displaySilicaG*5/outputAmount:(actualBatchG?displaySilicaG/actualBatchG*sampleDose5L:0);
  if(silicon.enabled) {
    if(silicon.route==='potassium') {
      ions.K+=(actualSilicaG*(silicon.kPct||0)/94.196)*2*atomic.K*1000/5;
      warnings.push('硅酸钾额外钾已计入；硅酸物种、总碱度和电导尚未建模，碳酸氢根目标未被静默抵扣。');
    }else if(silicon.route==='liquid')warnings.push('液体硅按标签体积单独添加；载体中的钠、钾、酸和稳定剂未计入。');
    else warnings.push('SiO₂粉体按悬浮添加物处理，不计入溶解离子或电导参考。');
  }
  const metrics=calculateWaterMetrics({ionsMgL:ions});
  const residuals=Object.fromEntries(Object.entries(targets).map(([ion,value])=>[ion,ions[ion]-value]));
  const matched=Object.entries(residuals).every(([ion,error])=>Math.abs(error)<=Math.max(.25,targets[ion]*.03));
  const balance=chargeBalance({ionsMgL:ions,ionMolarMasses:dataset.ionMolarMasses});
  const conductivity=estimateConductivity(ions,dataset.ionMolarMasses,meterFactor);
  const ionicAccountingComplete=!(silicon.enabled&&['potassium','liquid'].includes(silicon.route));
  if(!ionicAccountingComplete){balance.status='incomplete';balance.scope='silicon-counterions-or-carrier-not-fully-specified';}
  const risks=evaluateOperationalRisks({ionsMgL:ions,ionicMassSumMgL:sum(ions),chargeBalanceResult:ionicAccountingComplete?balance:{imbalancePct:0}});
  if(allowed.some(m=>exact[m.id]>1e-8&&['caco3','mgco3','cacit'].includes(m.id)))warnings.push('含溶解性需复核的盐：以下按完全溶解核算，实际溶液可能达不到标示浓度。');
  if((ions.Citrate||0)+(ions.Lactate||0)+(ions.Gluconate||0)>0)warnings.push('有机阴离子的滴定缓冲及钙镁络合尚未求解；碳酸盐碱度不包含这部分。');
  if(!matched)warnings.unshift('称量后的离子结果偏离预设目标，请检查盐源、微调和天平分辨率。');
  return {targets,solver:solved,baseAmounts,manualDosesG:manual,amounts,displayDosesG,displaySilicaG,outputMode,outputAmount,actualBatchG,
    total:sampleDose5L,exactTotal,baseTotal:sum(amounts),loads:ions,metrics,residuals,matched,chargeBalance:balance,conductivity,risks,warnings,
    silica:silicon,ionicAccountingComplete,scaleResolutionG,volumeL:outputMode==='direct'?outputAmount:5,assumptions:{source:'接近零矿化RO水',completeDissolution:true,measuredBeanChemistry:false}};
}
