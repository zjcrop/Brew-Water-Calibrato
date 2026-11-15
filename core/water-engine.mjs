// Ionic bookkeeping and non-negative formulation, not an equilibrium or sensory model.
export const ENGINE_VERSION = '1.1.0';
const DEFAULT_IONS = ['Ca','Mg','Na','K','HCO3','CO3','Cl','SO4','Lactate','Citrate','Gluconate','Silica'];
const CHARGES = Object.freeze({Ca:2,Mg:2,Na:1,K:1,HCO3:-1,CO3:-2,Cl:-1,SO4:-2,Lactate:-1,Citrate:-3,Gluconate:-1});
const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
const round = (value,places=9) => Number(value.toFixed(places));
function record(value,label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value;
}
function finite(value,label) {
  // Do not coerce unknown or mistyped measurements into zero.
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
}
function nonNegative(value,label) {
  if (finite(value,label)<0) throw new RangeError(`${label} must be non-negative.`);
  return value;
}
function positive(value,label) {
  if (finite(value,label)<=0) throw new RangeError(`${label} must be positive.`);
  return value;
}
function optional(object,key,fallback) { return own(object,key)?object[key]:fallback; }
function knownIon(ion,label) {
  if (!DEFAULT_IONS.includes(ion)) throw new Error(`${label}: unknown ion ${ion}.`);
}
function validateIonMap(values,label,masses) {
  record(values,label);
  for (const [ion,value] of Object.entries(values)) {
    knownIon(ion,label); nonNegative(value,`${label}.${ion}`);
    if (masses) positive(masses[ion],`ionMolarMasses.${ion}`);
  }
  return values;
}
function validateSolute(solute,masses,label) {
  record(solute,label);
  if (typeof solute.id !== 'string' || !solute.id.trim()) throw new Error(`${label}.id is required.`);
  const mw=positive(solute.mw,`${solute.id}.mw`),purity=finite(optional(solute,'purity',1),`${solute.id}.purity`);
  if (!(purity>0 && purity<=1)) throw new RangeError(`${solute.id}.purity must be within (0,1].`);
  let charge=0,ionicFormulaMass=0,sides=0;
  for (const side of ['cation','anion']) {
    const ion=solute[side];
    if (ion===undefined || ion===null) continue;
    knownIon(ion,`${solute.id}.${side}`);
    const z=CHARGES[ion],countKey=side==='cation'?'catN':'anN';
    if (!z || (side==='cation'?z<=0:z>=0)) throw new Error(`${solute.id}.${side} has invalid charge.`);
    const count=positive(solute[countKey],`${solute.id}.${countKey}`);
    if (!Number.isInteger(count)) throw new Error(`${solute.id}.${countKey} must be an integer formula count.`);
    ionicFormulaMass+=positive(masses[ion],`ionMolarMasses.${ion}`)*count;
    charge+=z*count; sides+=1;
  }
  if (!sides || charge!==0) throw new Error(`${solute.id} must describe a charge-balanced salt formula.`);
  if (ionicFormulaMass>mw+0.05) throw new Error(`${solute.id}.mw is below its ionic formula mass.`);
  return {mw,purity};
}
export function validateDataset(dataset) {
  record(dataset,'Dataset');
  if (!Array.isArray(dataset.solutes) || !dataset.solutes.length) throw new Error('Dataset requires solutes.');
  record(dataset.ionMolarMasses,'Dataset.ionMolarMasses');
  for (const [ion,mass] of Object.entries(dataset.ionMolarMasses)) {knownIon(ion,'Dataset.ionMolarMasses');positive(mass,`ionMolarMasses.${ion}`);}
  const ids=new Set();
  for (const [index,solute] of dataset.solutes.entries()) {
    validateSolute(solute,dataset.ionMolarMasses,`solutes[${index}]`);
    if (ids.has(solute.id)) throw new Error(`Duplicate solute id ${solute.id}.`);
    ids.add(solute.id);
  }
  return dataset;
}
export function soluteContributionMgL(solute,grams,volumeL,ionMolarMasses) {
  record(ionMolarMasses,'ionMolarMasses');
  const {mw,purity}=validateSolute(solute,ionMolarMasses,'solute');
  const moles=nonNegative(grams,'grams')*purity/mw,volume=positive(volumeL,'volumeL'),output={};
  if (solute.cation) output[solute.cation]=moles*solute.catN*ionMolarMasses[solute.cation]*1000/volume;
  if (solute.anion) output[solute.anion]=(output[solute.anion]??0)+moles*solute.anN*ionMolarMasses[solute.anion]*1000/volume;
  for (const value of Object.values(output)) finite(value,'calculated ion concentration');
  return output;
}
export function calculateIonLoads({dosesG={},volumeL,dataset,sourceIonsMgL={}}) {
  validateDataset(dataset); positive(volumeL,'volumeL'); record(dosesG,'dosesG');
  validateIonMap(sourceIonsMgL,'sourceIonsMgL',dataset.ionMolarMasses);
  const soluteMap=new Map(dataset.solutes.map(item=>[item.id,item]));
  const ions=Object.fromEntries(DEFAULT_IONS.map(ion=>[ion,sourceIonsMgL[ion]??0]));
  for (const [id,rawDose] of Object.entries(dosesG)) {
    if (!soluteMap.has(id)) throw new Error(`Unknown solute: ${id}`);
    const dose=nonNegative(rawDose,`dosesG.${id}`);
    for (const [ion,value] of Object.entries(soluteContributionMgL(soluteMap.get(id),dose,volumeL,dataset.ionMolarMasses))) {
      ions[ion]+=value; finite(ions[ion],`calculated ionsMgL.${ion}`);
    }
  }
  const mass=Object.values(ions).reduce((sum,value)=>sum+value,0);finite(mass,'ionicMassSumMgL');
  return {ionsMgL:Object.fromEntries(Object.entries(ions).map(([key,value])=>[key,round(value)])),ionicMassSumMgL:round(mass),sourceIonsIncluded:Object.keys(sourceIonsMgL).length>0,tdsInterpretation:'calculated-ionic-mass-sum-not-conductivity-derived-tds'};
}
export function calculateWaterMetrics({ionsMgL}) {
  validateIonMap(ionsMgL,'ionsMgL');
  const organicAnionsPresent=['Citrate','Lactate','Gluconate'].filter(ion=>(ionsMgL[ion]??0)>0);
  return {
    hardnessMgLAsCaCO3:own(ionsMgL,'Ca')&&own(ionsMgL,'Mg')?round(2.497*ionsMgL.Ca+4.118*ionsMgL.Mg):null,
    calciumHardnessMgLAsCaCO3:own(ionsMgL,'Ca')?round(2.497*ionsMgL.Ca):null,
    magnesiumHardnessMgLAsCaCO3:own(ionsMgL,'Mg')?round(4.118*ionsMgL.Mg):null,
    bicarbonateMgL:own(ionsMgL,'HCO3')?ionsMgL.HCO3:null,
    carbonateMgL:own(ionsMgL,'CO3')?ionsMgL.CO3:null,
    carbonateAlkalinityMgLAsCaCO3:own(ionsMgL,'HCO3')&&own(ionsMgL,'CO3')?round(ionsMgL.HCO3*50.043/61.017+ionsMgL.CO3*100.086/60.008):null,
    organicAnionsPresent,totalAlkalinityMgLAsCaCO3:null,
    totalAlkalinityStatus:organicAnionsPresent.length?'requires-titration-or-acid-base-speciation-with-organic-anions':'carbonate-contribution-only-total-alkalinity-not-predicted',
    pH:null,pHSource:'not-predicted'
  };
}
export function chargeBalance({ionsMgL,ionMolarMasses}) {
  validateIonMap(ionsMgL,'ionsMgL');record(ionMolarMasses,'ionMolarMasses');
  let cations=0,anions=0;
  for (const [ion,charge] of Object.entries(CHARGES)) {
    const mgL=ionsMgL[ion]??0;if (!mgL) continue;
    const meqL=mgL/positive(ionMolarMasses[ion],`ionMolarMasses.${ion}`)*Math.abs(charge);
    if (charge>0) cations+=meqL;else anions+=meqL;
  }
  const denominator=cations+anions,imbalancePct=denominator?200*(cations-anions)/denominator:0;
  return {cationsMeqL:round(cations),anionsMeqL:round(anions),imbalancePct:round(imbalancePct,3),
    imbalanceDefinition:'200*(cations-anions)/(cations+anions); legacy relative-to-mean convention',
    conventionalChargeBalanceErrorPct:round(imbalancePct/2,3),
    status:Math.abs(imbalancePct)<=5?'balanced':Math.abs(imbalancePct)<=10?'review':'invalid-or-incomplete'};
}
export function quantizeDose(grams,scaleResolutionG) {
  const dose=nonNegative(grams,'grams'),resolution=positive(scaleResolutionG,'scaleResolutionG');
  const rounded=Math.round(dose/resolution)*resolution;finite(rounded,'rounded dose');
  return {exactG:dose,recommendedG:round(rounded,12),intervalG:[round(Math.max(0,rounded-resolution/2),12),round(rounded+resolution/2,12)],scaleResolutionG:resolution};
}
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
function objective(matrix,x,target,preferred,regularization) {
  let value=0;
  for (let i=0;i<matrix.length;i+=1) value+=(dot(matrix[i],x)-target[i])**2;
  for (let j=0;j<x.length;j+=1) value+=regularization*(x[j]-preferred[j])**2;
  return value;
}
export function solveFormulation({targetIonsMgL,volumeL,allowedSoluteIds,dataset,scaleResolutionG=0.001,maxIterations=12000,preferredDosesG={},sourceIonsMgL={}}) {
  validateDataset(dataset);positive(volumeL,'volumeL');positive(scaleResolutionG,'scaleResolutionG');
  if (!Number.isInteger(maxIterations)||maxIterations<1||maxIterations>100000) throw new RangeError('maxIterations must be an integer within [1,100000].');
  validateIonMap(targetIonsMgL,'targetIonsMgL',dataset.ionMolarMasses);
  validateIonMap(sourceIonsMgL,'sourceIonsMgL',dataset.ionMolarMasses);record(preferredDosesG,'preferredDosesG');
  const entries=Object.entries(targetIonsMgL);
  if (!entries.length) throw new Error('At least one non-negative target ion is required.');
  if (!Array.isArray(allowedSoluteIds)||!allowedSoluteIds.length||allowedSoluteIds.some(id=>typeof id!=='string')) throw new Error('At least one valid allowed solute id is required.');
  const soluteMap=new Map(dataset.solutes.map(item=>[item.id,item]));
  const solutes=[...new Set(allowedSoluteIds)].map(id=>{if (!soluteMap.has(id)) throw new Error(`Unknown allowed solute: ${id}`);return soluteMap.get(id);});
  const allowed=new Set(solutes.map(solute=>solute.id));
  for (const [id,dose] of Object.entries(preferredDosesG)) {
    if (!allowed.has(id)) throw new Error(`Preferred solute is not allowed: ${id}`);
    nonNegative(dose,`preferredDosesG.${id}`);
  }
  const ions=entries.map(([ion])=>ion),target=entries.map(([,value])=>value),rowScales=target.map(value=>Math.max(5,value));
  const matrix=ions.map(ion=>solutes.map(solute=>soluteContributionMgL(solute,1,volumeL,dataset.ionMolarMasses)[ion]??0));
  const columnScales=solutes.map((_,j)=>{const norm=Math.sqrt(matrix.reduce((sum,row,i)=>sum+(row[j]/rowScales[i])**2,0));return norm>0?1/norm:1;});
  const scaledMatrix=matrix.map((row,i)=>row.map((value,j)=>value*columnScales[j]/rowScales[i]));
  const scaledTarget=target.map((value,i)=>(value-(sourceIonsMgL[ions[i]]??0))/rowScales[i]);
  const preferred=solutes.map((solute,j)=>(preferredDosesG[solute.id]??0)/columnScales[j]),x=[...preferred];
  // Preferences seed the null space; they are not a penalty competing with the
  // requested ions. A large preferred dose must never override a feasible target.
  const regularization=0;
  const estimate=scaledMatrix.map(row=>dot(row,x));
  const curvature=solutes.map((_,j)=>scaledMatrix.reduce((sum,row)=>sum+row[j]**2,0));
  let iterations=0,converged=false,previousObjective=objective(scaledMatrix,x,scaledTarget,preferred,regularization);
  // Exact coordinate minimizers for a non-negative convex quadratic; no guessed gradient step.
  for (;iterations<maxIterations;iterations+=1) {
    let maxChange=0;
    for (let j=0;j<x.length;j+=1) {
      if (curvature[j]===0) continue; // Unconstrained ions retain an explicit dose preference.
      let gradient=regularization*(x[j]-preferred[j]);
      for (let i=0;i<ions.length;i+=1) gradient+=scaledMatrix[i][j]*(estimate[i]-scaledTarget[i]);
      const next=Math.max(0,x[j]-gradient/curvature[j]),change=next-x[j];x[j]=next;
      maxChange=Math.max(maxChange,Math.abs(change));
      for (let i=0;i<ions.length;i+=1) estimate[i]+=scaledMatrix[i][j]*change;
    }
    const nextObjective=objective(scaledMatrix,x,scaledTarget,preferred,regularization);
    if (maxChange<1e-10&&Math.abs(previousObjective-nextObjective)<1e-13) {converged=true;iterations+=1;break;}
    previousObjective=nextObjective;
  }
  const exactDosesG=Object.fromEntries(solutes.map((solute,j)=>[solute.id,x[j]*columnScales[j]]));
  const doseInstructions=Object.fromEntries(Object.entries(exactDosesG).map(([id,dose])=>[id,quantizeDose(dose,scaleResolutionG)]));
  const recommendedDosesG=Object.fromEntries(Object.entries(doseInstructions).map(([id,value])=>[id,value.recommendedG]));
  const exactLoads=calculateIonLoads({dosesG:exactDosesG,volumeL,dataset,sourceIonsMgL});
  const recommendedLoads=calculateIonLoads({dosesG:recommendedDosesG,volumeL,dataset,sourceIonsMgL});
  const residuals=Object.fromEntries(ions.map((ion,i)=>[ion,round(recommendedLoads.ionsMgL[ion]-target[i])]));
  const exactResiduals=Object.fromEntries(ions.map((ion,i)=>[ion,round(exactLoads.ionsMgL[ion]-target[i])]));
  const normalizedRmse=Math.sqrt(ions.reduce((sum,ion,i)=>sum+(residuals[ion]/rowScales[i])**2,0)/ions.length);
  // Numerical target tolerance; not sensory preference or instrument uncertainty.
  const statusFor=loads=>Object.fromEntries(ions.map((ion,i)=>{const tolerance=Math.max(0.05,target[i]*0.01);return [ion,{targetMgL:target[i],actualMgL:loads.ionsMgL[ion],residualMgL:round(loads.ionsMgL[ion]-target[i]),toleranceMgL:tolerance,satisfied:Math.abs(loads.ionsMgL[ion]-target[i])<=tolerance}];}));
  const targetStatus=statusFor(recommendedLoads),exactTargetStatus=statusFor(exactLoads);
  const feasible=Object.values(targetStatus).every(item=>item.satisfied),exactFeasible=Object.values(exactTargetStatus).every(item=>item.satisfied);
  const balance=chargeBalance({ionsMgL:recommendedLoads.ionsMgL,ionMolarMasses:dataset.ionMolarMasses});
  const warnings=[
    'Calculated ionic mass sum is not a conductivity-derived TDS measurement.',
    'No pH, free-ion fractions or precipitation percentage is predicted; acid-base equilibria, complexation, temperature and dissolved CO2 are not specified.',
    'Complete dissolution and no precipitation are arithmetic assumptions, not experimental findings.',
    'Only explicitly requested ions are optimized. Bicarbonate target means actual HCO3; citrate and lactate are not silently substituted for it.'
  ];
  if (!exactFeasible) warnings.unshift('Selected salts and source water cannot closely satisfy all target ions; inspect each residual.');
  else if (!feasible) warnings.unshift('Scale rounding causes a material target deviation; increase batch volume or weighing precision.');
  if (!converged) warnings.unshift('Solver iteration limit reached; convergence is not established.');
  if (entries.some(([ion,value])=>(sourceIonsMgL[ion]??0)>value)) warnings.unshift('Source water already exceeds a target; adding salts cannot remove existing ions.');
  if (balance.status!=='balanced') warnings.unshift('Charge balance is outside ±5%; source-water analysis may be incomplete.');
  return {
    contract:'water-formulation/1.0',targetIonsMgL:{...targetIonsMgL},exactDosesG,doseInstructions,recommendedDosesG,
    exactIonLoads:exactLoads,recommendedIonLoads:recommendedLoads,residualsMgL:residuals,exactResidualsMgL:exactResiduals,
    normalizedRmse:round(normalizedRmse),chargeBalance:balance,iterations,converged,feasible,exactFeasible,targetStatus,
    metrics:calculateWaterMetrics({ionsMgL:recommendedLoads.ionsMgL}),sourceIonsMgL:{...sourceIonsMgL},
    assumptions:{additiveVolume:true,completeDissolution:true,noPrecipitation:true,inputPurityApplied:true},warnings
  };
}
export function formulateBrewingWater(options) { return solveFormulation(options); }
export function evaluateOperationalRisks({ionsMgL,ionicMassSumMgL,chargeBalanceResult}) {
  validateIonMap(ionsMgL,'ionsMgL');nonNegative(ionicMassSumMgL,'ionicMassSumMgL');
  const risks=[],add=(code,severity,message)=>risks.push({code,severity,basis:'operational-screening-not-validated-sensory-threshold',message});
  const bicarbonate=ionsMgL.HCO3??0,carbonate=ionsMgL.CO3??0;
  // Compare acid-neutralizing equivalents in the same HCO3 mass units. This
  // inorganic contribution is not a prediction of pH, titrated total alkalinity
  // with organic anions, sensory outcome, or equipment compatibility.
  const carbonateAsHco3=bicarbonate+carbonate*2*61.017/60.008;
  if (bicarbonate>80) add('high-alkalinity','high','HCO3 exceeds the 80 mg/L operational screening setting; this is not a pH or sensory prediction.');
  else if (carbonateAsHco3>80) add('high-carbonate-alkalinity','high','Combined HCO3 and CO3 inorganic equivalents exceed the 80 mg/L-as-HCO3 operational screening setting; carbonate counts twice per mole. This is not a pH or sensory prediction.');
  if ((ionsMgL.SO4??0)>100) add('high-sulfate','medium','SO4 exceeds the 100 mg/L screening setting; compare in blinded sensory trials.');
  if ((ionsMgL.Cl??0)>80) add('high-chloride','medium','Cl exceeds the 80 mg/L screening setting; check equipment-specific requirements separately.');
  if ((ionsMgL.Na??0)>50) add('high-sodium','medium','Na exceeds the 50 mg/L screening setting; this is not a universal taste threshold.');
  if ((ionsMgL.K??0)>60) add('high-potassium','medium','K exceeds the 60 mg/L screening setting; this is not a universal taste threshold.');
  if (ionicMassSumMgL>180) add('high-ionic-mass','medium','Calculated ionic mass sum exceeds the 180 mg/L screening setting; it is not measured TDS.');
  if (chargeBalanceResult!==undefined) {
    record(chargeBalanceResult,'chargeBalanceResult');
    if (Math.abs(finite(chargeBalanceResult.imbalancePct,'chargeBalanceResult.imbalancePct'))>10) add('charge-imbalance','high','Charge balance exceeds ±10%; inputs may be incomplete or inconsistent.');
  }
  return {level:risks.some(risk=>risk.severity==='high')?'high':risks.length?'review':'normal',scope:'formulation-inputs-only-not-potability-equipment-safety-or-sensory-validation',risks};
}
