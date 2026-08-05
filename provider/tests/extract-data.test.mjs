import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEmbeddedDataset } from '../scripts/extract-embedded-data.mjs';

test('extracts app constants without executing page code', () => {
  const html = `<script>const MAT=[{id:"x",mw:10,purity:1,cation:"Na",catN:1,anion:"Cl",anN:1}];const IONM={Na:22.99,Cl:35.45};const PROFILE={demo:{name:"D"}};throw new Error('must not execute');</script>`;
  const data = extractEmbeddedDataset(html);
  assert.equal(data.solutes[0].id, 'x');
  assert.equal(data.ionMolarMasses.Na, 22.99);
  assert.equal(data.profiles.demo.name, 'D');
});
