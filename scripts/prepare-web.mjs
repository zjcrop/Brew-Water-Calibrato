import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

await rm('www', { recursive: true, force: true });
await mkdir('www', { recursive: true });

let html = await readFile('index.html', 'utf8');
const providerScript = '<script type="module" src="./core/provider-bootstrap.mjs"></script>';
if (!html.includes(providerScript)) {
  if (!html.includes('</body>')) throw new Error('index.html is missing </body>; provider bootstrap cannot be injected safely.');
  html = html.replace('</body>', `${providerScript}\n</body>`);
}
await writeFile('www/index.html', html, 'utf8');

try {
  await cp('assets', 'www/assets', { recursive: true });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
await cp('core', 'www/core', { recursive: true });

const sourceCommitDate = process.env.SOURCE_COMMIT_DATE ?? new Date().toISOString();
await execFileAsync(process.execPath, ['provider/scripts/build-provider-release.mjs', '--output=www/provider'], {
  env: { ...process.env, SOURCE_COMMIT_DATE: sourceCommitDate }
});
await execFileAsync(process.execPath, ['provider/scripts/verify-provider-release.mjs', '--output=www/provider']);

console.log('Prepared verified www bundle: standalone UI + shared water core + provider release.');
