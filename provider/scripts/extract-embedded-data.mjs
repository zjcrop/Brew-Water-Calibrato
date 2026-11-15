import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function extractLiteral(source, variableName, { optional = false } = {}) {
  const marker = `const ${variableName}=`;
  const declarations = [...source.matchAll(new RegExp(`\\bconst\\s+${variableName}\\s*=`, 'g'))];
  if (!declarations.length) {
    if (optional) return null;
    throw new Error(`Cannot find ${marker}`);
  }
  if (declarations.length !== 1) throw new Error(`Ambiguous duplicate constant ${variableName}.`);
  let cursor = declarations[0].index + declarations[0][0].length;
  while (/\s/.test(source[cursor])) cursor += 1;
  const opening = source[cursor];
  const closing = opening === '[' ? ']' : opening === '{' ? '}' : null;
  if (!closing) throw new Error(`${variableName} must start with [ or {.`);
  let depth = 0;
  let quote = null;
  let escape = false;
  for (let i = cursor; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i + 2);
      if (end < 0) throw new Error(`Unterminated ${variableName} literal.`);
      i = end; continue;
    }
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new Error(`Unterminated ${variableName} comment.`);
      i = end + 1; continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === opening) depth += 1;
    else if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        const remainder = source.slice(i + 1).replace(/^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*/, '');
        if (remainder && !remainder.startsWith(';')) throw new Error(`${variableName} initializer must be a static literal, not an expression.`);
        return source.slice(cursor, i + 1);
      }
    }
  }
  throw new Error(`Unterminated ${variableName} literal.`);
}

// A restricted data parser: object/array/string/finite number/boolean/null only.
// Never evaluate a literal in vm: object values can otherwise execute code.
function parseStaticData(source, label) {
  let cursor = 0;
  const fail = (message) => { throw new Error(`${label}: ${message} at offset ${cursor}.`); };
  const skip = () => {
    while (cursor < source.length) {
      if (/\s/.test(source[cursor])) { cursor += 1; continue; }
      if (source.startsWith('//', cursor)) { const end = source.indexOf('\n', cursor + 2); cursor = end < 0 ? source.length : end + 1; continue; }
      if (source.startsWith('/*', cursor)) { const end = source.indexOf('*/', cursor + 2); if (end < 0) fail('Unterminated comment'); cursor = end + 2; continue; }
      break;
    }
  };
  const string = () => {
    const quote = source[cursor++]; let output = '';
    while (cursor < source.length) {
      const char = source[cursor++];
      if (char === quote) return output;
      if (char === '\n' || char === '\r') fail('Unescaped newline in string');
      if (char !== '\\') { output += char; continue; }
      const escape = source[cursor++];
      const simple = { n:'\n', r:'\r', t:'\t', b:'\b', f:'\f', v:'\v', '0':'\0', '\\':'\\', '"':'"', "'":"'", '/':'/' };
      if (Object.hasOwn(simple, escape)) {
        if (escape === '0' && /[0-9]/.test(source[cursor] ?? '')) fail('Octal escape is not allowed');
        output += simple[escape];
      } else if (escape === 'u' || escape === 'x') {
        const length = escape === 'u' ? 4 : 2, hex = source.slice(cursor, cursor + length);
        if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(hex)) fail('Invalid hexadecimal escape');
        cursor += length; output += String.fromCharCode(parseInt(hex, 16));
      } else fail('Unsupported string escape');
    }
    fail('Unterminated string');
  };
  const value = (depth = 0) => {
    if (depth > 64) fail('Data nesting is too deep');
    skip(); const char = source[cursor];
    if (char === '"' || char === "'") return string();
    if (char === '[') {
      cursor += 1; const output = []; skip();
      while (source[cursor] !== ']') {
        output.push(value(depth + 1)); skip();
        if (source[cursor] === ']') break;
        if (source[cursor++] !== ',') fail('Expected array comma');
        skip();
      }
      cursor += 1; return output;
    }
    if (char === '{') {
      cursor += 1; const output = Object.create(null); skip();
      while (source[cursor] !== '}') {
        let key;
        if (source[cursor] === '"' || source[cursor] === "'") key = string();
        else { const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(cursor)); if (!match) fail('Expected static property name'); key = match[0]; cursor += key.length; }
        if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('Unsafe property name');
        if (Object.hasOwn(output, key)) fail(`Duplicate property ${key}`);
        skip(); if (source[cursor++] !== ':') fail('Expected property colon');
        output[key] = value(depth + 1); skip();
        if (source[cursor] === '}') break;
        if (source[cursor++] !== ',') fail('Expected object comma');
        skip();
      }
      cursor += 1; return output;
    }
    for (const [token, result] of [['true',true], ['false',false], ['null',null]]) {
      if (source.startsWith(token, cursor) && !/[A-Za-z0-9_$]/.test(source[cursor + token.length] ?? '')) { cursor += token.length; return result; }
    }
    const number = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(cursor));
    if (number) { cursor += number[0].length; const result = Number(number[0]); if (!Number.isFinite(result)) fail('Non-finite number'); return result; }
    fail('Only static data literals are supported');
  };
  const output = value(); skip(); if (cursor !== source.length) fail('Unexpected expression after data');
  return JSON.parse(JSON.stringify(output));
}

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a data object.`);
  return value;
}

export function extractEmbeddedDataset(indexHtml, { sourceAppVersion } = {}) {
  if (!sourceAppVersion || typeof sourceAppVersion !== 'string') throw new Error('sourceAppVersion must be supplied by package.json.');
  const source = String(indexHtml);
  const evaluate = (name, options) => {
    const literal = extractLiteral(source, name, options);
    return literal === null ? null : parseStaticData(literal, name);
  };
  const solutes = evaluate('MAT');
  if (!Array.isArray(solutes) || !solutes.length) throw new Error('MAT must be a non-empty array.');
  const ionMolarMasses = record(evaluate('IONM'), 'IONM');
  const profiles = record(evaluate('PROFILE'), 'PROFILE');
  const audit = evaluate('CUILI_V261_PROFILE_AUDIT', { optional: true });
  if (audit) for (const [id, update] of Object.entries(record(audit, 'CUILI_V261_PROFILE_AUDIT'))) {
    if (!Object.hasOwn(profiles, id)) throw new Error(`Profile override references missing profile ${id}.`);
    const profile = profiles[id]; record(update, `${id} override`);
    for (const key of ['tds', 't', 'g', 'bias', 'audit']) if (Object.hasOwn(update, key)) profile[key] = structuredClone(update[key]);
    if (typeof update.audit === 'string' && typeof profile.note === 'string' && !profile.note.includes('v2.6.1审核')) profile.note += ` v2.6.1审核：${update.audit}`;
  }
  const teaProfiles = evaluate('CUILI_TEA_PROFILES', { optional: true });
  if (teaProfiles) for (const [id, profile] of Object.entries(record(teaProfiles, 'CUILI_TEA_PROFILES'))) {
    if (Object.hasOwn(profiles, id)) throw new Error(`Tea profile would overwrite existing profile ${id}.`);
    profiles[id] = record(profile, id);
  }
  return {
    contract: 'water-chemistry-data/1.0',
    sourceAppVersion,
    solutes,
    ionMolarMasses,
    profiles,
    scientificBoundaries: {
      tds: 'Ionic mass sum and formulation arithmetic are not conductivity-derived TDS measurements.',
      pH: 'pH is not predicted without carbonate equilibrium, dissolved CO2, temperature and activity coefficients.',
      precipitation: 'Complete dissolution is an explicit idealization; low-solubility salts require separate experimental validation.',
      organicBuffers: 'Citrate and lactate totals do not determine titratable alkalinity or free-ion fractions without an equilibrium model.',
      profiles: 'Coffee and tea profiles are engineering starting points, not assays of an individual bean or tea batch.'
    },
    extraction: { method: 'static-data-literals-only', coffeeOverridesApplied: Boolean(audit), teaProfilesIncluded: Boolean(teaProfiles) }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const input = process.argv[2] ?? 'index.html';
  const output = process.argv[3];
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const dataset = extractEmbeddedDataset(fs.readFileSync(input, 'utf8'), { sourceAppVersion: pkg.version });
  const text = JSON.stringify(dataset, null, 2) + '\n';
  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, text);
  } else process.stdout.write(text);
}
