// Handling ranks are practical workflow groups, not measured hygroscopic rates.
// Always use the current batch's packaging/SDS/COA if it differs from this guide.
export const SALT_HANDLING_SOURCES = Object.freeze({
  calciumChloride: Object.freeze({ title:'USDA 2024：氯化钙技术报告', url:'https://www.ams.usda.gov/sites/default/files/media/2024TechnicalReportCalciumChlorideHandling.pdf' }),
  chlorides: Object.freeze({ title:'EFSA：氯化钙与氯化镁性质评估', url:'https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2019.5751' }),
  magnesiumSulfate: Object.freeze({ title:'Scharlab：无水硫酸镁技术资料', url:'https://www.scharlabchina.com/documents/TDS/MA0080_TDS_EN.pdf' }),
  magnesiumSulfateHydrate: Object.freeze({ title:'Thermo Fisher：七水硫酸镁SDS', url:'https://assets.thermofisher.com/DirectWebViewer/private/document.aspx?prd=ALFAA11596~~PDF~~MTR~~CGV4~~EN~~2025-09-13+20%3A36%3A45~~Magnesium+sulfate+heptahydrate~~' }),
  potassiumBicarbonate: Object.freeze({ title:'OIV：碳酸氢钾性质', url:'https://www.oiv.int/index.php/de/node/3866' }),
  sodiumBicarbonate: Object.freeze({ title:'Thermo Fisher：碳酸氢钠SDS', url:'https://assets.thermofisher.com/DirectWebViewer/private/document.aspx?prd=ACR44710~~PDF~~MTR~~CLP1~~EE~~2023-10-07+10%3A38%3A36~~Sodium+bicarbonate~~' }),
  calciumLactate: Object.freeze({ title:'Kishida：乳酸钙五水合物SDS', url:'https://www.kishida.co.jp/product/catalog/msds/id/2434/code/010-13635e.pdf' })
});

const GUIDE = Object.freeze({
  cacl2: { rank:40, moisture:'高吸湿/潮解', note:'临用再开瓶，后称后加，称后立即封口。吸湿后的质量不再等于标称有效盐质量。', refs:['calciumChloride','chlorides'] },
  cacl2_2h2o: { rank:40, moisture:'吸湿/潮解', note:'水合物仍需防潮；与无水盐分别核算，后称快封。', refs:['chlorides'] },
  mgcl2: { rank:40, moisture:'高吸湿/潮解', note:'六水氯化镁也可潮解；后称后加，及时盖好原料与称量容器。', refs:['chlorides'] },
  mgso4: { rank:30, moisture:'吸湿，后称快封', note:'无水硫酸镁需缩短暴露；不能把吸入的水分按有效盐称入。', refs:['magnesiumSulfate'] },
  mgso4_7h2o: { rank:20, moisture:'防潮并核对结晶水', note:'已含结晶水不等于不吸湿；按包装核对水合状态并密封。', refs:['magnesiumSulfateHydrate'] },
  calac: { rank:25, moisture:'吸湿/风化，核对包装', note:'乳酸钙五水合物有吸湿与风化资料，称后盖好；不作为绝对稳定载体。', refs:['calciumLactate'] },
  khco3: { rank:10, moisture:'防潮，相对先称', note:'略吸湿，仍需干燥密封；相对先称是操作建议，不代表不吸湿。', refs:['potassiumBicarbonate'] },
  nahco3: { rank:10, moisture:'防潮，相对先称', note:'仍需避潮；在明显潮解盐前称好，称后盖好容器。', refs:['sodiumBicarbonate'] },
  nacl: { rank:10, moisture:'常规防潮，按包装复核', note:'作为常规防潮组排在明显吸湿盐前；不是对该批次吸湿速度的测定。', refs:[] },
  kcl: { rank:10, moisture:'常规防潮，按包装复核', note:'作为常规防潮组排在明显吸湿盐前；不是对该批次吸湿速度的测定。', refs:[] }
});

export const WEIGHING_ORDER_NOTES = Object.freeze([
  '先按防潮处理组排序，同组按实际称量质量从大到小；明显吸湿/潮解盐后称后加、称后快封。分组是操作建议，不是实测吸湿速率排名。',
  '未测松装密度时，不从克数或晶体真密度推算粉末体积。未知吸湿性以当前包装、COA和SDS为准。',
  '称量顺序与混合顺序不同：可分别称量并盖好，再对少量组分采用几何递增混合。'
]);

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
}

export function handlingMetadataFor(id, solute = {}) {
  const guide = GUIDE[id] ?? { rank:20, moisture:'按COA/包装复核', note:'未取得适用于该批次的可比较吸湿资料，按COA、SDS及实际粉体状态安排。', refs:[] };
  const rank = solute.handlingOrder ?? guide.rank;
  if (typeof rank !== 'number' || !Number.isFinite(rank) || rank < 0) throw new TypeError(`${id}.handlingOrder must be a non-negative finite number.`);
  const overrides = Array.isArray(solute.sourceUrls) ? solute.sourceUrls : [];
  const sources = [...guide.refs.map(ref => ({ ...SALT_HANDLING_SOURCES[ref] }))];
  for (const url of overrides) {
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) throw new TypeError(`${id}.sourceUrls must contain http(s) URLs.`);
    if (!sources.some(source => source.url === url)) sources.push({ title:'原料处理资料', url });
  }
  return {
    handlingOrder:rank,
    moistureClass:typeof solute.moistureClass === 'string' && solute.moistureClass.trim() ? solute.moistureClass : guide.moisture,
    note:typeof solute.handlingNote === 'string' && solute.handlingNote.trim() ? solute.handlingNote : guide.note,
    sources,
    evidence:guide.refs.length ? 'documented-handling-property-not-quantified-rate' : 'workflow-group-or-batch-property-unverified'
  };
}

export function buildWeighingOrder({ dosesG, solutes } = {}) {
  record(dosesG, 'dosesG');
  if (!Array.isArray(solutes)) throw new TypeError('solutes must be an array.');
  const map = new Map();
  for (const solute of solutes) {
    record(solute, 'solute');
    if (typeof solute.id !== 'string' || !solute.id || map.has(solute.id)) throw new Error('Solute ids must be unique non-empty strings.');
    map.set(solute.id, solute);
  }
  const steps = [];
  for (const [id, grams] of Object.entries(dosesG)) {
    if (typeof grams !== 'number' || !Number.isFinite(grams) || grams < 0) throw new TypeError(`dosesG.${id} must be a non-negative finite number.`);
    if (grams === 0) continue;
    const solute = map.get(id);
    if (!solute) throw new Error(`Unknown solute in weighing order: ${id}`);
    steps.push({ id, name:typeof solute.name === 'string' ? solute.name : id, grams, ...handlingMetadataFor(id, solute) });
  }
  steps.sort((a,b) => a.handlingOrder - b.handlingOrder || b.grams - a.grams || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    steps:steps.map((step,index) => ({ order:index + 1, ...step })),
    notes:[...WEIGHING_ORDER_NOTES],
    ordering:'handling-then-descending-dose',
    volumeBasis:'not-estimated-without-batch-bulk-density'
  };
}
