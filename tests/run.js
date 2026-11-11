'use strict';
// Snapshot tests for computeOps (code.js) without Figma. "_" in expected = U+00A0.
// node tests/run.js           → compare
// node tests/run.js --update  → rewrite expected values (review the diff!)
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ctx = { figma: { showUI() {}, on() {}, ui: {}, annotations: {} }, __html__: '', console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'code.js'), 'utf8'), ctx);
const computeOps = vm.runInContext('computeOps', ctx);

function apply(text) {
  const o = computeOps(text);
  const ops = [...o.replace].map((i) => [i, 0]).concat([...o.insert].map((i) => [i, 1])).sort((a, b) => b[0] - a[0]);
  let s = text;
  for (const [i, k] of ops) s = s.slice(0, i) + ' ' + s.slice(i + (k ? 0 : 1));
  return s.replace(/ /g, '_');
}

const file = path.join(__dirname, 'cases.json');
const cases = JSON.parse(fs.readFileSync(file, 'utf8'));
const update = process.argv.includes('--update');
let bad = 0;
for (const c of cases) {
  const got = apply(c.in);
  if (got === c.out) continue;
  if (update) { c.out = got; continue; }
  bad++;
  console.log('FAIL', JSON.stringify(c.in), '\n  want:', c.out, '\n  got: ', got);
}
if (update) {
  fs.writeFileSync(file, JSON.stringify(cases, null, 1) + '\n');
  console.log('updated', cases.length, 'cases');
} else {
  console.log(bad ? bad + ' failed of ' + cases.length : 'ok: ' + cases.length + ' cases');
  process.exit(bad ? 1 : 0);
}
