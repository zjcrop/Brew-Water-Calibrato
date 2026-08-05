import * as engine from './water-engine.mjs';

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function loadProvider() {
  const manifestResponse = await fetch('../provider/latest.json', { cache: 'no-cache' });
  if (!manifestResponse.ok) throw new Error(`Provider manifest HTTP ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  const dataArtifact = manifest.artifacts.find((item) => item.kind === 'catalog');
  if (!dataArtifact) throw new Error('Water provider dataset artifact is missing.');
  const dataResponse = await fetch(`../provider/${dataArtifact.path}`, { cache: 'no-cache' });
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
