import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateIonLoads,calculateWaterMetrics,chargeBalance,formulateBrewingWater,
  quantizeDose,soluteContributionMgL,solveFormulation,validateDataset,evaluateOperationalRisks
} from '../../core/water-engine.mjs';

// Independent chemical formula fixture: hydration water affects salt mass but
// never contributes calcium/magnesium or charge to the ionic mass ledger.
const masses={Ca:40.078,Mg:24.305,Na:22.990,K:39.098,HCO3:61.017,CO3:60.008,Cl:35.45,SO4:96.06,Lactate:89.07,Citrate:189.10,Gluconate:195.17};
const salt=(id,mw,cation,catN,anion,anN,purity=1)=>({id,mw,cation,catN,anion,anN,purity});
const dataset={ionMolarMasses:masses,solutes:[
  salt('cacl2',110.98,'Ca',1,'Cl',2),salt('cacl2_2h2o',147.014,'Ca',1,'Cl',2),
  salt('mgso4',120.37,'Mg',1,'SO4',1),salt('mgso4_7h2o',246.47,'Mg',1,'SO4',1),
  salt('khco3',100.115,'K',1,'HCO3',1),salt('nahco3',84.006,'Na',1,'HCO3',1),
  salt('calac',308.30,'Ca',1,'Lactate',2),salt('mglac',238.44,'Mg',1,'Lactate',2),
  salt('cacit',570.49,'Ca',3,'Citrate',2),salt('mgcit',451.12,'Mg',3,'Citrate',2),
  salt('nacit',294.10,'Na',3,'Citrate',1),salt('kcit',324.41,'K',3,'Citrate',1),
  salt('k2co3',138.205,'K',2,'CO3',1)
]};
const close=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const solve=(targets,allowed,extra={})=>formulateBrewingWater({targetIonsMgL:targets,volumeL:5,allowedSoluteIds:allowed,dataset,scaleResolutionG:0.000001,...extra});

test('one millimole reference salts yield their stoichiometric ions and exclude hydrate water',()=>{
  for (const [id,dose,expected] of [
    ['cacl2',0.11098,{Ca:40.078,Cl:70.9}],
    ['cacl2_2h2o',0.147014,{Ca:40.078,Cl:70.9}],
    ['mgso4',0.12037,{Mg:24.305,SO4:96.06}],
    ['mgso4_7h2o',0.24647,{Mg:24.305,SO4:96.06}],
    ['cacit',0.57049,{Ca:120.234,Citrate:378.2}],
    ['nacit',0.29410,{Na:68.97,Citrate:189.1}]
  ]) {
    const result=calculateIonLoads({dosesG:{[id]:dose},volumeL:1,dataset});
    for (const [ion,value] of Object.entries(expected)) close(result.ionsMgL[ion],value);
    close(chargeBalance({ionsMgL:result.ionsMgL,ionMolarMasses:masses}).imbalancePct,0);
  }
});

test('purity changes effective ions while doubling volume halves every modeled ion',()=>{
  const impure=structuredClone(dataset);impure.solutes.find(s=>s.id==='mgso4_7h2o').purity=0.95;
  const r=calculateIonLoads({dosesG:{mgso4_7h2o:0.24647},volumeL:2,dataset:impure});
  close(r.ionsMgL.Mg,24.305*0.95/2);close(r.ionsMgL.SO4,96.06*0.95/2);
  assert.ok(r.ionicMassSumMgL<0.24647*1000/2,'hydrate water must not be counted as ionic solids');
});

test('historical 11.4 g recipe independently reproduces approximately 64.64 GH at 99% assay',()=>{
  const d=structuredClone(dataset);d.solutes.forEach(s=>s.purity=0.99);
  const r=calculateIonLoads({dosesG:{mgso4:4.2,calac:3,khco3:4.2},volumeL:68.4,dataset:d});
  close(r.ionsMgL.Ca,5.644596,1e-6);close(r.ionsMgL.Mg,12.274555,1e-6);
  close(calculateWaterMetrics({ionsMgL:r.ionsMgL}).hardnessMgLAsCaCO3,64.641173,1e-5);
});

test('missing sodium salt transfers bicarbonate formulation to available potassium salt',()=>{
  const r=solve({HCO3:30},['khco3']);
  close(r.recommendedIonLoads.ionsMgL.HCO3,30,0.0002);
  assert.ok(r.feasible);assert.ok(r.exactFeasible);assert.ok(r.converged);
  assert.ok(r.recommendedDosesG.khco3>0);
});

test('calcium citrate is allocated once and cannot satisfy missing actual bicarbonate',()=>{
  const r=solve({Ca:10,HCO3:30},['cacit','nahco3']);
  close(r.recommendedIonLoads.ionsMgL.Ca,10,0.0002);
  close(r.recommendedIonLoads.ionsMgL.HCO3,30,0.0002);
  assert.ok(r.feasible);
  const impossible=solve({HCO3:30},['nacit']);
  assert.equal(impossible.recommendedIonLoads.ionsMgL.HCO3,0);
  assert.equal(impossible.residualsMgL.HCO3,-30);
  assert.equal(impossible.feasible,false);
  assert.equal(impossible.exactFeasible,false);
  assert.ok(impossible.warnings.some(text=>/cannot closely satisfy/.test(text)));
});

test('salt preferences choose among equivalent formulations without overriding ion targets',()=>{
  // Preferred doses are deliberately already chemically equivalent to target.
  const preferred={cacl2:0.11098,calac:0.30830,mgso4:0.12037,mglac:0.23844,khco3:0.100115,nahco3:0.084006};
  const ions=calculateIonLoads({dosesG:preferred,volumeL:5,dataset}).ionsMgL;
  const r=solve({Ca:ions.Ca,Mg:ions.Mg,HCO3:ions.HCO3},Object.keys(preferred),{preferredDosesG:preferred});
  assert.ok(r.feasible);
  for (const [id,dose]of Object.entries(preferred)) close(r.exactDosesG[id],dose,1e-6);
  // An unreasonable preference must be corrected to respect targets.
  const huge=solve({Ca:10,HCO3:30},['cacit','nahco3'],{preferredDosesG:{cacit:10,nahco3:10}});
  assert.ok(huge.exactFeasible);close(huge.exactIonLoads.ionsMgL.Ca,10,1e-4);close(huge.exactIonLoads.ionsMgL.HCO3,30,1e-4);
});

test('impossible coupled ion targets return residuals even with balanced charge',()=>{
  const r=solve({Ca:10,Cl:0},['cacl2']);
  assert.equal(r.feasible,false);assert.ok(Math.abs(r.residualsMgL.Ca)>1);
  assert.equal(r.chargeBalance.status,'balanced','chemical charge conservation does not prove targets were met');
});

test('post-rounding residuals are recomputed from the dose actually displayed',()=>{
  const r=solve({Mg:0.1},['mgso4_7h2o'],{volumeL:1,scaleResolutionG:0.01});
  assert.equal(r.recommendedDosesG.mgso4_7h2o,0);
  assert.equal(r.recommendedIonLoads.ionsMgL.Mg,0);
  close(r.residualsMgL.Mg,-0.1);assert.equal(r.feasible,false);assert.ok(r.exactFeasible);
  assert.ok(r.warnings.some(text=>/Scale rounding/.test(text)));
});

test('source water is added once and cannot be removed by positive salt doses',()=>{
  const r=solve({Ca:20},['cacl2'],{sourceIonsMgL:{Ca:10,Cl:17.69}});
  close(r.recommendedIonLoads.ionsMgL.Ca,20,0.0002);
  assert.equal(r.recommendedIonLoads.sourceIonsIncluded,true);
  const high=solve({Ca:5},['cacl2'],{sourceIonsMgL:{Ca:10,Cl:17.69}});
  assert.equal(high.exactDosesG.cacl2,0);assert.equal(high.feasible,false);
  close(high.residualsMgL.Ca,5);assert.ok(high.warnings.some(text=>/cannot remove/.test(text)));
});

test('carbonate contribution stays separate from total alkalinity and absent measurements',()=>{
  const r=calculateWaterMetrics({ionsMgL:{Ca:40.078,Mg:24.305,HCO3:61.017,CO3:60.008,Citrate:10}});
  close(r.hardnessMgLAsCaCO3,200.162756,1e-6);
  close(r.carbonateAlkalinityMgLAsCaCO3,150.129);
  assert.deepEqual(r.organicAnionsPresent,['Citrate']);assert.equal(r.totalAlkalinityMgLAsCaCO3,null);assert.equal(r.pH,null);
  const incomplete=calculateWaterMetrics({ionsMgL:{Ca:10}});
  assert.equal(incomplete.hardnessMgLAsCaCO3,null);assert.equal(incomplete.carbonateAlkalinityMgLAsCaCO3,null);
});

test('operational alkalinity screening counts CO3 acid equivalents without duplicate alerts',()=>{
  const screen=(HCO3,CO3)=>evaluateOperationalRisks({ionsMgL:{HCO3,CO3},ionicMassSumMgL:HCO3+CO3});
  // 40 mg/L carbonate is approximately 81.34 mg/L as bicarbonate equivalents,
  // although its HCO3 concentration is zero.
  const carbonate=screen(0,40);
  assert.equal(carbonate.level,'high');
  assert.deepEqual(carbonate.risks.map(r=>r.code),['high-carbonate-alkalinity']);
  assert.match(carbonate.risks[0].message,/not a pH or sensory prediction/);
  // Mixed 40 mg/L HCO3 + 20 mg/L CO3 crosses the same 80-equivalent setting.
  assert.deepEqual(screen(40,20).risks.map(r=>r.code),['high-carbonate-alkalinity']);
  assert.equal(screen(30,20).risks.length,0);
  assert.equal(screen(80,0).risks.length,0);
  // Preserve the old bicarbonate code and publish only one alkalinity warning.
  assert.deepEqual(screen(90,40).risks.map(r=>r.code),['high-alkalinity']);
});

test('strict inputs reject unknown, null, empty, boolean, numeric strings, non-finite and negative',()=>{
  for (const bad of [null,undefined,'',true,false,'10',NaN,Infinity,-1]) {
    assert.throws(()=>solve({Mg:bad},['mgso4']));
    assert.throws(()=>calculateIonLoads({dosesG:{mgso4:bad},volumeL:5,dataset}));
    assert.throws(()=>calculateIonLoads({dosesG:{},volumeL:bad,dataset}));
  }
  assert.throws(()=>solve({Banana:10},['khco3']),/unknown ion/);
  assert.throws(()=>solve({},['khco3']),/At least one/);
  assert.throws(()=>solve({HCO3:30},[]),/At least one/);
  assert.throws(()=>calculateIonLoads({dosesG:{unknown:0},volumeL:1,dataset}),/Unknown solute/);
  assert.throws(()=>calculateIonLoads({dosesG:{},volumeL:0,dataset}),/positive/);
  assert.throws(()=>quantizeDose(1,0),/positive/);
  assert.throws(()=>solve({Mg:1},['mgso4'],{preferredDosesG:{unknown:0}}),/not allowed/);
  assert.throws(()=>solve({Mg:1},['mgso4'],{sourceIonsMgL:{Mg:null}}));
});

test('invalid catalog formula data cannot produce division by zero or fictitious ion mass',()=>{
  for (const change of [s=>s.mw=0,s=>s.mw=null,s=>s.purity=0,s=>s.purity=null,s=>s.catN=0,s=>s.catN=1.5,s=>s.anN=1,s=>s.mw=10]) {
    const d=structuredClone(dataset);change(d.solutes[0]);assert.throws(()=>validateDataset(d));
  }
  const d=structuredClone(dataset);d.ionMolarMasses.Ca=0;assert.throws(()=>validateDataset(d));
  assert.throws(()=>soluteContributionMgL({...dataset.solutes[0],mw:0},1,1,masses));
});

test('zero targets remain zero and iteration limits are explicit',()=>{
  const zero=solve({Ca:0,Mg:0,HCO3:0},['cacl2','mgso4','khco3']);
  assert.ok(zero.feasible);assert.equal(zero.normalizedRmse,0);
  assert.ok(Object.values(zero.recommendedDosesG).every(dose=>dose===0));
  const limited=solve({Ca:20,Cl:10},['cacl2'],{maxIterations:1});
  assert.equal(limited.converged,false);assert.ok(limited.warnings.some(text=>/iteration limit/.test(text)));
  for (const bad of [0,-1,1.5,null,100001]) assert.throws(()=>solve({Ca:1},['cacl2'],{maxIterations:bad}));
});

test('seeded randomized feasible mixtures preserve formula charge, volume scaling and target recovery',()=>{
  let state=92371;const rand=()=>((state=(state*1664525+1013904223)>>>0)/2**32);
  for (let i=0;i<80;i+=1) {
    const volume=0.5+rand()*19.5;
    const doses={cacl2_2h2o:0.01+rand(),mgso4_7h2o:0.01+rand(),khco3:0.01+rand()};
    const result=calculateIonLoads({dosesG:doses,volumeL:volume,dataset});
    close(chargeBalance({ionsMgL:result.ionsMgL,ionMolarMasses:masses}).imbalancePct,0,1e-5);
    const twice=calculateIonLoads({dosesG:doses,volumeL:volume*2,dataset});
    for (const ion of Object.keys(result.ionsMgL)) close(twice.ionsMgL[ion]*2,result.ionsMgL[ion],2e-8);
    const recovered=solve({Ca:result.ionsMgL.Ca,Mg:result.ionsMgL.Mg,HCO3:result.ionsMgL.HCO3},Object.keys(doses),{volumeL:volume});
    assert.ok(recovered.exactFeasible);assert.ok(recovered.converged);
    for (const [id,dose]of Object.entries(doses)) close(recovered.exactDosesG[id],dose,1e-7);
  }
});
