---
name: nbsp-figma-verify
description: Verify the Figma NBSP plugin in a real Figma file (fast path with mixed styles, annotations, selectedTextRange, UI). Use after changing fixNode, analyze, syncAnnotation or ui.html.
---
Tests can't cover `figma.*`. Use a disposable test file, never the user's work files.
Manual (user): Plugins → Development → Import plugin from manifest → `manifest.json`; Plugin → run on test layers:
- one-style layer "в 1000 лет и 20 %" → NBSP set, style intact
- mixed styles (bold word, colored word, link) → formatting not lost (this exercises the per-char path; the single-write fast path must be skipped)
- checkbox on: annotation added with category "Текст" (no duplicate category), text has `&nbsp;`; rerun → "без изменений"; edit text, rerun → same annotation updated; layer with a foreign annotation / "Текст" annotation with a link → untouched, ours appended
- select layers → both lists appear without running; click a row → layer + fragment selected, list stays; edit text → list refreshes
- text with "в  доме" (2 spaces) → listed under repeated spaces; after the button → "в_доме"
- layer with missing font → skipped, reported in the notify toast
Automated (only if the Figma MCP exposes `use_figma` and the user gives a test fileKey): load skill `figma-use` first, create a session, build the layers above, paste `code.js` logic via `use_figma` and read results. Note: `setPluginData` is unsupported there, so annotation re-run lookup falls back to text matching.
Fix failures in `code.js`, rerun `npm test`, report what was verified vs. not.
