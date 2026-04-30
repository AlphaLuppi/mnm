# Upstream-watch process

> **Companion doc** : `docs/superpowers/upstream-watch.md` (the live tracker).
> **Plan source** : `docs/superpowers/plans/2026-04-28-paperclip-upstream-merge.md` Phase 6.
> **Tooling** : `scripts/upstream-watch.mjs` + `bun run upstream-watch`.

This doc explains **how to do the monthly Paperclip upstream review** —
who runs it, what cadence, how to use the helper script, and how the
verdict makes it into the codebase.

---

## TL;DR

```bash
# 1. Run the helper. Default mode = print a markdown patch to stdout.
bun run upstream-watch

# 2. Or write a draft batch plan instead:
bun run upstream-watch -- --mode=plan

# 3. Or emit raw JSON for tooling:
bun run upstream-watch -- --mode=json
```

The script:

1. Runs `git fetch upstream --prune --tags`.
2. Reads `docs/superpowers/upstream-watch.md` and finds the last
   "Dernier audit complet" date.
3. Calls `gh api repos/paperclipai/paperclip/releases?per_page=20`.
4. Filters to releases published **strictly after** that date.
5. Builds a triage skeleton (one section per release, one row per PR
   referenced in the release body, default verdict = `TODO triage`).

The script never modifies the upstream-watch tracker — it produces a
patch that a human (or a follow-up agent) reviews and applies.

---

## Cadence

- **Monthly** by default. Dernier audit + 28 days = next audit due.
- **Ad hoc** when an upstream CVE is announced or Tom flags a feature.
- Treat the cadence as a soft deadline — if there are zero releases,
  the script prints an empty section and we just bump the date.

The tracker has a "Prochain audit" cell pointing to the next due date,
keep it honest.

---

## Who runs it

- **Claude session** (autonomous) is allowed to run the script and
  produce the patch. It must NOT push verdicts to upstream-watch.md
  without human review unless the verdict is mechanical (e.g. "PR
  references no MnM file → SKIP N/A").
- **Tom** validates verdicts and merges the patch.
- The script may also be wired to `/schedule` for an automated monthly
  agent run that opens a draft PR — Tom validates / adjusts / merges.

---

## Verdict vocabulary

Reuse the legend already in `upstream-watch.md` for consistency:

| Verdict | Meaning |
|---|---|
| `port` | Cherry-pick or re-implement on a feature branch in MnM |
| `skip` (with reason) | Permanently rejected — design diverges or N/A |
| `re-implement` | We agree with the goal but will design from scratch |
| `pattern-steal` | We borrow the idea / table layout / interface but write our own code |
| `defer` | Tracked but not for this cycle; revisit at next audit |
| `TODO triage` | Default the script writes; replace with one of the above |

---

## Workflow per audit

1. **Run the script** in the active branch (or a brand new
   `feat/upstream-watch-YYYY-MM` branch):

   ```bash
   bun run upstream-watch -- --mode=plan
   # writes docs/superpowers/plans/YYYY-MM-DD-upstream-watch-batch.md
   ```

2. **Triage** every PR row in the generated plan. For each:
   - Read the PR description / linked release notes / diff.
   - Decide a verdict.
   - If `port` → either inline cherry-pick instructions or open a
     dedicated plan in `docs/superpowers/plans/` and link it.

3. **Merge** the verdicts into `docs/superpowers/upstream-watch.md` —
   add a new dated section, update the "Dernier audit complet" row,
   bump "Prochain audit".

4. **Open issues / PRs** for any CRITICAL / HIGH security finding so
   they don't get lost in a long-running batch.

5. **Ship the doc-only PR** for the audit (no code changes), then
   follow with one PR per `port` action.

---

## Script flags

| Flag | What it does |
|---|---|
| `--mode=patch` (default) | Print a markdown patch to stdout |
| `--mode=plan` | Write a `docs/superpowers/plans/YYYY-MM-DD-upstream-watch-batch.md` and print the path |
| `--mode=json` | Emit raw JSON (for tooling / automated agents) |
| `--since=YYYY-MM-DD` | Override the "Dernier audit complet" date (replay / debug) |
| `--dry-run` | Skip `git fetch upstream` (offline) |
| `--no-gh` | Skip `gh api`, read from `scripts/upstream-watch.fixture.json` instead — used by tests |
| `--output=FILE` | Write to FILE instead of stdout (patch/plan only) |
| `--help` | Print the script's docstring |

The fixture file lets us test the parser & renderer offline without
hitting GitHub. CI can run `bun run upstream-watch -- --no-gh
--mode=json` to assert the script doesn't crash.

---

## Tests

`scripts/upstream-watch.test.mjs` (vitest project = `scripts`) covers:

- `parseLastAuditDate` permissive markdown parsing
- `extractPrNumbers` deduplication / sorting
- `filterReleasesSince` strict-after semantics
- `extractPrBlurb` GitHub auto-generated release-notes pattern
- `sanitizeMarkdownCell` pipe + newline escaping
- `renderRelease` / `renderPatch` / `renderPlan` shape

Run them with:

```bash
bunx vitest --project=scripts run scripts/upstream-watch.test.mjs
```

---

## Future automation

Phase 6 of the paperclip-upstream-merge plan (now landed) lists this
process as automatable via `/schedule`. The next step is to wire a
recurring agent (1st of every month) that:

1. Spawns a `feat/upstream-watch-YYYY-MM` branch.
2. Runs `bun run upstream-watch -- --mode=plan`.
3. Stages & commits the generated plan.
4. Opens a draft PR pinging Tom.

Until that's wired, run the script manually — the monthly cadence is
already low-friction.
