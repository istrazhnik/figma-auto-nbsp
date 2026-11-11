# figma-auto-nbsp

Figma plugin, plain JS, no build. Selected text layers → live list of missing NBSP + double spaces (click → select fragment); button fixes both; optional annotation. All user-facing text is Russian. Owner (Max) is a senior UX/UI designer; reply in Russian.

## Files
- `manifest.json` — editorType figma, documentAccess dynamic-page, no network
- `code.js` — all logic (main thread). Pure + tested: `computeOps`, `collapseDups`, `fixText`; rest uses `figma.*`
- `ui.html` — iframe UI (version label `v1.0.0` in footer — keep in sync with `package.json`), Figma theme CSS vars (`themeColors:true`). Layer text enters DOM only via `textContent`. `HELP` array = in-plugin rules reference (overlay opened by footer link «Как работает плагин», × / Esc closes)
- `tests/run.js`, `tests/cases.json` — snapshot tests of `fixText` (dup collapse + `computeOps`) in node `vm` (no Figma needed; `_` = NBSP)
- `README.md` — rules reference for humans
- `.claude/skills/` — `nbsp-add-rule`, `nbsp-figma-verify`

## Commands
- `npm test` — compare with `tests/cases.json`
- `npm test -- --update` — rewrite snapshots after an intentional rule change; review the diff

## Architecture
- `computeOps` → `{replace:Set<idx of ' '→NBSP>, insert:Set<idx for new NBSP>}`. New chars only inside digit groups; everything else replaces an existing U+0020.
- `collapseDups`: each `DUP_RE` run → one char (first NBSP/U+202F in run, else first space); returns delete ranges. `fixNode`: collapse, then `computeOps` on collapsed text; indices descending. Fast path (one uniform style segment, >2 ops) = one `node.characters` write; else per-op `insertCharacters(i,NBSP,'AFTER')`+`deleteCharacters` to keep styles. Fonts cached in `loadedFonts`.
- Annotations (checkbox "Добавить аннотацию", persisted via clientStorage): category "Текст" reused, created only if missing. Label = text with NBSP→`&nbsp;`. Own annotation found by (1) exact label == pluginData `nbspAnnotationLabel`, (2) same normalized text as stored, (3) normalized == current text. Never touch other annotations (incl. "Текст" with other content, e.g. links); ours is replaced in place or appended; `properties` preserved.
- Live check: `scope` = text nodes of selection; `analyze()` → `issues` msg {count, nbsp, dups: {nodes, places, items≤100}}. NBSP ops ≤3 chars apart = one place; focus range = exactly the spaces (first..last op; insert-only → empty range = caret); dup place = the run itself. Debounced 120 ms on `selectionchange` and page `nodechange` (re-registered on `currentpagechange`). Click → `focus` sets `pinnedId` so the resulting selectionchange keeps the scope. Run acts on `scope`.
- No auto-run on launch, checkbox doesn't run anything; results only via `figma.notify` (no result panel in UI).
- Messages: UI→code `ready|run|set-annotate|focus|resize`; code→UI `init|issues|done`.
- Window resize: corner grip (`#grip`, UI) → `resize {w,h,save}` (rAF-throttled) → `figma.ui.resize` clamped by `SIZE` (min 300×360); final size saved to clientStorage `size`, restored on launch.

## Decided rules (user decisions; don't revert without asking)
- Numbers ≥4 digits grouped by 3; existing ' ' between groups → NBSP. Skip: fractions, letter/#/_-adjacent, leading 0, ISO dates, years (before г./гг./год…, after a month name), phone numbers.
- NBSP after: prepositions, conjunctions, не/ни/вот/вон/ну/уж/то, any 1–2-letter word (not бы/ли/же).
- бы/б/ли/ль/же/ж: NBSP only BEFORE (glued to previous word), never after.
- %/‰: NBSP only if the designer already typed a space ("20 %"); "20%" untouched.
- Only U+0020 is replaced; existing NBSP/U+202F left alone.
- Repeated spaces ARE fixed by the button (bonus, no separate control): run → one char, then normal rules apply.
- Other rules (units, initials, т. е., №/§/ст., addresses, dates, spaced dash, phones, roman+век): README.

## Constraints
- ES2020, no lookbehind. Regexes compiled once at module scope; iterate with `each()` (resets `lastIndex`).
- No deps, no network. Keep `HELP` (ui.html), README rule list and `tests/cases.json` in sync with `computeOps`.
- Never run `computeOps`-changing edits without `npm test`.
- Native Figma UI components don't exist for plugins: UI is HTML mimicking Figma via `--figma-color-*` vars. `figma.parameters` unsuitable (no checkbox/help/results).
- Verified via Figma MCP (2026-11-12, sandbox file): `fixNode` fast path on uniform text, per-char path on mixed styles (bold/fill/link/underline kept), dup collapse incl. kept NBSP, result == `fixText`.
- NOT verified in real Figma: `selectedTextRange`, `PageNode.on('nodechange')` live refresh, annotation category API (`getAnnotationCategoriesAsync`/`addAnnotationCategoryAsync`, `labelMarkdown`). Use skill `nbsp-figma-verify`.

## Status
- On GitHub: private repo `istrazhnik/figma-auto-nbsp`, branch `main` (push with local git/gh; the claude.ai GitHub connector lacks write access).
- Ideas (not requested): U+2011 in phone hyphens; UI toggles for dense rules (1–2-letter words, percent, phones).
