const DEFAULT_IONS = ['Ca','Mg','Na','K','HCO3','CO3','Cl','SO4','Lactate','Citrate','Gluconate','Silica'];

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite.`);
  return number;
}
function nonNegative(value, label) {
  const number = finite(value, label);
  if (number < 0) throw new RangeError(`${label} must be non-negative.`);
  return number;
}

export function validateDataset(dataset) {
  if (!dataset || typeof dataset !== 'object') throw new TypeError('Dataset must be an object.');
  if (!Array.isArray(dataset.solutes) || !dataset.solutes.length) throw new Error('Dataset requires solutes.');
  if (!dataset.ionMolarMasses || typeof dataset.ionMolarMasses !== 'object') throw new Error('Dataset requires ionMolarMasses.');
  const ids = new Set();
  for (const [index, solute] of dataset.solutes.entries()) {
    if (!solute.id || ids.has(solute.id)) throw new Error(`Invalid or duplicate solute id at ${index}.`);
    ids.add(solute.id);
    nonNegative(solute.mw, `${solute.id}.mw`);
    const purity = finite(solute.purity ?? 1, `${solute.id}.purity`);
    if (!(purity > 0 && purity <= 1)) throw new Error(`${solute.id}.purity must be within (0,1].`);
    for (const side of ['cation','anion']) {
      const ion = solute[side];
      if (!ion) continue;
      if (!(ion in dataset.ionMolarMasses)) throw new Error(`${solute.id} references unknown ion ${ion}.`);
      const countKey = side === 'cation' ? 'catN' : 'anN';
      if (finite(solute[countKey] ?? 0, `${solute.id}.${countKey}`) <= 0) throw new Error(`${solute.id}.${countKey} must be positive.`);
    }
  }
  return dataset;
}

export function soluteContributionMgL(solute, grams, volumeL, ionMolarMasses) {
  const doseG = nonNegative(grams, 'grams');
  const volume = finite(volumeL, 'volumeL');
  if (volume <= 0) throw new RangeError('volumeL must be positive.');
  const moles = doseG * finite(solute.purity ?? 1, `${solute.id}.purity`) / finite(solute.mw, `${solute.id}.mw`);
  const output = {};
  if (solute.cation) output[solute.cation] = moles * finite(solute.catN ?? 1, `${solute.id}.catN`) * finite(ionMolarMasses[solute.cation], solute.cation) * 1000 / volume;
  if (solute.anion) output[solute.anion] = (output[solute.anion] ?? 0) + moles * finite(solute.anN ?? 1, `${solute.id}.anN`) * finite(ionMolarMasses[solute.anion], solute.anion) * 1000 / volume;
  return output;
}

export function calculateIonLoads({ dosesG, volumeL, dataset }) {
  validateDataset(dataset);
  const soluteMap = new Map(dataset.solutes.map((item) => [item.id, item]));
  const ions = Object.fromEntries(DEFAULT_IONS.map((ion) => [ion, 0]));
  const unknownSolutes = [];
  for (const [id, rawDose] of Object.entries(dosesG ?? {})) {
    const dose = nonNegative(rawDose, `dosesG.${id}`);
    if (dose === 0) continue;
    const solute = soluteMap.get(id);
    if (!solute) { unknownSolutes.push(id); continue; }
    for (const [ion, value] of Object.entries(soluteContributionMgL(solute, dose, volumeL, dataset.ionMolarMasses))) ions[ion] = (ions[ion] ?? 0) + value;
  }
  if (unknownSolutes.length) throw new Error(`Unknown solutes: ${unknownSolutes.join(', ')}`);
  const ionicMassSumMgL = Object.values(ions).reduce((sum, value) => sum + value, 0);
  return {
    ionsMgL: Object.fromEntries(Object.entries(ions).map(([key, value]) => [key, Number(value.toFixed(6))])),
    ionicMassSumMgL: Number(ionicMassSumMgL.toFixed(6)),
    tdsInterpretation: 'calculated-ionic-mass-sum-not-conductivity-derived-tds'
  };
}

const CHARGES = { Ca: 2, Mg: 2, Na: 1, K: 1, HCO3: -1, CO3: -2, Cl: -1, SO4: -2, Lactate: -1, Citrate: -3, Gluconate: -1 };
export function chargeBalance({ ionsMgL, ionMolarMasses }) {
  let cations = 0;
  let anions = 0;
  for (const [ion, charge] of Object.entries(CHARGES)) {
    const mgL = nonNegative(ionsMgL?.[ion] ?? 0, `ionsMgL.${ion}`);
    if (mgL === 0 && !(ion in ionMolarMasses)) continue;
    const mmolL = mgL / finite(ionMolarMasses[ion], `ionMolarMasses.${ion}`);
    const meqL = mmolL * Math.abs(charge);
    if (charge > 0) cations += meqL; else anions += meqL;
  }
  const denominator = cations + anions;
  const imbalancePct = denominator ? 200 * (cations - anions) / denominator : 0;
  return {
    cationsMeqL: Number(cations.toFixed(6)),
    anionsMeqL: Number(anions.toFixed(6)),
    imbalancePct: Number(imbalancePct.toFixed(3)),
    status: Math.abs(imbalancePct) <= 5 ? 'balanced' : Math.abs(imbalancePct) <= 10 ? 'review' : 'invalid-or-incomplete'
  };
}

export function quantizeDose(grams, scaleResolutionG) {
  const dose = nonNegative(grams, 'grams');
  const resolution = finite(scaleResolutionG, 'scaleResolutionG');
  if (resolution <= 0) throw new RangeError('scaleResolutionG must be positive.');
  const rounded = Math.round(dose / resolution) * resolution;
  const halfStep = resolution / 2;
  return {
    exactG: dose,
    recommendedG: Number(rounded.toFixed(8)),
    intervalG: [Number(Math.max(0, rounded - halfStep).toFixed(8)), Number((rounded + halfStep).toFixed(8))],
    scaleResolutionG: resolution
  };
}

function contributionMatrix(solutes, ions, volumeL, masses) {
  return ions.map((ion) => solutes.map((solute) => soluteContributionMgL(solute, 1, volumeL, masses)[ion] ?? 0));
}
function objective(matrix, x, target, weights, regularization) {
  let value = 0;
  for (let i = 0; i < matrix.length; i += 1) {
    let estimate = 0;
    for (let j = 0; j < x.length; j += 1) estimate += matrix[i][j] * x[j];
    value += weights[i] * (estimate - target[i]) ** 2;
  }
  for (const dose of x) value += regularization * dose * dose;
  return value;
}

export function solveFormulation({ targetIonsMgL, volumeL, allowedSoluteIds, dataset, scaleResolutionG = 0.001, maxIterations = 12000 }) {
  validateDataset(dataset);
  const targetEntries = Object.entries(targetIonsMgL ?? {}).filter(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0);
  if (!targetEntries.length) throw new Error('At least one non-negative target ion is required.');
  const soluteMap = new Map(dataset.solutes.map((item) => [item.id, item]));
  const solutes = [...new Set(allowedSoluteIds ?? [])].map((id) => {
    const solute = soluteMap.get(id);
    if (!solute) throw new Error(`Unknown allowed solute: ${id}`);
    return solute;
  });
  if (!solutes.length) throw new Error('At least one allowed solute is required.');
  const ions = targetEntries.map(([ion]) => ion);
  const target = targetEntries.map(([, value]) => Number(value));
  const weights = target.map((value) => 1 / Math.max(25, value * value));
  const matrix = contributionMatrix(solutes, ions, volumeL, dataset.ionMolarMasses);
  const x = new Array(solutes.length).fill(0);
  const regularization = 1e-7;
  let lipschitz = regularization * 2;
  for (let j = 0; j < solutes.length; j += 1) {
    let norm = 0;
    for (let i = 0; i < ions.length; i += 1) norm += weights[i] * matrix[i][j] ** 2;
    lipschitz = Math.max(lipschitz, 2 * norm + 2 * regularization);
  }
  let step = 0.8 / Math.max(lipschitz, 1e-12);
  let previousObjective = Number.POSITIVE_INFINITY;
  let iterations = 0;
  for (; iterations < maxIterations; iterations += 1) {
    const estimates = matrix.map((row) => row.reduce((sum, coefficient, j) => sum + coefficient * x[j], 0));
    const gradient = x.map((dose, j) => {
      let g = 2 * regularization * dose;
      for (let i = 0; i < ions.length; i += 1) g += 2 * weights[i] * matrix[i][j] * (estimates[i] - target[i]);
      return g;
    });
    const candidate = x.map((dose, j) => Math.max(0, dose - step * gradient[j]));
    const candidateObjective = objective(matrix, candidate, target, weights, regularization);
    if (candidateObjective > previousObjective) { step *= 0.5; continue; }
    const maxChange = Math.max(...candidate.map((value, j) => Math.abs(value - x[j])));
    x.splice(0, x.length, ...candidate);
    if (Math.abs(previousObjective - candidateObjective) < 1e-14 && maxChange < 1e-10) break;
    previousObjective = candidateObjective;
  }
  const exactDosesG = Object.fromEntries(solutes.map((solute, index) => [solute.id, x[index]]));
  const quantized = Object.fromEntries(Object.entries(exactDosesG).map(([id, dose]) => [id, quantizeDose(dose, scaleResolutionG)]));
  const recommendedDosesG = Object.fromEntries(Object.entries(quantized).map(([id, value]) => [id, value.recommendedG]));
  const exactLoads = calculateIonLoads({ dosesG: exactDosesG, volumeL, dataset });
  const recommendedLoads = calculateIonLoads({ dosesG: recommendedDosesG, volumeL, dataset });
  const residuals = Object.fromEntries(ions.map((ion, index) => [ion, Number(((recommendedLoads.ionsMgL[ion] ?? 0) - target[index]).toFixed(6))]));
  const normalizedRmse = Math.sqrt(Object.entries(residuals).reduce((sum, [ion, value]) => sum + (value / Math.max(5, Number(targetIonsMgL[ion]))) ** 2, 0) / ions.length);
  const balance = chargeBalance({ ionsMgL: recommendedLoads.ionsMgL, ionMolarMasses: dataset.ionMolarMasses });
  const warnings = [
    'Calculated ionic mass sum is not a conductivity-derived TDS measurement.',
    'No pH value is predicted because carbonate equilibrium, dissolved CO2, temperature and activity coefficients are not fully specified.',
    'Target ions may be chemically infeasible with the selected salts; inspect residuals and charge balance.'
  ];
  if (normalizedRmse > 0.15) warnings.unshift('Selected salts cannot closely satisfy all target ions; residual error is material.');
  if (balance.status !== 'balanced') warnings.unshift('Charge-balance diagnostic is outside the preferred ±5% range.');
  return {
    contract: 'water-formulation/1.0',
    targetIonsMgL: Object.fromEntries(targetEntries),
    exactDosesG,
    doseInstructions: quantized,
    recommendedDosesG,
    exactIonLoads: exactLoads,
    recommendedIonLoads: recommendedLoads,
    residualsMgL: residuals,
    normalizedRmse: Number(normalizedRmse.toFixed(6)),
    chargeBalance: balance,
    iterations,
    assumptions: { additiveVolume: true, completeDissolution: true, noPrecipitation: true, inputPurityApplied: true },
    warnings
  };
}

export function evaluateOperationalRisks({ ionsMgL, ionicMassSumMgL, chargeBalanceResult }) {
  const risks = [];
  const add = (code, severity, message) => risks.push({ code, severity, message });
  if ((ionsMgL.HCO3 ?? 0) > 80) add('high-alkalinity', 'high', 'HCO3⁻ exceeds 80 mg/L; acidity suppression and dullness risk increase.');
  if ((ionsMgL.SO4 ?? 0) > 100) add('high-sulfate', 'medium', 'SO4²⁻ exceeds 100 mg/L; dryness or harshness risk may increase.');
  if ((ionsMgL.Cl ?? 0) > 80) add('high-chloride', 'medium', 'Cl⁻ exceeds 80 mg/L; salty, heavy or corrosivity concerns require review.');
  if ((ionsMgL.Na ?? 0) > 50) add('high-sodium', 'medium', 'Na⁺ exceeds 50 mg/L; salinity and muted acidity risk increase.');
  if ((ionsMgL.K ?? 0) > 60) add('high-potassium', 'medium', 'K⁺ exceeds 60 mg/L; bitter or metallic perception risk increases.');
  if (ionicMassSumMgL > 180) add('high-ionic-mass', 'medium', 'Calculated ionic mass sum exceeds 180 mg/L; this is an operational warning, not a measured TDS value.');
  if (Math.abs(chargeBalanceResult?.imbalancePct ?? 0) > 10) add('charge-imbalance', 'high', 'Charge balance exceeds ±10%; formulation inputs are incomplete or inconsistent.');
  return { level: risks.some((risk) => risk.severity === 'high') ? 'high' : risks.length ? 'review' : 'normal', risks };
}
