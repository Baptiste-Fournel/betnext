#!/usr/bin/env node
/**
 * Garde de convention de nommage des tests (BET-26).
 * Tout libellé `it(...)` / `test(...)` d'un fichier `*.spec.ts` DOIT suivre `shouldXxxx_WhenXxxx`
 * (camelCase, un segment d'attendu + un segment de condition). Échoue le build sinon — la CI le
 * fait donc respecter au même titre que le lint et les frontières.
 */
const { readdirSync, readFileSync, statSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..', 'src');
const PATTERN = /^should[A-Za-z0-9]+_When[A-Za-z0-9]+$/;
const TITLE_RE = /\b(?:it|test)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

const collectSpecFiles = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectSpecFiles(full));
    else if (entry.endsWith('.spec.ts')) out.push(full);
  }
  return out;
};

const violations = [];
let checked = 0;

for (const file of collectSpecFiles(ROOT)) {
  const src = readFileSync(file, 'utf8');
  let match;
  while ((match = TITLE_RE.exec(src)) !== null) {
    checked += 1;
    const title = match[2];
    if (!PATTERN.test(title)) {
      const line = src.slice(0, match.index).split('\n').length;
      violations.push(`${file}:${line}  "${title}"`);
    }
  }
}

if (violations.length > 0) {
  console.error(`✖ ${violations.length} libellé(s) de test hors convention shouldXxxx_WhenXxxx :`);
  for (const v of violations) console.error(`  ${v}`);
  console.error('\nFormat attendu : it(\'shouldDoX_WhenY\', ...) — camelCase, attendu + condition.');
  process.exit(1);
}

console.log(`✔ ${checked} libellés de test conformes à shouldXxxx_WhenXxxx.`);
