'use strict';
// Snapshot tests for fixText (code.js) without Figma: duplicate spaces collapse + computeOps (+ optional rule toggles).
// "_" in expected = U+00A0.
// node tests/run.js           → compare
// node tests/run.js --update  → rewrite expected values (review the diff!)
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = { on() {}, off() {}, selection: [] };
const ctx = { figma: { showUI() {}, on() {}, ui: {}, annotations: {}, currentPage: page }, __html__: '', console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'code.js'), 'utf8'), ctx);
const fixText = vm.runInContext('fixText', ctx);
const normRules = vm.runInContext('normRules', ctx);

const NB = String.fromCharCode(0xa0);
// c.rules (optional): turned-off rules, e.g. {"fourDigit": false}
const apply = (text, rules) => fixText(text, normRules(rules)).text.split(NB).join('_');

const file = path.join(__dirname, 'cases.json');
const cases = JSON.parse(fs.readFileSync(file, 'utf8'));
const update = process.argv.includes('--update');
let bad = 0;
for (const c of cases) {
  const got = apply(c.in, c.rules);
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
