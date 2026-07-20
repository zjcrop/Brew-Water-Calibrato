#!/usr/bin/env python3
'''
萃离 Brew-Water-Calibrato v2.5 -> v2.6.1 组合增量补丁

基线：
- Repository: zjcrop/Brew-Water-Calibrato
- Branch: main
- Baseline commit: 845a32d2b39b1c2e330d7247de5ac35af1f87582
- Baseline index.html Git blob SHA: e3cde992deed76cd5b7d9d496cfa32424cecc4fd
'''

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import sys

PATCH_MARKER = "CUI_LI_V261_PATCH"
BASELINE_COMMIT = "845a32d2b39b1c2e330d7247de5ac35af1f87582"
BASELINE_INDEX_BLOB = "e3cde992deed76cd5b7d9d496cfa32424cecc4fd"

CSS_PATCH = r'''
.operation-range{
  margin-top:5px;
  color:#dce5f2;
  font-size:12px;
  line-height:1.45;
  font-weight:800;
}
.precision-note{
  margin-top:4px;
  color:#6f7886;
  font-size:10px;
  line-height:1.45;
  font-weight:500;
}
.precision-callout{
  margin-top:10px;
  padding:9px 11px;
  border-radius:13px;
  background:#0b121b;
  border:1px dashed #344055;
  color:#c6ced9;
  font-size:12px;
  line-height:1.65;
}
'''

JS_PATCH = r'''
/* CUI_LI_V261_PATCH
 * 基线：Brew-Water-Calibrato 2.5
 * 校准：TDS操作误差、5L称量范围、全预设干涩防护
 */
const CUILI_V261_PROFILE_AUDIT={
  geisha:{
    tds:[70,100],t:{ca:6.0,mg:7.5,hco3:22,na:.560},
    g:{ca:[4.5,9.0],mg:[6.5,9.5],hco3:[18,28]},
    bias:{cacl2:.75,calac:1.25,mgso4:.35,mglac:1.65},
    audit:'高花香端降低MgSO₄驱动，提高最低缓冲；在等碱度下将K/Na缓冲分配调整至约45/55，避免高自由Mg、低碱度与偏钾结构叠加。'
  },
  ethiopia:{
    tds:[75,105],t:{ca:7.5,mg:8.5,hco3:24,na:.564},
    g:{ca:[5.5,10.0],mg:[7.0,10.5],hco3:[20,30]},
    bias:{cacl2:.78,calac:1.22,mgso4:.42,mglac:1.58},
    audit:'保留茉莉与柑橘清晰度，同时限制硫酸根和最低碱度下穿；等碱度下将K/Na调整至约44/56。'
  },
  kenya:{
    tds:[80,115],t:{ca:7.5,mg:10.0,hco3:22,na:.554},
    g:{ca:[5.5,10.5],mg:[8.5,12.0],hco3:[18,30]},
    bias:{cacl2:.82,calac:1.18,mgso4:.55,mglac:1.45},
    audit:'保留黑加仑与磷酸触感，但不再以极高Mg和极低缓冲实现明亮度；等碱度下将K/Na调整至约45/55。'
  },
  sweet:{
    tds:[85,115],t:{ca:9.5,mg:9.5,hco3:27,na:.577},
    g:{ca:[7.0,13.0],mg:[7.5,11.5],hco3:[22,36]},
    bias:{cacl2:.85,calac:1.15,mgso4:.65,mglac:1.35},
    audit:'以中等硬度和缓冲维持甜感，降低MgSO₄对尾段干燥感的贡献；K/Na约42/58。'
  },
  washed:{
    tds:[90,120],t:{ca:10.0,mg:9.0,hco3:29,na:.594},
    g:{ca:[8.0,14.0],mg:[7.0,11.0],hco3:[24,38]},
    bias:{cacl2:.90,calac:1.10,mgso4:.75,mglac:1.25},
    audit:'平衡水洗型维持中等Ca/Mg，不用额外高Mg追求清晰度；K/Na约40/60。'
  },
  honey:{
    tds:[92,125],t:{ca:11.0,mg:9.0,hco3:32,na:.608},
    g:{ca:[8.5,15.0],mg:[7.0,11.0],hco3:[26,40]},
    bias:{cacl2:.92,calac:1.08,mgso4:.80,mglac:1.20},
    audit:'甜圆结构主要由Ca和适度缓冲承担，避免用高镁制造虚假强度；K/Na约38/62。'
  },
  natural:{
    tds:[95,130],t:{ca:12.0,mg:9.0,hco3:34,na:.615},
    g:{ca:[9.0,16.0],mg:[7.0,11.5],hco3:[28,42]},
    bias:{cacl2:.92,calac:1.08,mgso4:.80,mglac:1.20},
    audit:'发酵型提高缓冲但压低镁上限，防止发酵涩感与硫酸根干燥感叠加；K/Na约37/63。'
  },
  wethulled:{
    tds:[95,130],t:{ca:13.5,mg:7.5,hco3:34,na:.626},
    g:{ca:[10.0,17.0],mg:[5.5,9.5],hco3:[28,42]},
    bias:{cacl2:.95,calac:1.05,mgso4:.75,mglac:1.25},
    audit:'以Ca支撑醇厚，控制Mg和硫酸根，避免木质香料调变成粗糙干口；K/Na约35/65。'
  },
  dark:{
    tds:[85,115],t:{ca:11.5,mg:6.5,hco3:31,na:.641},
    g:{ca:[9.0,16.0],mg:[5.0,8.5],hco3:[26,40]},
    bias:{cacl2:.90,calac:1.10,mgso4:.65,mglac:1.35},
    audit:'深烘降低Mg上限，以Ca和适度缓冲控制焦苦；等碱度下K/Na约32/68，钠仍低于10mg/L。'
  },
  custom:{
    tds:[85,120],t:{ca:9.0,mg:9.0,hco3:28,na:.604},
    g:{ca:[5.0,16.0],mg:[6.0,13.0],hco3:[18,42]},
    bias:{cacl2:.85,calac:1.15,mgso4:.70,mglac:1.30},
    audit:'保留研究自由度，但设置Mg、碱度、盐型权重及K/Na 40/60附近的工程边界。'
  }
};

Object.entries(CUILI_V261_PROFILE_AUDIT).forEach(([id,a])=>{
  const p=PROFILE[id];
  if(!p)return;
  p.tds=[...a.tds];
  p.t={...a.t};
  p.g={ca:[...a.g.ca],mg:[...a.g.mg],hco3:[...a.g.hco3]};
  p.bias={...a.bias};
  p.audit=a.audit;
  if(!p.note.includes('v2.6.1审核'))p.note+=` v2.6.1审核：${a.audit}`;
});

targetIons=function(){
  const p=PROFILE[selectedBean];
  const f=+$('floral').value/100;
  const s=+$('sweet').value/100;
  const a=+$('acid').value/100;
  const bt=+$('bitter').value/100;
  const keep=1-a;
  const neut=budget().left/200;
  const g=p.g||{ca:[4,18],mg:[5,18],hco3:[10,48]};

  const caRaw=p.t.ca+2.2*s+1.8*a+1.2*bt-1.5*f-.5*keep+.5*neut;
  const mgRaw=p.t.mg+1.8*f+1.2*keep-1.8*bt-1.0*a-.8*s+.3*neut;
  const hco3Raw=p.t.hco3+5*a+3*bt+2*s-2.5*f-1.2*keep+.5*neut;

  const ca=clamp(caRaw,g.ca[0],g.ca[1]);
  const mg=clamp(mgRaw,g.mg[0],g.mg[1]);
  const hco3=clamp(hco3Raw,g.hco3[0],g.hco3[1]);
  const naShare=clamp(p.t.na+.05*bt+.025*a-.025*f,.45,.70);
  return {ca,mg,hco3,naShare};
};

allocateCationMgL=function(targetMgL,ion,groupName){
  const mats=MAT.filter(m=>selected[m.id]&&m.group===groupName&&m.cation===ion);
  const out={};
  if(!mats.length)return out;
  const totalMoles5L=targetMgL*5/(IONM[ion]*1000);
  const bias=(PROFILE[selectedBean]&&PROFILE[selectedBean].bias)||{};
  const weight=m=>calcWeight(m)*(bias[m.id]||1);
  const sumW=mats.reduce((s,m)=>s+weight(m),0);
  mats.forEach(m=>{
    const share=weight(m)/sumW;
    const saltMoles=totalMoles5L*share/m.catN;
    out[m.id]=saltMoles*m.mw/m.purity;
  });
  return out;
};

const cuiliEvaluateV25=evaluate;
evaluate=function(loads,bf,silica){
  const ev=cuiliEvaluateV25(loads,bf,silica);
  const sulfateFactor=clamp(loads.SO4/50,0,2);
  const magnesiumFactor=clamp(loads.Mg/14,0,1.8);
  const freeFactor=clamp(bf.freeRate,0,1);
  const lowAlkFactor=clamp((24-ev.alk)/16,0,1.5);
  const astringency=clamp(
    sulfateFactor*3.2+
    magnesiumFactor*1.9+
    freeFactor*1.4+
    lowAlkFactor*1.4,
    0,10
  );
  ev.sulfateRaw=ev.sulfate;
  ev.astringency=astringency;
  ev.sulfate=astringency;
  return ev;
};

function cuiliV26Guidance(c){
  const tdsExact=Math.max(0,c.tdsObj.effective||0);
  const tdsDisplay=Math.round(tdsExact/5)*5;
  const modelExtra=(c.bf.precipRate>.08?2:1)+(c.ev.astringency>5.2?1:0);
  const tdsTolerance=clamp(Math.round(tdsExact*.055)+modelExtra,5,9);
  const tdsLow=Math.max(0,tdsDisplay-tdsTolerance);
  const tdsHigh=tdsDisplay+tdsTolerance;
  const doseExact=Math.max(0,c.total||0);
  const relative=Math.min(.12,tdsTolerance/Math.max(tdsExact,50));
  const doseTolerance=Math.max(.02,doseExact*(relative+.012));
  const doseLow=Math.max(0,Math.floor((doseExact-doseTolerance)*100)/100);
  const doseHigh=Math.ceil((doseExact+doseTolerance)*100)/100;
  const doseRecommended=Math.round(doseExact*100)/100;
  return {
    tdsExact,tdsDisplay,tdsTolerance,tdsLow,tdsHigh,
    doseExact,doseTolerance,doseLow,doseHigh,doseRecommended
  };
}

tdsAssessment=function(tds,tolerance){
  const range=PROFILE[selectedBean].tds||[85,120];
  const low=range[0],high=range[1];
  const tol=Number.isFinite(tolerance)?tolerance:clamp(Math.round(tds*.055)+1,5,9);
  const lower=tds-tol,upper=tds+tol;
  if(upper<low)return {
    cls:'tds-low',label:'低于目标',
    text:`当前操作控制带 ${Math.max(0,Math.round(lower))}–${Math.round(upper)} ppm 低于 ${PROFILE[selectedBean].name} 的建议区间 ${low}–${high} ppm，水体缓冲和结构支撑可能不足。`
  };
  if(lower<=high&&upper>=low)return {
    cls:'tds-ok',label:'与目标重叠',
    text:`当前操作控制带 ${Math.max(0,Math.round(lower))}–${Math.round(upper)} ppm 与 ${PROFILE[selectedBean].name} 的建议区间 ${low}–${high} ppm 重叠。`
  };
  if(lower<=high+30)return {
    cls:'tds-mid',label:'偏高，需谨慎',
    text:`当前操作控制带 ${Math.round(lower)}–${Math.round(upper)} ppm 高于建议区间 ${low}–${high} ppm，可能增强结构，也可能压香、钝化或增加矿物感。`
  };
  return {
    cls:'tds-high',label:'明显偏高',
    text:`当前操作控制带 ${Math.round(lower)}–${Math.round(upper)} ppm 明显高于建议区间 ${low}–${high} ppm，应降低总盐量、碱度、Ca/Mg或高负载盐。`
  };
};

const cuiliGetComputedV25=getComputed;
getComputed=function(){
  const c=cuiliGetComputedV25();
  c.guidance=cuiliV26Guidance(c);
  c.tdsEval=tdsAssessment(c.tdsObj.effective,c.guidance.tdsTolerance);
  const monoMass=(c.loads.Na||0)+(c.loads.K||0);
  const monoEq=(c.mols.Na||0)+(c.mols.K||0);
  c.bufferBalance={
    naEqShare:monoEq?(c.mols.Na||0)/monoEq:0,
    kEqShare:monoEq?(c.mols.K||0)/monoEq:0,
    naMassShare:monoMass?(c.loads.Na||0)/monoMass:0,
    kMassShare:monoMass?(c.loads.K||0)/monoMass:0,
    naMgL:c.loads.Na||0,
    kMgL:c.loads.K||0
  };
  lastComputed=c;
  return c;
};

(function cuiliInstallV26UI(){
  document.title=document.title.replace('2.5版','2.6.1版');
})();

const cuiliRenderRiskPageV25=renderRiskPage;
renderRiskPage=function(){
  cuiliRenderRiskPageV25();
  const c=lastComputed;
  if(!c)return;
  document.querySelectorAll('#riskChips .risk-chip').forEach(el=>{
    if(el.textContent.includes('硫酸根干涩')){
      el.textContent=el.textContent.replace('硫酸根干涩','干涩/收敛');
    }
  });
  const riskItems=$('riskItems');
  if(riskItems&&!document.getElementById('riskAstringencyV26')){
    const box=document.createElement('div');
    box.id='riskAstringencyV26';
    box.className='risk-item';
    box.innerHTML=`<h4>干涩 / 收敛综合风险</h4><p>评分 ${fmt(c.ev.astringency,1)}/10。该指标综合 SO₄²⁻、Mg²⁺、二价离子空载率及低碱度，不把“镁高”等同于“花香高”。无机盐花香方案若仍出现干口，优先降低 MgSO₄ 或改用半有机盐体系，而不是继续提高总TDS。</p>`;
    const nodes=[...riskItems.children];
    const tdsNode=nodes.find(n=>n.textContent.includes('TDS与整体强度'));
    riskItems.insertBefore(box,tdsNode||null);
  }
  const b=c.bufferBalance||{naEqShare:0,kEqShare:0,naMassShare:0,kMassShare:0,naMgL:0,kMgL:0};
  if(riskItems&&!document.getElementById('riskBufferBalanceV261')){
    const balance=document.createElement('div');
    balance.id='riskBufferBalanceV261';
    balance.className='risk-item';
    const balanceLabel=b.kEqShare>.55?'缓冲当量仍偏钾':(b.naEqShare>.70?'缓冲当量偏钠':'缓冲当量平衡');
    balance.innerHTML=`<h4>K/Na缓冲分配</h4><p>${balanceLabel}。Na缓冲当量占比约 ${fmt(b.naEqShare*100,0)}%；实际K⁺约 ${fmt(b.kMgL,1)}mg/L、Na⁺约 ${fmt(b.naMgL,1)}mg/L，按质量计Na占Na+K约 ${fmt(b.naMassShare*100,0)}%。默认预设采用等碱度替换，HCO₃⁻总量不因降低钾而下降。若手动取消NaHCO₃或选择K₂CO₃/KCl，实际比例可能重新偏钾。</p>`;
    const nodes=[...riskItems.children];
    const tdsNode=nodes.find(n=>n.textContent.includes('TDS与整体强度'));
    riskItems.insertBefore(balance,tdsNode||null);
  }
};

const cuiliUpdateAllV25=updateAll;
updateAll=function(){
  cuiliUpdateAllV25();
  const c=lastComputed;
  if(!c)return;
  const g=c.guidance||cuiliV26Guidance(c);

  v2SetText('v2MainName',PROFILE[selectedBean].name+'｜配方2.6.1审核版');
  const balance=c.bufferBalance||{naEqShare:0,kEqShare:0,naMassShare:0,kMassShare:0,naMgL:0,kMgL:0};
  v2SetText('v2NaShare',fmt(balance.naMassShare*100,0)+'%');
  v2SetText('dose5L',fmt(g.doseRecommended,2)+'g');
  v2SetText('dose5LRange',`允许称量范围 ${fmt(g.doseLow,2)}–${fmt(g.doseHigh,2)}g / 5L`);
  v2SetText('dose5LExact',`备注：模型精确值 ${fmt(g.doseExact,3)}g / 5L`);

  v2SetText('tdsEffective',`${g.tdsDisplay} ± ${g.tdsTolerance}ppm`);
  v2SetText('tdsOperationalRange',`操作控制带 ${g.tdsLow}–${g.tdsHigh}ppm`);
  v2SetText('tdsExactNote',`备注：模型精确值 ${fmt(g.tdsExact,1)}ppm；非实验室测量不确定度`);
  v2SetText('tdsTargetRange',`${PROFILE[selectedBean].tds[0]}–${PROFILE[selectedBean].tds[1]}ppm；操作±${g.tdsTolerance}`);

  $('tdsBadge').className='tds-state '+c.tdsEval.cls;
  $('tdsBadge').textContent=c.tdsEval.label;
  const audit=PROFILE[selectedBean].audit||'已执行离子与涩感边界审核。';
  $('tdsText').innerHTML=
    `<div class="precision-callout"><strong>日常操作：</strong>以 ${g.tdsDisplay} ± ${g.tdsTolerance} ppm 和 ${fmt(g.doseLow,2)}–${fmt(g.doseHigh,2)} g / 5L 为控制目标。显示范围用于降低称量和TDS笔换算难度；小字精确值仅供复核，不代表现实操作具有同等精度。<br><strong>K/Na缓冲：</strong>Na缓冲当量占比约 ${fmt(balance.naEqShare*100,0)}%；K⁺约 ${fmt(balance.kMgL,1)}mg/L，Na⁺约 ${fmt(balance.naMgL,1)}mg/L，按质量计Na占Na+K约 ${fmt(balance.naMassShare*100,0)}%。本调整保持HCO₃⁻总量不变。<br><strong>预设审核：</strong>${audit}</div>`+
    `<div style="margin-top:9px">${c.tdsEval.text}</div>`+
    `<span class="helper">质量折算TDS模型值约 ${fmt(c.tdsObj.theoretical,1)} mg/L；电导等效模型值约 ${fmt(c.tdsObj.effective,1)} ppm。TDS笔读数受仪表换算系数、温度补偿、离子组成、络合、沉淀及原料含水状态影响。</span>`;

  document.querySelectorAll('#v2ReactionTags .v2-tag').forEach(el=>{
    if(el.textContent.includes('硫酸根干涩')){
      el.textContent=el.textContent.replace('硫酸根干涩','干涩 / 收敛综合');
    }
  });
  if($('riskExplain')){
    $('riskExplain').innerHTML=$('riskExplain').innerHTML.replace('硫酸根干涩','干涩/收敛综合');
  }
};

const cuiliOptimizeRecipeV25=optimizeRecipe;
optimizeRecipe=function(){
  const before=lastComputed&&lastComputed.ev?lastComputed.ev.astringency:0;
  cuiliOptimizeRecipeV25();
  if(before>=5.2){
    const changes=[];
    if(lastBase&&lastBase.mgso4){
      tweak.mgso4=clamp(tweak.mgso4-4,-30,30);
      changes.push('MgSO₄额外-4%');
    }
    if(lastBase&&lastBase.mglac){
      tweak.mglac=clamp(tweak.mglac+3,-30,30);
      changes.push('乳酸镁额外+3%');
    }
    if(changes.length){
      optimizationMessage+=(optimizationMessage?'；':'')+'v2.6.1干涩防护：'+changes.join('、');
      updateAll();
      goPage('plan');
    }
  }
};

const cuiliOpenModalV25=openModal;
openModal=function(type){
  cuiliOpenModalV25(type);
  if(type==='tds'){
    $('modalTitle').textContent='TDS、允许误差与称量范围';
    $('modalBody').innerHTML=`
      <p><strong>主显示值</strong>按 5 ppm 步进取整；其后的 ±5～9 ppm 是日常操作控制带，用来覆盖TDS笔换算、温度补偿、离子组成和配方模型的实际偏差。</p>
      <p><strong>该范围不是实验室测量不确定度。</strong>精确到0.1 ppm的模型值仅作为备注，不应被当作实际配水必须达到的小数目标。</p>
      <p><strong>每5 L粉剂</strong>按0.01 g给出推荐值和允许称量范围；0.001 g模型值缩小显示，仅用于校核配方比例。吸湿性盐、水合状态、纯度和储存条件仍可能造成系统误差。</p>
      <p><strong>K/Na再平衡</strong>采用等碱度替换：减少KHCO₃的缓冲占比、等当量增加NaHCO₃，不降低HCO₃⁻目标。默认K⁺约6–9mg/L、Na⁺约4–9mg/L，不把钾或钠单独当作花香增强剂。</p>
      <ul>
        <li>先按粉剂允许范围称量并完全溶解。</li>
        <li>静置至温度稳定后再测TDS。</li>
        <li>实测落在操作控制带内即可，不追逐小数。</li>
        <li>若连续多批偏离同一方向，应校准TDS笔并核对盐的水合物状态与纯度。</li>
      </ul>`;
  }
};
'''

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"无法定位补丁锚点：{label}")
    return text.replace(old, new, 1)

def patch_index(path: Path, backup: bool) -> bool:
    text = path.read_text(encoding="utf-8")
    if PATCH_MARKER in text:
        print(f"[skip] {path} 已包含 v2.6.1 补丁")
        return False

    required = [
        "<title>萃离｜咖啡冲煮调水 配方2.5版</title>",
        'id="dose5L"',
        'id="tdsEffective"',
        "const PROFILE={",
        "function targetIons(){",
        "function effectiveTdsEstimate",
        "function updateAll(){",
        "init();\n</script>",
    ]
    missing = [m for m in required if m not in text]
    if missing:
        raise RuntimeError(
            "目标 index.html 不是已审核的 Brew-Water-Calibrato 2.5 基线，"
            f"缺少锚点：{missing}"
        )

    if backup:
        shutil.copy2(path, path.with_suffix(path.suffix + ".v2.5.bak"))

    text = replace_once(
        text,
        "<title>萃离｜咖啡冲煮调水 配方2.5版</title>",
        "<title>萃离｜咖啡冲煮调水 配方2.6.1版</title>",
        "页面标题",
    )
    text = text.replace(
        '<span class="about-badge">版本 2.5</span>',
        '<span class="about-badge">版本 2.6.1</span>',
        1,
    )
    text = text.replace(
        '<span class="about-badge">Capacitor Android 图标与导航修订版</span>',
        '<span class="about-badge">TDS误差、称量范围、涩感及K/Na再平衡版</span>',
        1,
    )

    css_anchor = ".helper{color:#99a2af;font-size:12px;line-height:1.6}"
    text = replace_once(
        text, css_anchor, css_anchor + "\n" + CSS_PATCH.strip(), "精度显示CSS"
    )

    old_dose = '<div class="v2-stat"><small>每5L添加</small><div id="dose5L" class="v2-big">0.000g</div><div class="v2-sub">整袋或对应剂量加入5L RO水</div></div>'
    new_dose = '<div class="v2-stat"><small>每5L添加</small><div id="dose5L" class="v2-big">0.00g</div><div id="dose5LRange" class="operation-range">允许称量范围 0.00–0.00g / 5L</div><div id="dose5LExact" class="precision-note">备注：模型精确值 0.000g / 5L</div></div>'
    text = replace_once(text, old_dose, new_dose, "每5L粉剂卡片")

    old_tds = '<div class="v2-stat"><small>电导等效TDS</small><div id="tdsEffective" class="v2-big">0mg/L</div><span id="tdsBadge" class="tds-state tds-ok">合理</span></div>'
    new_tds = '<div class="v2-stat"><small>电导等效TDS</small><div id="tdsEffective" class="v2-big">0 ± 0ppm</div><div id="tdsOperationalRange" class="operation-range">操作控制带 0–0ppm</div><div id="tdsExactNote" class="precision-note">备注：模型精确值 0.0ppm</div><span id="tdsBadge" class="tds-state tds-ok">合理</span></div>'
    text = replace_once(text, old_tds, new_tds, "TDS主卡片")

    text = replace_once(
        text,
        "init();\n</script>",
        JS_PATCH.strip() + "\n\ninit();\n</script>",
        "v2.6.1 JavaScript覆盖层",
    )

    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"[ok] 已更新 {path}")
    return True

def patch_package_json(path: Path, backup: bool) -> bool:
    if not path.exists():
        return False
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("version") == "2.6.1":
        return False
    if backup:
        shutil.copy2(path, path.with_suffix(path.suffix + ".v2.5.bak"))
    data["version"] = "2.6.1"
    data["description"] = "萃离｜咖啡冲煮调水 Android wrapper v2.6.1"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[ok] 已更新 {path}")
    return True

def patch_readme(path: Path, backup: bool) -> bool:
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8")
    new = text.replace("- 版本：2.3", "- 版本：2.6.1", 1)
    if new == text:
        return False
    if backup:
        shutil.copy2(path, path.with_suffix(path.suffix + ".v2.5.bak"))
    path.write_text(new, encoding="utf-8", newline="\n")
    print(f"[ok] 已更新 {path}")
    return True

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="仓库根目录")
    parser.add_argument("--in-place", action="store_true", help="确认原地修改")
    parser.add_argument("--backup", action="store_true", help="保留 .v2.5.bak 备份")
    parser.add_argument("--check", action="store_true", help="仅检查基线是否可应用")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    index_path = root / "index.html"
    if not index_path.exists():
        print(f"[error] 未找到 {index_path}", file=sys.stderr)
        return 2

    text = index_path.read_text(encoding="utf-8")
    if args.check:
        ok = (
            PATCH_MARKER in text
            or (
                "配方2.5版" in text
                and "const PROFILE={" in text
                and "function targetIons(){" in text
                and 'id="dose5L"' in text
            )
        )
        print(
            json.dumps(
                {
                    "applicable": ok,
                    "already_patched": PATCH_MARKER in text,
                    "baseline_commit": BASELINE_COMMIT,
                    "baseline_index_blob": BASELINE_INDEX_BLOB,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0 if ok else 3

    if not args.in_place:
        print("[error] 未指定 --in-place；为避免误改，脚本未执行。", file=sys.stderr)
        return 4

    changed = False
    changed |= patch_index(index_path, args.backup)
    changed |= patch_package_json(root / "package.json", args.backup)
    changed |= patch_readme(root / "README.md", args.backup)

    marker = root / "PATCH_APPLIED_v2.6.1.txt"
    marker.write_text(
        "Brew-Water-Calibrato v2.6.1 combined incremental patch applied.\n"
        f"Baseline commit: {BASELINE_COMMIT}\n"
        f"Baseline index blob: {BASELINE_INDEX_BLOB}\n",
        encoding="utf-8",
    )
    print("[done] v2.6.1 组合补丁已应用" if changed else "[done] 无需重复修改")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
