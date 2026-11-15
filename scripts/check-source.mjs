import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const html=fs.readFileSync('index.html','utf8');
let checked=0;
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
  if(!match[2].trim())continue;
  const module=/type\s*=\s*["']module["']/.test(match[1]);
  const result=spawnSync(process.execPath,['--check',...(module?['--input-type=module']:[])],{input:match[2],encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr||'Inline JavaScript syntax check failed');
  checked++;
}
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
if(pkg.version!==lock.version||pkg.version!==lock.packages[''].version)throw new Error('Package/lock version drift');
console.log(`Validated ${checked} inline scripts and package/lock version ${pkg.version}`);
