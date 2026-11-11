---
name: nbsp-add-rule
description: Add or change a typography rule (where NBSP is placed) in the Figma NBSP plugin. Use for any edit to computeOps, word lists, or the rules reference.
---
1. Read CLAUDE.md "Decided rules"; don't contradict them without asking Max.
2. Edit `computeOps` in `code.js`: add regex/list at module scope (compiled once), loop via `each()`. Replace only U+0020 (`space(i)` / `replace.add(i)`); `insert` only inside digit groups.
3. Add 2–4 inputs to `tests/cases.json` (include a negative case that must stay unchanged; `out` may be empty), run `npm test -- --update`, read the diff: every changed line must be intended.
4. Run `npm test` (must pass), `node --check code.js`.
5. Sync: `HELP` array in `ui.html` and the rules list in `README.md`; update "Decided rules" in CLAUDE.md if the user made a decision.
6. Report in Russian: what changed, edge cases, anything uncertain.
