import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const sourcePaths = ['index.html', 'core', 'provider/scripts', 'provider/schemas', 'provider/tests', 'provider/registry-entry.json', 'package.json', 'package-lock.json', 'scripts/prepare-web.mjs'];

async function gitValue(format) {
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', `--format=${format}`, '--', ...sourcePaths]);
    return stdout.trim();
  } catch {
    return '';
  }
}

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

const sourceCommitDate = process.env.SOURCE_COMMIT_DATE || await gitValue('%cI') || new Date(0).toISOString();
const sourceCommit = process.env.SOURCE_COMMIT || await gitValue('%H') || 'unknown';
await execFileAsync(process.execPath, ['provider/scripts/build-provider-release.mjs', '--output=www/provider'], {
  env: { ...process.env, SOURCE_COMMIT_DATE: sourceCommitDate, SOURCE_COMMIT: sourceCommit }
});
await execFileAsync(process.execPath, ['provider/scripts/verify-provider-release.mjs', '--output=www/provider']);

console.log(`Prepared verified www bundle from source ${sourceCommit.slice(0, 12)}: standalone UI + shared water core + provider release.`);
