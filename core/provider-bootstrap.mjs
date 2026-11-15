import * as engine from './water-engine.mjs';

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function loadProvider() {
  // Resolve against this module, not the document: Pages may live in a subpath.
  const providerBase = new URL('../provider/', import.meta.url);
  const manifestResponse = await fetch(new URL('latest.json', providerBase), { cache: 'no-cache' });
  if (!manifestResponse.ok) throw new Error(`Provider manifest HTTP ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  if (manifest.provider !== 'brew-water-calibrato' || manifest.contract !== 'water-formulation/1.0' || !Array.isArray(manifest.artifacts)) throw new Error('Unsupported water provider manifest.');
  const dataArtifact = manifest.artifacts.find((item) => item.kind === 'catalog');
  if (!dataArtifact) throw new Error('Water provider dataset artifact is missing.');
  const artifactPath = dataArtifact.path;
  if (typeof artifactPath !== 'string' || !/^data\/[a-zA-Z0-9_.+-]+\.json$/.test(artifactPath)) throw new Error('Invalid provider dataset path.');
  const dataResponse = await fetch(new URL(artifactPath, providerBase), { cache: 'no-cache' });
  if (!dataResponse.ok) throw new Error(`Provider dataset HTTP ${dataResponse.status}`);
  const text = await dataResponse.text();
  if (await sha256Hex(text) !== dataArtifact.sha256) throw new Error('Water provider dataset SHA-256 mismatch.');
  const dataset = JSON.parse(text);
  engine.validateDataset(dataset);
  const provider = Object.freeze({ manifest, dataset, engine });
  globalThis.BrewWaterProvider = provider;
  globalThis.dispatchEvent(new CustomEvent('brew-water-provider-ready', { detail: { releaseId: manifest.releaseId } }));
  return provider;
}

globalThis.BrewWaterProviderReady = loadProvider().catch((error) => {
  console.error('[BrewWaterProvider]', error);
  globalThis.dispatchEvent(new CustomEvent('brew-water-provider-error', { detail: { message: error.message } }));
  throw error;
});
