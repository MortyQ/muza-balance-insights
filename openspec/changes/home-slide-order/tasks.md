## 1. Fixed slide order

- [x] 1.1 `HomeHighlights.vue`: `slides` in the order «What's unusual» → «Limits» → «Recent operations»; remove the exceeded branching and update the widget's comments
- [x] 1.2 `tests/renderer/home-highlights.test.ts`: the «Limits» test expects `['unusual', 'limits', 'recent']` for attention and for exceeded; add «a limit in attention, nothing unusual → opens on «Limits», «Recent operations» second»
- [x] 1.3 `.agents/project/desktop-renderer.md`: the two mentions of the order
- [x] 1.4 `CHANGELOG.md` 0.1.15 entry
- [x] 1.5 desktop tests and typecheck
