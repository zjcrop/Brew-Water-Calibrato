import fs from 'node:fs';
import vm from 'node:vm';

function extractLiteral(source, variableName) {
  const marker = `const ${variableName}=`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Cannot find ${marker}`);
  let cursor = start + marker.length;
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
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === opening) depth += 1;
    else if (char === closing) {
      depth -= 1;
      if (depth === 0) return source.slice(cursor, i + 1);
    }
  }
  throw new Error(`Unterminated ${variableName} literal.`);
}

export function extractEmbeddedDataset(indexHtml) {
  const source = String(indexHtml);
  const context = vm.createContext(Object.create(null));
  const evaluate = (name) => new vm.Script(`(${extractLiteral(source, name)})`).runInContext(context, { timeout: 1000 });
  const solutes = JSON.parse(JSON.stringify(evaluate('MAT')));
  const ionMolarMasses = JSON.parse(JSON.stringify(evaluate('IONM')));
  const profiles = JSON.parse(JSON.stringify(evaluate('PROFILE')));
  return {
    contract: 'water-chemistry-data/1.0',
    sourceAppVersion: '2.7.0',
    solutes,
    ionMolarMasses,
    profiles,
    scientificBoundaries: {
      tds: 'Ionic mass sum and formulation arithmetic are not conductivity-derived TDS measurements.',
      pH: 'pH is not predicted without carbonate equilibrium, dissolved CO2, temperature and activity coefficients.',
      precipitation: 'Complete dissolution is an explicit idealization; low-solubility salts require separate experimental validation.'
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2] ?? 'index.html';
  const output = process.argv[3];
  const dataset = extractEmbeddedDataset(fs.readFileSync(input, 'utf8'));
  const text = JSON.stringify(dataset, null, 2) + '\n';
  if (output) {
    fs.mkdirSync(new URL('.', `file://${output}`).pathname, { recursive: true });
    fs.writeFileSync(output, text);
  } else process.stdout.write(text);
}
