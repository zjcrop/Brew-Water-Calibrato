import { cp, copyFile, mkdir, rm } from 'node:fs/promises';

await rm('www', { recursive: true, force: true });
await mkdir('www', { recursive: true });
await copyFile('index.html', 'www/index.html');
try {
  await cp('assets', 'www/assets', { recursive: true });
  console.log('Prepared www/index.html and www/assets from repository root.');
} catch (err) {
  if (err && err.code !== 'ENOENT') throw err;
  console.log('Prepared www/index.html (no assets directory found).');
}
