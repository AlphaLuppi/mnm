---
name: gitnexus
description: Workflow GitNexus pour MnM — impact analysis avant édition, detect_changes avant commit, refactor avec rename. Auto-loaded quand tu édites du code.
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs}"
  - "server/**"
  - "ui/src/**"
  - "packages/**"
  - "apps/**"
---

# GitNexus — Code Intelligence pour MnM

MnM est indexé par GitNexus comme `mnm` (8752 symbols, 21008 relations, 300 execution flows). Utilise les tools MCP `gitnexus_*` pour comprendre le code, mesurer le blast radius et naviguer en sécurité avant toute édition.

> Si un tool prévient que l'index est stale → `npx gitnexus analyze` dans le terminal. Pour préserver les embeddings : `npx gitnexus analyze --embeddings` (vérifier `.gitnexus/meta.json` → `stats.embeddings`). Le hook PostToolUse Claude Code re-analyze automatiquement après `git commit` / `git merge`.

## Always do

- **MUST run `gitnexus_impact` avant d'éditer un symbol** — `gitnexus_impact({target: "symbolName", direction: "upstream"})` puis report blast radius (callers directs, processes affectés, risk level) à l'utilisateur.
- **MUST run `gitnexus_detect_changes()` avant chaque commit** — vérifier que les changements ne touchent que les symbols et execution flows attendus.
- **MUST avertir** si l'impact analysis retourne risk HIGH ou CRITICAL avant de procéder.
- **Explore via `gitnexus_query`** au lieu de grep — `gitnexus_query({query: "concept"})` retourne des execution flows groupés par process et rankés par pertinence.
- **360° sur un symbol** — `gitnexus_context({name: "symbolName"})` pour callers, callees, et participation aux execution flows.

## Never do

- NEVER éditer une fonction / classe / méthode sans avoir lancé `gitnexus_impact` dessus.
- NEVER ignorer un warning HIGH ou CRITICAL.
- NEVER renommer en find-and-replace — utiliser `gitnexus_rename` qui comprend le call graph.
- NEVER commiter sans `gitnexus_detect_changes()` pour vérifier le scope.

## Workflow debug (3 étapes)

1. `gitnexus_query({query: "<error or symptom>"})` — trouver les execution flows liés.
2. `gitnexus_context({name: "<suspect function>"})` — voir tous les callers/callees + processes.
3. **READ** `gitnexus://repo/mnm/process/{processName}` — tracer le flow complet step-by-step.
   - Régression sur une branche : `gitnexus_detect_changes({scope: "compare", base_ref: "master"})`.

## Workflow refactor

- **Renaming** — `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` d'abord. Review : graph edits = safe, ast_search edits = vérifier manuellement (refs dynamiques type config.json). Puis relancer avec `dry_run: false`.
- **Extract / split** — `gitnexus_context({name: "target"})` (refs entrantes/sortantes) + `gitnexus_impact({target, direction: "upstream"})` (callers externes) avant de bouger le code.
- **Après tout refactor** — `gitnexus_detect_changes({scope: "all"})` pour confirmer que seuls les fichiers attendus ont bougé.

## Risk levels

| Depth | Sens                              | Action                          |
| ----- | --------------------------------- | ------------------------------- |
| d=1   | **WILL BREAK** — callers directs  | MUST update                     |
| d=2   | LIKELY AFFECTED — deps indirectes | Tester                          |
| d=3   | MAY NEED TESTING — transitif      | Tester si critical path         |

| Affected                               | Risk     |
| -------------------------------------- | -------- |
| <5 symbols, peu de processes           | LOW      |
| 5–15 symbols, 2–5 processes            | MEDIUM   |
| >15 symbols ou nombreux processes      | HIGH     |
| Critical path (auth, traces, RLS, RBAC) | CRITICAL |

## Tools quick reference

| Tool             | Quand l'utiliser                       | Exemple                                                                    |
| ---------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `query`          | Trouver du code par concept            | `gitnexus_query({query: "auth validation"})`                               |
| `context`        | Vue 360° sur un symbol                 | `gitnexus_context({name: "validateUser"})`                                 |
| `impact`         | Blast radius avant éditer              | `gitnexus_impact({target: "X", direction: "upstream"})`                    |
| `detect_changes` | Pre-commit scope check                 | `gitnexus_detect_changes({scope: "staged"})`                               |
| `rename`         | Rename multi-fichiers safe             | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})`    |
| `cypher`         | Queries graph custom                   | `gitnexus_cypher({query: "MATCH ..."})`                                    |

## Resources MCP

| Resource                                       | Utilisation                            |
| ---------------------------------------------- | -------------------------------------- |
| `gitnexus://repo/mnm/context`                  | Stats codebase, check freshness        |
| `gitnexus://repo/mnm/clusters`                 | Functional areas                       |
| `gitnexus://repo/mnm/processes`                | All execution flows                    |
| `gitnexus://repo/mnm/process/{name}`           | Trace step-by-step d'un flow           |
| `gitnexus://repo/mnm/schema`                   | Graph schema (avant `cypher`)          |

## Self-check avant de finir

Avant de marquer une modif code DONE :

1. `gitnexus_impact` lancé sur tous les symbols modifiés.
2. Aucun warning HIGH/CRITICAL ignoré.
3. `gitnexus_detect_changes()` confirme que le scope correspond à ce qui était prévu.
4. Tous les dépendants d=1 (WILL BREAK) ont été mis à jour.

## Pour aller plus loin

Le détail par cas d'usage est dans les skills `.claude/skills/gitnexus/*` :

| Tâche                                            | Skill                          |
| ------------------------------------------------ | ------------------------------ |
| Comprendre l'archi / "How does X work?"          | `gitnexus-exploring`           |
| Blast radius / "What breaks if I change X?"      | `gitnexus-impact-analysis`     |
| Trace de bug / "Why is X failing?"               | `gitnexus-debugging`           |
| Rename / extract / split / refactor              | `gitnexus-refactoring`         |
| Tools, resources, schema reference               | `gitnexus-guide`               |
| Index, status, clean, wiki CLI commands          | `gitnexus-cli`                 |
