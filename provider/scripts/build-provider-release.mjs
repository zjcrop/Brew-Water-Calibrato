import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDataset } from '../../core/water-engine.mjs';
import { extractEmbeddedDataset } from './extract-embedded-data.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const args = process.argv.slice(2);
const writeMode = args.includes('--write');
const outputArg = args.find((arg) => arg.startsWith('--output='));
const out = outputArg ? path.resolve(outputArg.slice(9)) : writeMode ? path.join(repoRoot, 'provider/releases') : fs.mkdtempSync(path.join(os.tmpdir(), 'water-provider-'));
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const dataset = extractEmbeddedDataset(fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8'), { sourceAppVersion: pkg.version });
validateDataset(dataset);
if (dataset.sourceAppVersion !== pkg.version) throw new Error(`App version drift: dataset=${dataset.sourceAppVersion}, package=${pkg.version}`);
const sourceDate = (process.env.SOURCE_COMMIT_DATE ?? new Date(0).toISOString()).replace(/\.\d{3}Z$/, 'Z');
const sourceCommit = String(process.env.SOURCE_COMMIT ?? 'unknown').toLowerCase();
const sourceRevision = /^[0-9a-f]{8,40}$/.test(sourceCommit) ? sourceCommit.slice(0, 12) : 'unknown';
const datePart = sourceDate.slice(0, 10).replaceAll('-', '');
const dataVersion = `1.0.${datePart}+app.${pkg.version}.src.${sourceRevision}`;
const dataRel = `data/water-chemistry-data-${dataVersion}.json`;
const moduleRel = 'modules/water-engine-1.0.0.mjs';
fs.mkdirSync(path.join(out, 'data'), { recursive: true });
fs.mkdirSync(path.join(out, 'modules'), { recursive: true });
const dataText = JSON.stringify({ ...dataset, dataVersion }, null, 2) + '\n';
fs.writeFileSync(path.join(out, dataRel), dataText, 'utf8');
const moduleText = fs.readFileSync(path.join(repoRoot, 'core/water-engine.mjs'), 'utf8');
fs.writeFileSync(path.join(out, moduleRel), moduleText, 'utf8');
const makeArtifact = (kind, rel, mediaType) => {
  const text = fs.readFileSync(path.join(out, rel), 'utf8');
  return {
    kind,
    path: rel,
    url: `https://raw.githubusercontent.com/zjcrop/Brew-Water-Calibrato/main/provider/releases/${rel}`,
    mediaType,
    bytes: Buffer.byteLength(text),
    sha256: crypto.createHash('sha256').update(text).digest('hex')
  };
};
const manifest = {
  provider: 'brew-water-calibrato',
  contract: 'water-formulation/1.0',
  releaseId: `brew-water-${dataVersion}`,
  dataVersion,
  schemaVersion: '1.0',
  generatedAt: sourceDate,
  status: 'stable',
  appendOnly: false,
  source: { repository: 'zjcrop/Brew-Water-Calibrato', ref: 'main', path: 'index.html', commit: sourceRevision === 'unknown' ? null : sourceCommit },
  compatibility: { minimumConsumerContract: 'water-formulation/1.0', previousReleaseId: null, previousDataVersion: null },
  counts: { solutes: dataset.solutes.length, profiles: Object.keys(dataset.profiles).length, ions: Object.keys(dataset.ionMolarMasses).length },
  artifacts: [makeArtifact('catalog', dataRel, 'application/json'), makeArtifact('module', moduleRel, 'text/javascript')],
  warnings: [
    'Calculated ionic mass sum is not a conductivity-derived TDS measurement.',
    'pH is not predicted without carbonate equilibrium, dissolved CO2, temperature and activity coefficients.',
    'Complete dissolution and no precipitation are explicit idealizations; low-solubility salts require experimental validation.'
  ],
  metadata: { sourceAppVersion: pkg.version, sourceRevision, deterministicEngineVersion: '1.0.0', dataSource: 'constants-extracted-from-standalone-app-at-build-time' }
};
fs.writeFileSync(path.join(out, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: out, releaseId: manifest.releaseId, counts: manifest.counts }, null, 2));
