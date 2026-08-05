import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateDataset } from '../../core/water-engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const outputArg = process.argv.slice(2).find((arg) => arg.startsWith('--output='));
const out = outputArg ? path.resolve(outputArg.slice(9)) : path.join(repoRoot, 'provider/releases');
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'latest.json'), 'utf8'));
if (manifest.provider !== 'brew-water-calibrato' || manifest.contract !== 'water-formulation/1.0') throw new Error('Unexpected water provider contract.');
for (const artifact of manifest.artifacts) {
  const file = path.join(out, artifact.path);
  const text = fs.readFileSync(file, 'utf8');
  if (Buffer.byteLength(text) !== artifact.bytes) throw new Error(`Byte count mismatch: ${artifact.path}`);
  if (crypto.createHash('sha256').update(text).digest('hex') !== artifact.sha256) throw new Error(`SHA-256 mismatch: ${artifact.path}`);
}
const dataArtifact = manifest.artifacts.find((item) => item.kind === 'catalog');
const moduleArtifact = manifest.artifacts.find((item) => item.kind === 'module');
const dataset = JSON.parse(fs.readFileSync(path.join(out, dataArtifact.path), 'utf8'));
validateDataset(dataset);
if (dataset.solutes.length !== manifest.counts.solutes) throw new Error('Solute count mismatch.');
const imported = await import(`${pathToFileURL(path.join(out, moduleArtifact.path)).href}?verify=${Date.now()}`);
for (const name of ['validateDataset','calculateIonLoads','chargeBalance','quantizeDose','solveFormulation','evaluateOperationalRisks']) {
  if (typeof imported[name] !== 'function') throw new Error(`Engine export missing: ${name}`);
}
const defaultSolutes = dataset.solutes.filter((item) => item.default).slice(0, 3).map((item) => item.id);
if (defaultSolutes.length) {
  const loads = imported.calculateIonLoads({ dosesG: Object.fromEntries(defaultSolutes.map((id) => [id, 0.01])), volumeL: 5, dataset });
  if (!(loads.ionicMassSumMgL >= 0)) throw new Error('Engine smoke test failed.');
}
console.log(JSON.stringify({ valid: true, releaseId: manifest.releaseId, counts: manifest.counts, engineExports: Object.keys(imported).sort() }, null, 2));
