# MnM Blocks Platform — Implementation Progress

> **Started**: 2026-04-06
> **Source**: brainstorming-mnm-blocks-platform-unifie-2026-04-05.md
> **Pipeline**: 6 phases (Archi -> PM -> Dev -> Review -> Fix -> QA)
> **json-render**: Using Vercel json-render (@json-render/core, react, shadcn) per brainstorming-json-render-agent-content-engine-2026-04-05.md

---

## Pipeline Status

| Phase | Team | Status | Started | Completed |
|-------|------|--------|---------|-----------|
| 1 | Architecture + UX/UI | DONE | 2026-04-06 | 2026-04-06 |
| 2 | PM/PO Sprint Planning | DONE | 2026-04-06 | 2026-04-06 |
| 3-PIVOT | Revert custom blocks, adopt json-render | DONE | 2026-04-06 | 2026-04-06 |
| 3 | Implementation | DONE | 2026-04-06 | 2026-04-06 |
| 4 | Review Team | DONE | 2026-04-06 | 2026-04-06 |
| 5 | Fix Team | DONE | 2026-04-06 | 2026-04-06 |
| 6 | QA Team (ChromeMCP) | PARTIAL (server startup stuck) | 2026-04-06 | — |

---

## Reference Documents

- `_bmad-output/brainstorming/brainstorming-mnm-blocks-platform-unifie-2026-04-05.md` — Unified brainstorming (4 features, 5 epics)
- `_bmad-output/brainstorming/brainstorming-json-render-agent-content-engine-2026-04-05.md` — json-render integration brainstorming
- `_bmad-output/blocks-platform-architecture.md` — Full architecture blueprint (2299 lines)
- `_bmad-output/blocks-platform-ux-spec.md` — UX/UI spec (1281 lines)
- `_bmad-output/sprint-plan-epic2-epic4.md` — Sprint plan for Blocks Foundation + Agent Forms (13 stories)
- `_bmad-output/sprint-plan-epic3-epic5-f1.md` — Sprint plan for Dashboard + Inbox + F1-Admin (19 stories)
- `_bmad-output/json-render-integration-plan.md` — json-render integration plan (what to keep/refactor/delete)

---

## Git Commits (chronological)

1. `7166991b` feat(blocks): BF-01 — Zod content blocks catalogue
2. `c05ce6df` feat(blocks): migrations 0058-0059 + Drizzle schemas + shared types
3. `7fa132fb` -> `62be3c2d` (7 commits) custom block components — **REVERTED** in `f87f9994`
4. `f87f9994` revert: remove custom block components (BF-02 to BF-07)
5. `7e471fbd` feat(blocks): backend routes — user-widgets, inbox-items, content_blocks in comments
6. `b7dc8d94` feat(blocks): frontend API clients, hooks, and query keys
7. `1b99c79b` feat(blocks): F1-Admin — View Presets admin page + editor + role assignment
8. `632bd309` feat(blocks): json-render BlockRenderer + shared type updates + packages
9. `ae95ec0d` feat(blocks): AF-03 — CommentThread renders content blocks
10. `89f4ba5b` feat(blocks): DI-04 — hybrid dashboard with custom widgets
11. `647f85b1` feat(blocks): II-04 — Inbox with rich inbox items
12. `8f048a16` wip(blocks): block components + catalog + registry + progress doc
13. `cd6a789e` fix(blocks): resolve all typecheck errors in block components
14. `d1b014fd` feat(blocks): BF-02 — block catalogue API routes
15. `86ac344a` fix(blocks): II-02/II-03 — inbox-items total count + already-actioned guard
16. `70c5beb7` fix(blocks): Phase 5 — review findings fixes (action dispatch, Tailwind purging, a11y, empty states)

---

## Story Status (32 stories total)

### DONE (14 stories)
- [x] BF-01: Zod catalogue (content-blocks.ts with 14 block types)
- [x] BF-06: useBlockActions hook
- [x] AF-01: Migration content_blocks on issue_comments (in 0058)
- [x] AF-02: Server accepts contentBlocks in comments
- [x] AF-03: CommentThread uses ContentRenderer
- [x] DI-01: user_widgets migration (in 0058)
- [x] DI-02: User widgets CRUD API (4 routes)
- [x] DI-03: Frontend API client + hooks for user widgets
- [x] DI-04: Hybrid dashboard grid (predefined + custom widgets)
- [x] DI-06: Add Widget dialog
- [x] DI-09: Widget management (resize, delete)
- [x] II-01: inbox_items migration (0059)
- [x] F1-ADMIN-01: Admin View Presets list page
- [x] F1-ADMIN-02: View Preset editor
- [x] F1-ADMIN-03: Role to Preset assignment

### DONE (new — session 2)
- [x] BF-01-addon: blockPropsSchemas + Props exports added to content-blocks.ts & shared index
- [x] BF-02: Block catalogue API route (GET /block-catalogue + POST /blocks/validate)
- [x] BF-03c: Chart block component committed + typechecked
- [x] BF-05: BlockRenderer + json-render Renderer integration (Zod 3/4 cast workaround)
- [x] BF-07: Interactive blocks — ActionButton + QuickForm committed + typechecked
- [x] catalog.ts + registry.tsx: json-render integration (defineCatalog + defineRegistry)
- [x] 10 custom block components: all typechecked and committed
- [x] II-02 FIX: inbox-items returns { items, total } with count query
- [x] II-03 FIX: already-actioned guard on POST /inbox-items/:id/action
- [x] II-03 FIX: API client types match { items, total } response

### NOT STARTED (remaining stories)
- [ ] II-05: Action handler integration in inbox
- [ ] II-06: Rich failed run notifications
- [ ] II-07: Migration existing sources to inbox_items
- [ ] DI-05: Custom widget data_source refresh
- [ ] DI-07: CAO prompt enrichment
- [ ] DI-08: CAO widget generation flow
- [ ] AF-04: CAO watchdog enriched reports

---

## RESUME INSTRUCTIONS

To continue this implementation from a new session:

1. Read THIS file first
2. All typecheck errors are resolved. All core block components committed.
3. Remaining work:
   a. Process Phase 4 review findings and fix (Phase 5)
   b. Run QA with ChromeMCP (Phase 6)
   c. Address remaining NOT STARTED stories (II-05 through AF-04) — these are mostly CAO/data integration stories
4. Known tech debt:
   - Zod 3 (@mnm/shared) vs Zod 4 (@json-render) mismatch — handled with `as any` casts in catalog.ts and registry.tsx. Long-term fix: upgrade shared to Zod 4.
5. After each commit: `git -c commit.gpgsign=false commit` then `git push`
6. Use `bun run typecheck` to verify before commits
7. Use `bun run dev` to start the server for visual testing
