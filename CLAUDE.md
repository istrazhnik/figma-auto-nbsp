# figma-auto-nbsp

Figma plugin, plain JS, no build. Selected text layers → Russian NBSP typography; optional annotation; reports double spaces. All user-facing text is Russian. Owner (Max) is a senior UX/UI designer; reply in Russian.

## Files
- `manifest.json` — editorType figma, documentAccess dynamic-page, no network
- `code.js` — all logic (main thread). `computeOps(text)` is pure + tested; rest uses `figma.*`
- `ui.html` — iframe UI, Figma theme CSS vars (`themeColors:true`). Layer text enters DOM only via `textContent`. `HELP` array = in-plugin rules reference
- `tests/run.js`, `tests/cases.json` — snapshot tests of `computeOps` in node `vm` (no Figma needed; `_` = NBSP)
- `README.md` — rules reference for humans
- `.claude/skills/` — `nbsp-add-rule`, `nbsp-figma-verify`

## Commands
- `npm test` — compare with `tests/cases.json`
- `npm test -- --update` — rewrite snapshots after an intentional rule change; review the diff

## Architecture
- `computeOps` → `{replace:Set<idx of ' '→NBSP>, insert:Set<idx for new NBSP>}`. New chars only inside digit groups; everything else replaces an existing U+0020.
- `applyOps`: indices descending. Fast path (one uniform style segment, >2 ops) = one `node.characters` write; else per-op `insertCharacters(i,NBSP,'AFTER')`+`deleteCharacters` to keep styles. Fonts cached in `loadedFonts`.
- Annotations (checkbox "Добавить аннотацию", persisted via clientStorage): category "Текст" reused, created only if missing. Label = text with NBSP→`&nbsp;`. Own annotation found by (1) exact label == pluginData `nbspAnnotationLabel`, (2) same normalized text as stored, (3) normalized == current text. Never touch other annotations (incl. "Текст" with other content, e.g. links); ours is replaced in place or appended; `properties` preserved.
- Duplicates: `/[   ]{2,}/`, reported only, never fixed (max 200 shown, total counted). UI click → `selectedTextRange`.
- Messages: UI→code `ready|run|set-annotate|focus`; code→UI `init|selection|report`. Auto-run on launch with stored checkbox state.

## Decided rules (user decisions; don't revert without asking)
- Numbers ≥4 digits grouped by 3; existing ' ' between groups → NBSP. Skip: fractions, letter/#/_-adjacent, leading 0, ISO dates, years (before г./гг./год…, after a month name), phone numbers.
- NBSP after: prepositions, conjunctions, не/ни/вот/вон/ну/уж/то, any 1–2-letter word (not бы/ли/же).
- бы/б/ли/ль/же/ж: NBSP only BEFORE (glued to previous word), never after.
- %/‰: NBSP only if the designer already typed a space ("20 %"); "20%" untouched.
- Only U+0020 is replaced; existing NBSP/U+202F left alone.
- Other rules (units, initials, т. е., №/§/ст., addresses, dates, spaced dash, phones, roman+век): README.

## Constraints
- ES2020, no lookbehind. Regexes compiled once at module scope; iterate with `each()` (resets `lastIndex`).
- No deps, no network. Keep `HELP` (ui.html), README rule list and `tests/cases.json` in sync with `computeOps`.
- Never run `computeOps`-changing edits without `npm test`.
- Native Figma UI components don't exist for plugins: UI is HTML mimicking Figma via `--figma-color-*` vars. `figma.parameters` unsuitable (no checkbox/help/results).
- NOT verified in real Figma: fast path with mixed styles, `selectedTextRange`, annotation category API (`getAnnotationCategoriesAsync`/`addAnnotationCategoryAsync`, `labelMarkdown`). Use skill `nbsp-figma-verify`.

## Status
- Not yet on GitHub. Target: private repo `istrazhnik/figma-auto-nbsp` (claude.ai GitHub connector lacked create/write access; push with local git/gh: `git init -b main; git add -A; git commit; git remote add origin https://github.com/istrazhnik/figma-auto-nbsp.git; git push -u origin main`).
- Ideas (not requested): U+2011 in phone hyphens; UI toggles for dense rules (1–2-letter words, percent, phones).
