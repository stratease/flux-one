/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function readUtf8(p) {
  return fs.readFileSync(p, 'utf8');
}

function extractStringProps(src, propName) {
  const out = new Set();
  const re = new RegExp(`${propName}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`, 'g');
  let m;
  while ((m = re.exec(src))) {
    const v = String(m[1] || '').trim();
    if (v) out.add(v);
  }
  return out;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const registryPath = path.join(root, 'assets/js/src/command/registry.ts');
  const docsPath = path.join(root, 'assets/js/src/command/commandDocs.ts');

  const registrySrc = readUtf8(registryPath);
  const docsSrc = readUtf8(docsPath);

  const registryValues = extractStringProps(registrySrc, 'value');
  const docCanon = extractStringProps(docsSrc, 'canonical');

  const missing = [...registryValues].filter((v) => !docCanon.has(v)).sort();

  if (missing.length) {
    console.error('Docs triangle check failed.');
    console.error('Missing `COMMAND_DOCS` entries for registry commands:');
    for (const v of missing) {
      console.error(`- ${v}`);
    }
    process.exit(1);
  }

  console.log('Docs triangle check ok.');
}

main();

