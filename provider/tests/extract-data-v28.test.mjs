import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractEmbeddedDataset } from '../scripts/extract-embedded-data.mjs';

const html = `<script>
const MAT=[{id:'x',mw:10,purity:1,cation:'Na',catN:1,anion:'Cl',anN:1}];
const IONM={Na:22.99,Cl:35.45};
const PROFILE={demo:{name:'D',t:{ca:20,mg:20},tds:[50,100],note:'first'}};
const CUILI_V261_PROFILE_AUDIT={demo:{t:{ca:6,mg:7.5},tds:[70,100],g:{ca:[4.5,9]},bias:{x:.75},audit:'audited'}};
const CUILI_TEA_PROFILES={tea_green:{name:'G',category:'tea',t:{ca:4.5,mg:2}}};
throw new Error('page code must not run');
</script>`;
const extract = (source) => extractEmbeddedDataset(source, { sourceAppVersion:'2.8.0' });

test('exports effective coffee overrides and tea additions, not the pre-patch profile', () => {
  const data = extract(html);
  assert.equal(data.profiles.demo.t.ca, 6);
  assert.equal(data.profiles.demo.t.mg, 7.5);
  assert.deepEqual(data.profiles.demo.tds, [70,100]);
  assert.deepEqual(data.profiles.demo.bias, {x:.75});
  assert.equal(data.profiles.demo.audit, 'audited');
  assert.match(data.profiles.demo.note, /v2\.6\.1审核/);
  assert.equal(data.profiles.tea_green.category, 'tea');
  assert.equal(data.extraction.method, 'static-data-literals-only');
  assert.equal(data.extraction.coffeeOverridesApplied, true);
  assert.equal(data.extraction.teaProfilesIncluded, true);
});

test('repository export includes all effective coffee and tea profiles', () => {
  const data = extract(fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8'));
  assert.equal(data.profiles.geisha.t.mg, 7.5);
  assert.equal(data.profiles.geisha.t.hco3, 22);
  assert.deepEqual(data.profiles.geisha.g.mg, [6.5,9.5]);
  assert.equal(data.profiles.tea_green.category, 'tea');
  assert.equal(data.profiles.tea_dark.t.hco3, 58);
  assert.equal(Object.keys(data.profiles).length, 16);
});

test('does not execute expressions embedded inside an otherwise valid object', () => {
  assert.throws(() => extract(html.replace("name:'D'", "name:(()=>{throw new Error('executed')})()")), /Only static data literals/);
  assert.throws(() => extract(html.replace("name:'D'", "get name(){return 'D'}")), /Expected property colon/);
  assert.throws(() => extract(html.replace("name:'D'", "...{name:'D'}")), /Expected static property/);
  assert.throws(() => extract(html.replace("name:'D'", "name:`${globalThis.notExecuted}`")), /Only static data literals/);
  assert.throws(() => extract(html.replace("catN:1,anion:'Cl',anN:1}];", "catN:1,anion:'Cl',anN:1}].map(x=>x);")), /not an expression/);
});

test('handles comments with delimiters, escaped strings and trailing commas as data', () => {
  const source = html.replace("name:'D'", String.raw`/* } ] ignored */ name:'D\'s \u4e2d\n' // } ignored
  `).replace("Cl:35.45}", 'Cl:35.45,}');
  assert.equal(extract(source).profiles.demo.name, "D's 中\n");
});

test('refuses ambiguous, unsafe or drifting profile declarations', () => {
  assert.throws(() => extract(html.replace("name:'D'", "__proto__:{polluted:true}")), /Unsafe property name/);
  assert.throws(() => extract(html.replace("name:'D'", "name:'D',name:'E'")), /Duplicate property/);
  assert.throws(() => extract(`${html}\nconst PROFILE={};`), /Ambiguous duplicate/);
  assert.throws(() => extract(html.replace('AUDIT={demo:', 'AUDIT={missing:')), /missing profile missing/);
  assert.throws(() => extract(html.replace('TEA_PROFILES={tea_green:', 'TEA_PROFILES={demo:')), /overwrite existing/);
});
