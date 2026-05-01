# Session-Bundle Runs — Plan d'implémentation

> **Pour les agents :** SUB-SKILL REQUIS — `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`. Tâches en checkbox `- [ ]`.

**Goal :** À chaque step gouverné exécuté côté client (MCP / Claude Code), récupérer la session du user à la fin et la matérialiser comme un vrai `heartbeat_run` dans MnM, observable dans la timeline UI au même titre qu'un run server-side. Zéro nouveau tool MCP, zéro endpoint REST d'ingest, zéro complexité ajoutée au harness — réutilisation de `launch_governed_step` / `complete_governed_step` + 1 nouvelle gate canonique.

**Pattern :** À `launch_governed_step`, le serveur crée un `heartbeat_runs` row marqué `executionMode='client'` (worker ne le claim pas) et le lie à la step. À `complete_governed_step`, le client passe le contenu de son fichier de session JSONL dans `artifact.data.session_file`. Une gate canonique obligatoire `session-file-bundled` valide le fichier. Si la gate passe, le serveur parse le JSONL en `trace_observations` + remplit `usageJson` / `resultJson` du run.

**Branche :** `claude/mcp-agent-workflow-integration-LeyYq`. Atomic commit + push par tâche (règle CLAUDE.md).

---

## Questions ouvertes (à valider avec Tom AVANT le code)

Sept points qui changent la forme de l'implémentation. Aucun n'est bloquant pour démarrer mais vaut mieux trancher en amont.

1. **Format de session supporté en V1** — Claude Code uniquement (`.jsonl` Anthropic), ou aussi Codex / Cursor / OpenCode ? **Reco :** Claude Code only en V1, parser versionné (`bundle_format: "claude-code-jsonl-v1"`). Les autres adapters peuvent uploader leur format brut sans parsing — on aura le run + les logs, juste pas la timeline détaillée.

2. **Step sans session** — review humain, gate cron, validation manuelle : pas de session JSONL. Comment ça se comporte ? **Reco :** la gate `session-file-bundled` est **opt-in dans le `workflow.json`** du step (champ `gates: ["session-file-bundled"]`), pas globale. Steps sans cette gate → pas de heartbeat_run client créé.

3. **Limite de taille MCP transport** — un JSONL Claude Code peut faire 50–200MB sur un long step. Le passer dans `artifact.data` en JSON-RPC va saturer. **Reco :** côté client, gzip + base64 (déjà supporté par `runLogStore.logCompressed`). Cap dur à 100MB compressé. Au-delà, fail clair avec hint "split your step or upload via REST" (REST = future feature, pas en V1).

4. **Session incomplète** — quand Claude Code appelle `complete_governed_step`, le tool_use de cet appel n'est pas encore écrit dans le `.jsonl` (il sera écrit après le retour MCP). **Reco :** acceptable. Le parser tolère un tool_use ouvert/manquant en queue. Les 99% du contenu sont là.

5. **Lecture du fichier par Claude Code** — comment Claude Code sait où est son `.jsonl` ? Variable d'env `CLAUDE_PROJECT_DIR` + `CLAUDE_SESSION_ID` ? **À vérifier** — peut-être que la convention est documentée. Si oui, on l'écrit dans la description du tool `complete_governed_step` pour que le harness sache lire le bon fichier.

6. **Idempotence** — si retry réseau de `complete_governed_step`, on parse 2× et duplique les observations ? **Reco :** dédupe sur `(runId, sha256(session_file))`. Si même hash → no-op, on retourne l'état actuel.

7. **Secrets dans la session** — le `.jsonl` contient potentiellement des prompts user avec des secrets, des outputs de tool avec des tokens, etc. On les stocke en clair en DB. **Reco V1 :** documenter le risque dans `complete_governed_step` description + redaction côté serveur de patterns évidents (`sk-...`, `ghp_...`, `xoxb-...`) avant insert dans `trace_observations`. Le filtrage profond peut venir plus tard.

---

## Architecture

```
launch_governed_step (MCP)
   └─→ governedWorkflows.launchStep()
        ├─→ step state = running                        (existant)
        ├─→ if step.gates includes "session-file-bundled":
        │     └─→ heartbeat.createClientRun()           (NEW)
        │           ├─→ INSERT heartbeat_runs (mode=client, status=running)
        │           ├─→ link governed_step_executions.heartbeatRunId
        │           └─→ publish live-event heartbeat.run.started
        └─→ return {agent_name, prompt_context, ...}    (existant)

[client run le step, son .jsonl se remplit]

complete_governed_step (MCP)
   └─→ governedWorkflows.completeStep()
        ├─→ gate-runner évalue les exit gates dont session-file-bundled (NEW)
        │     └─→ valide artifact.data.session_file (présence, JSONL valide, taille)
        │     └─→ FAIL si invalide → step state = failed, run state = failed
        ├─→ if heartbeatRunId set on step:
        │     └─→ heartbeat.finalizeClientRun()         (NEW)
        │           ├─→ parser JSONL → trace_observations
        │           ├─→ rollup usage (tokens, coût, modèles utilisés)
        │           ├─→ runLogStore.write(JSONL gzippé) → logRef
        │           ├─→ UPDATE heartbeat_runs (status, usageJson, resultJson, logRef)
        │           ├─→ trace_service.create(heartbeatRunId)  (déjà câblé Bronze→Silver→Gold)
        │           └─→ publish live-event heartbeat.run.finished
        └─→ step state = succeeded                       (existant)
```

**Garanties :**
- Si la gate échoue → pas de finalize, le run reste `running` orphelin (le tâche cleanup le passe à `failed` après timeout, déjà câblé)
- Si le finalize crash post-gate → run finalisé avec `status=failed`, le step reste `succeeded` (gate a passé). Erreur loggée. À monitorer.
- `claimQueuedRun()` skip `executionMode='client'` → pas de double exécution.

---

## File Map

**Created :**
- `packages/db/src/migrations/0070_session_bundle_runs.sql` — migration
- `packages/db/src/migrations/0070_session_bundle_runs.test.ts` — test migration
- `packages/gate-runner/canonical/session-file-bundled.gate.ts` — nouvelle gate
- `packages/gate-runner/canonical/__tests__/session-file-bundled.gate.test.ts`
- `server/src/services/session-bundle/parse-claude-code-jsonl.ts` — parser
- `server/src/services/session-bundle/__tests__/parse-claude-code-jsonl.test.ts`
- `server/src/services/session-bundle/redact-secrets.ts` — pré-filtre secrets
- `server/src/services/session-bundle/__tests__/redact-secrets.test.ts`
- `server/src/services/session-bundle/index.ts` — orchestration `finalizeClientRun`
- `server/src/services/__tests__/session-bundle.e2e.test.ts` — E2E launch→complete
- `ui/src/components/runs/SessionTimelineView.tsx` — timeline reconstruite

**Modified :**
- `packages/db/src/schema/heartbeat_runs.ts` — `executionMode` + `bundleFormat` + `bundleSha256`
- `packages/db/src/schema/governed_step_executions.ts` — `heartbeatRunId` (nullable FK)
- `server/src/services/heartbeat.ts` — `createClientRun()`, skip mode=client dans `claimQueuedRun()`
- `server/src/services/governed-workflows.ts` — branchement create/finalize client run dans launch/complete
- `server/src/mcp/tools/governed-workflows.tool.ts` — descriptions enrichies (où trouver le session file côté client)
- `packages/gate-runner/canonical/index.ts` — register nouvelle gate
- `ui/src/pages/HeartbeatRunDetail.tsx` — afficher SessionTimelineView si `bundleFormat` présent

**Pas de nouveau tool MCP. Pas de nouvel endpoint REST.**

---

## Task 1 — Migration DB + schémas Drizzle

**Files :**
- Create : `packages/db/src/migrations/0070_session_bundle_runs.sql`
- Create : `packages/db/src/migrations/0070_session_bundle_runs.test.ts`
- Modify : `packages/db/src/schema/heartbeat_runs.ts`
- Modify : `packages/db/src/schema/governed_step_executions.ts`

- [ ] **1.1 — Test migration (failing)**

```ts
// 0070_session_bundle_runs.test.ts
describe("migration 0070 — session bundle runs", () => {
  it("adds execution_mode + bundle_format + bundle_sha256 to heartbeat_runs", async () => {
    const cols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'heartbeat_runs'
        AND column_name IN ('execution_mode','bundle_format','bundle_sha256')
    `);
    expect(cols.rows.length).toBe(3);
  });

  it("adds heartbeat_run_id (nullable FK) to governed_step_executions", async () => {
    const col = await db.execute(sql`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'governed_step_executions' AND column_name = 'heartbeat_run_id'
    `);
    expect(col.rows[0]?.is_nullable).toBe("YES");
  });

  it("creates index on heartbeat_runs(execution_mode, status) WHERE execution_mode='client'", async () => {
    const idx = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'heartbeat_runs' AND indexname = 'heartbeat_runs_client_status_idx'
    `);
    expect(idx.rows.length).toBe(1);
  });
});
```

- [ ] **1.2 — Migration SQL**

```sql
ALTER TABLE "heartbeat_runs"
  ADD COLUMN IF NOT EXISTS "execution_mode" text NOT NULL DEFAULT 'server',
  ADD COLUMN IF NOT EXISTS "bundle_format"  text,
  ADD COLUMN IF NOT EXISTS "bundle_sha256"  text;

ALTER TABLE "heartbeat_runs"
  ADD CONSTRAINT "heartbeat_runs_execution_mode_chk"
  CHECK ("execution_mode" IN ('server','client'));

CREATE INDEX IF NOT EXISTS "heartbeat_runs_client_status_idx"
  ON "heartbeat_runs"("status")
  WHERE "execution_mode" = 'client';

ALTER TABLE "governed_step_executions"
  ADD COLUMN IF NOT EXISTS "heartbeat_run_id" uuid
  REFERENCES "heartbeat_runs"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "governed_step_executions_heartbeat_run_id_idx"
  ON "governed_step_executions"("heartbeat_run_id")
  WHERE "heartbeat_run_id" IS NOT NULL;
```

- [ ] **1.3 — Drizzle schema** : ajouter `executionMode`, `bundleFormat`, `bundleSha256` dans `heartbeat_runs.ts` et `heartbeatRunId` dans `governed_step_executions.ts`

- [ ] **1.4 — Vérifier migration up + test pass + `bun run typecheck`**

- [ ] **1.5 — `gitnexus_detect_changes` puis commit atomique + push**

---

## Task 2 — Gate canonique `session-file-bundled`

**Files :**
- Create : `packages/gate-runner/canonical/session-file-bundled.gate.ts`
- Create : `packages/gate-runner/canonical/__tests__/session-file-bundled.gate.test.ts`
- Modify : `packages/gate-runner/canonical/index.ts`

- [ ] **2.1 — Tests gate (TDD)** : cas pass (JSONL valide ≤ 100MB), cas fail (absent, non-string, JSONL invalide, > 100MB), cas config invalide

- [ ] **2.2 — Implémenter la gate** suivant le template `artifacts-bundle.gate.ts` :
  - Lit `ctx.artifact.data.session_file` (string, JSONL ou base64-gzip)
  - Détecte gzip si commence par `H4sI` (magic base64) → décode + gunzip
  - Valide chaque ligne `JSON.parse`
  - Cap 100MB après décompression
  - Config optionnelle : `min_messages: number` (défaut 1), `max_size_mb: number` (défaut 100)
  - Error codes : `SESSION_FILE_MISSING`, `SESSION_FILE_INVALID_JSONL`, `SESSION_FILE_TOO_LARGE`, `SESSION_FILE_EMPTY`

- [ ] **2.3 — Register dans `canonical/index.ts`**

- [ ] **2.4 — Commit + push**

---

## Task 3 — Parser Claude Code JSONL → trace_observations

**Files :**
- Create : `server/src/services/session-bundle/parse-claude-code-jsonl.ts`
- Create : `server/src/services/session-bundle/__tests__/parse-claude-code-jsonl.test.ts`

- [ ] **3.1 — Tests parser (TDD)** : fixtures avec session Claude Code réelle (capturer un `.jsonl` court), assertions sur :
  - N observations correspondant à N entries
  - `type` mappé : `user` → `event`, `assistant` → `generation`, tool_use/tool_result → `span`
  - `inputTokens`, `outputTokens`, `costUsd`, `model` extraits depuis les champs Anthropic
  - timestamps préservés
  - tool_use ouvert en queue (sans tool_result) → toléré, pas d'erreur

- [ ] **3.2 — Implémenter parser** :
  ```ts
  type ParsedSession = {
    observations: TraceObservationInput[];
    usage: { totalTokensIn: number; totalTokensOut: number; totalCostUsd: number; models: string[] };
    sessionIdAfter: string | null; // dernier sessionId vu
    durationMs: number; // last_ts - first_ts
  };
  function parseClaudeCodeJsonl(content: string, opts: { redactSecrets: boolean }): ParsedSession;
  ```

- [ ] **3.3 — `bun run typecheck` + tests pass**

- [ ] **3.4 — Commit + push**

---

## Task 4 — Redaction secrets

**Files :**
- Create : `server/src/services/session-bundle/redact-secrets.ts`
- Create : `server/src/services/session-bundle/__tests__/redact-secrets.test.ts`

- [ ] **4.1 — Tests** : patterns `sk-[a-zA-Z0-9]{32,}`, `ghp_*`, `gho_*`, `xoxb-*`, `xoxp-*`, AWS access keys (`AKIA*`), JWT (`eyJ*.*.*`), private keys (`-----BEGIN`)

- [ ] **4.2 — Implémenter** : fonction pure `redactSecrets(text: string): string` remplace par `[REDACTED:type]`

- [ ] **4.3 — Brancher depuis le parser quand `opts.redactSecrets=true`**

- [ ] **4.4 — Commit + push**

---

## Task 5 — `heartbeat.createClientRun()` + skip dans `claimQueuedRun()`

**Files :**
- Modify : `server/src/services/heartbeat.ts`
- Test : `server/src/services/__tests__/heartbeat.client-runs.test.ts` (nouveau fichier)

- [ ] **5.1 — Test : `claimQueuedRun` ne claim PAS un run mode=client** (TDD)

- [ ] **5.2 — Test : `createClientRun({agentId, governedStepExecutionId, ...})` insère row + status=running + executionMode=client + publie live-event**

- [ ] **5.3 — `gitnexus_impact({target: "claimQueuedRun", direction: "upstream"})` avant edit**

- [ ] **5.4 — Implémenter `createClientRun()`** : tenant context déjà set en amont, INSERT, publish event `heartbeat.run.started` (réutiliser `publishLiveEvent`)

- [ ] **5.5 — Patcher `claimQueuedRun()` ligne ~1827 : ajouter `WHERE execution_mode = 'server'`**

- [ ] **5.6 — Tests pass + typecheck + commit + push**

---

## Task 6 — `finalizeClientRun()` orchestrateur

**Files :**
- Create : `server/src/services/session-bundle/index.ts`
- Test : `server/src/services/session-bundle/__tests__/finalize.test.ts`

- [ ] **6.1 — Tests** :
  - Idempotent : 2 appels avec même `bundleSha256` → 2e est no-op
  - Parse + insert observations + update heartbeat_run + write logStore + publish event
  - Si parser throw → run status=failed, error_code=BUNDLE_PARSE_FAILED, mais pas de re-throw (le step reste succeeded)

- [ ] **6.2 — Implémenter** :
  ```ts
  async function finalizeClientRun(deps, params: {
    runId: string;
    sessionFile: string; // déjà décompressé par la gate
    bundleFormat: "claude-code-jsonl-v1";
  }): Promise<void>
  ```
  Étapes : compute sha256 → check idempotence → parse → write logStore → INSERT trace + observations → UPDATE heartbeat_run (status, usage, result, log refs, bundle*) → publish event

- [ ] **6.3 — Tests + typecheck + commit + push**

---

## Task 7 — Brancher dans `launchStep` / `completeStep`

**Files :**
- Modify : `server/src/services/governed-workflows.ts`
- Test : `server/src/services/__tests__/governed-workflows.session-bundle.test.ts`

- [ ] **7.1 — Test E2E (TDD)** :
  - Workflow avec step ayant `gates: ["session-file-bundled"]` au exit
  - launchStep → vérifier heartbeat_run créé, mode=client, lié au step
  - completeStep avec session_file vide → fail (gate)
  - completeStep avec session_file valide → succeed, heartbeat_run finalized, observations insérées

- [ ] **7.2 — `gitnexus_impact({target: "launchStep", direction: "upstream"})` + `gitnexus_impact({target: "completeStep", direction: "upstream"})`**

- [ ] **7.3 — Patch `launchStep`** : après transition step→running, si la step déclare `session-file-bundled` dans ses exit gates → `heartbeat.createClientRun()` + lier `step.heartbeatRunId`

- [ ] **7.4 — Patch `completeStep`** : après gates pass, si `step.heartbeatRunId` set → `await sessionBundle.finalizeClientRun(...)` (try/catch, ne pas faire échouer le complete sur erreur de finalize, log + alert)

- [ ] **7.5 — Tests + typecheck + commit + push**

---

## Task 8 — UI : SessionTimelineView

**Files :**
- Create : `ui/src/components/runs/SessionTimelineView.tsx`
- Modify : `ui/src/pages/HeartbeatRunDetail.tsx`

- [ ] **8.1 — Composant** lit `trace_observations` du run, rend une timeline verticale : user message / assistant message (avec tokens + coût) / tool calls (badge type + result collapse). Utiliser composants `ui/src/components/ui/` existants (Card, Badge, Collapsible).

- [ ] **8.2 — Branchement** : si `heartbeat_run.bundleFormat` présent → afficher SessionTimelineView en plus de la vue logs brute

- [ ] **8.3 — Test composant Vitest + Testing Library**

- [ ] **8.4 — Tester en browser sur dev server (CLAUDE.md exige)**

- [ ] **8.5 — Mettre à jour `scripts/parity/data.ts`** : nouveau feature "Session timeline" web=done desktop=missing

- [ ] **8.6 — Commit + push**

---

## Task 9 — Documentation harness + descriptions tools MCP

**Files :**
- Modify : `server/src/mcp/tools/governed-workflows.tool.ts` (descriptions de `launch_governed_step` et `complete_governed_step`)
- Modify : `docs/superpowers/skills/mnm-governed-workflows/SKILL.md` (si existe) ou créer mémo court

- [ ] **9.1 — Enrichir description `launch_governed_step`** : "Si le step déclare la gate `session-file-bundled`, un client run est créé. Le harness DOIT à la complétion lire son fichier `.jsonl` (path = `$CLAUDE_PROJECT_DIR/.claude/projects/<hash>/<session_id>.jsonl`) et le passer dans `complete_governed_step.artifact.data.session_file` (gzip+base64 si > 5MB)."

- [ ] **9.2 — Enrichir description `complete_governed_step`** : format attendu, taille max, conséquence si gate fail

- [ ] **9.3 — Vérifier que c'est utilisable depuis Claude Code lui-même** (Read sur `.jsonl`, Bash gzip+base64)

- [ ] **9.4 — Commit + push**

---

## Task 10 — Tests E2E full lifecycle

**Files :**
- Create : `server/src/services/__tests__/session-bundle.e2e.test.ts`
- Fixture : `server/src/services/__tests__/fixtures/claude-code-session-sample.jsonl`

- [ ] **10.1 — Capturer un vrai `.jsonl`** (session courte de Claude Code) en fixture

- [ ] **10.2 — Test E2E** : créer workflow → register → launchWorkflow → launchStep → completeStep avec fixture JSONL → asserter heartbeat_run finalized + observations en DB + traces générées + live-events publiés

- [ ] **10.3 — `bun run typecheck` global + tests pass**

- [ ] **10.4 — `gitnexus_detect_changes({scope: "all"})` final**

- [ ] **10.5 — Commit + push final**

---

## Risques

| Risque | Impact | Mitigation |
|---|---|---|
| RLS pas appliqué au INSERT observations | HIGH (fuite cross-tenant) | `setTenantContext` déjà fait dans `wrap()` du tool (governed-workflows.tool.ts:91), `finalizeClientRun` reuse la même connexion transactionnelle |
| Taille MCP transport saturée | MED (UX) | Cap 100MB, gzip côté client documenté, error code clair en V1, REST upload en V2 |
| Format JSONL Anthropic change | MED (parsing casse) | Champ `bundleFormat` versionné, parser switch sur version, fallback "log brut visible" |
| Secrets en clair en DB | MED (sécurité) | Redaction patterns évidents en V1, audit avec security team avant prod |
| Run orphelin si crash entre launch et complete | LOW (UX) | Cleanup task existante passe les runs `running` > 24h en `failed` (à vérifier dans heartbeat.ts) |
| Idempotence cassée si client retry sans même hash | LOW | Dédupe par sha256 — si client renvoie un fichier différent on parse à nouveau (rare en prod, surtout test) |

---

## Validation finale

- [ ] **`bun run typecheck`** (13/13 packages)
- [ ] **`bun run test`** (tous les nouveaux tests pass)
- [ ] **`bun run dev`** : créer un workflow test avec gate `session-file-bundled`, lancer step depuis MCP, voir le run apparaître dans l'UI avec timeline reconstruite
- [ ] **`gitnexus_detect_changes`** : scope conforme aux fichiers attendus
- [ ] **`scripts/parity/data.ts`** mis à jour (Task 8.5)
- [ ] **Tom signe off** sur les 7 questions ouvertes en haut du plan
