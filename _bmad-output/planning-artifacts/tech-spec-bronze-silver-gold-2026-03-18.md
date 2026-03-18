# Tech Spec — Bronze/Silver/Gold Trace Pipeline

> **Date** : 2026-03-18 | **Statut** : Final
> **Auteur** : PM (BMAD Tech Spec workflow)
> **Scope** : Level 1 (~7 stories)
> **Prerequis** : Tables traces/observations existent, bronze-trace-capture.ts ecrit, lens-analysis.ts ecrit

---

## 1. Probleme

Les traces dans MnM ne fonctionnent pas bout en bout :

1. **Bronze** : le middleware `bronze-trace-capture.ts` capture les chunks stdout en temps reel dans `onLog` (heartbeat.ts) mais n'a **jamais ete teste** avec un vrai agent run
2. **Silver** : **n'existe pas**. 200+ observations brutes par run, personne ne veut lire ca. Il faut regrouper les tool calls en phases semantiques (COMPREHENSION, IMPLEMENTATION, VERIFICATION...)
3. **Gold** : le `lens-analysis.ts` existe en code mais n'est **connecte a rien**. L'UI `TraceDetail.tsx` a un LensSelector mais le backend ne repond pas. Aucune analyse personnalisee ne fonctionne.
4. **Integration UI** : les traces sont sur une page separee `/traces` mais elles devraient aussi etre visibles directement dans le **panel agent run** (AgentDetail.tsx → RunDetail)

## 2. Solution

Pipeline Bronze → Silver → Gold avec intelligence progressive :

```
AGENT RUN (adapter stdout)
     │
     ▼
BRONZE CAPTURE (bronze-trace-capture.ts dans heartbeat.ts:onLog)
     │ Chaque chunk stdout JSON-parsé → INSERT trace_observations
     │ Trace auto-créée au start, auto-complétée au finish
     ▼
SILVER ENRICHMENT (nouveau: silver-trace-enrichment.ts)
     │ Job déclenché à la completion de la trace
     │ Script déterministe: grouper tool calls en phases
     │ Optionnel: Haiku pour nommer les phases en langage naturel
     ▼
GOLD ANALYSIS (lens-analysis.ts — existe, à connecter)
     │ L'user sélectionne ou écrit une lens dans l'UI
     │ LLM analyse les observations silver à travers la lens
     │ Résultat markdown personnalisé, caché
     ▼
UI (Traces.tsx, TraceDetail.tsx, RunDetail intégration)
     Liste des traces, drill-down, lens selector, raw observations
     + Intégration dans le panel agent run existant
```

## 3. Requirements

- **R1**: Bronze capture fonctionne E2E — un agent run genere des traces dans la DB
- **R2**: Les traces s'affichent sur `/traces` avec les bonnes donnees (pas des seeds manuelles)
- **R3**: Silver enrichment groupe les observations en phases (deterministe, sans LLM)
- **R4**: Le TraceDetail affiche les phases silver en plus du raw bronze
- **R5**: Gold lens analysis fonctionne — un user peut ecrire un prompt et recevoir une analyse LLM
- **R6**: Les traces sont visibles dans le panel agent run (AgentDetail → RunDetail)
- **R7**: Workflow-level traces (aggreger les traces d'un workflow multi-agent) — story separee

**Out of scope** :
- BullMQ job queue (pas necessaire pour MVP — le silver peut tourner inline a la completion)
- Cluster mode / Redis pub/sub (SCALE stories futures)
- Thinking block parsing (la source de verite = actions, pas le thinking)

## 4. Technical Approach

### Stack
- **Backend** : Express + Drizzle ORM (existant)
- **DB** : PostgreSQL 17 — tables traces, trace_observations, trace_lenses, trace_lens_results (existent)
- **LLM** : Anthropic API (Haiku pour silver, Sonnet pour gold) via MNM_LLM_SUMMARY_ENDPOINT
- **Frontend** : React 18 + shadcn/ui + TanStack Query (existant)

### Architecture Bronze→Silver→Gold

```
┌─────────────────────────────────────────────────────────┐
│                    HEARTBEAT SERVICE                     │
│                                                         │
│  executeRun() → onLog(stdout, chunk) ──┐                │
│                                         │                │
│  ┌──────────────────────────────────────▼──────────────┐ │
│  │  bronze-trace-capture.ts                            │ │
│  │  - startCapture(runId) → CREATE trace               │ │
│  │  - ingestChunk(runId, chunk) → parse JSON           │ │
│  │    → INSERT trace_observations (type, name, I/O)    │ │
│  │  - completeCapture(runId) → UPDATE trace totals     │ │
│  └─────────────────────────────────────────────────────┘ │
│                         │ on complete                     │
│  ┌──────────────────────▼──────────────────────────────┐ │
│  │  silver-trace-enrichment.ts (NOUVEAU)               │ │
│  │  - enrichTrace(traceId)                             │ │
│  │    1. Load all bronze observations                  │ │
│  │    2. Group consecutive same-type into phases        │ │
│  │    3. Compute phase summaries (deterministic)        │ │
│  │    4. Optional: Haiku for natural language names     │ │
│  │    5. UPDATE trace with phases JSONB                 │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                       GOLD LAYER                        │
│                                                         │
│  lens-analysis.ts (EXISTE, a connecter)                │
│  - User selectionne une lens dans l'UI                 │
│  - analyze(traceId, lensId)                            │
│    1. Load silver-enriched observations                │
│    2. Build context (phases + summaries)               │
│    3. Send to LLM with user's prompt                   │
│    4. Cache result in trace_lens_results               │
│  - Already handles: pre-filtering, cost estimation,     │
│    structured output, streaming                        │
└─────────────────────────────────────────────────────────┘
```

### Data Model Updates

**Colonne a ajouter sur `traces`** :
```sql
ALTER TABLE traces ADD COLUMN phases JSONB;
-- Structure: [{order, type, name, startIdx, endIdx, observationCount, summary}]
```

**Types de phases** (silver) :
- `COMPREHENSION` — lectures de fichiers, grep, exploration
- `IMPLEMENTATION` — edits, writes, creation de fichiers
- `VERIFICATION` — bash commands (tests, build, lint)
- `COMMUNICATION` — text blocks, responses
- `INITIALIZATION` — init events, model setup
- `UNKNOWN` — ce qui ne rentre dans aucune categorie

### Phase Detection Algorithm (Silver — deterministic)

```
Pour chaque observation dans l'ordre chronologique :
  Si le type + name est different du precedent :
    → Nouvelle phase
  Si meme type mais gap > 30s :
    → Nouvelle phase
  Sinon :
    → Meme phase (extend)

Phase type mapping :
  tool:Read, tool:Grep, tool:Glob → COMPREHENSION
  tool:Edit, tool:Write            → IMPLEMENTATION
  tool:Bash                         → VERIFICATION (si contient test/build/lint)
  tool:Bash                         → IMPLEMENTATION (sinon)
  response, thinking                → COMMUNICATION
  init, run-result                  → INITIALIZATION / RESULT

Phase summary (deterministic) :
  "Read 14 files (src/auth/, src/middleware/)"
  "Modified 3 files (+47/-12 lines)"
  "Ran tests: 42 passed, 0 failed"
```

### API Updates

**Aucun nouveau endpoint** — les endpoints existants suffisent :
- `GET /companies/:id/traces` — retourne les traces avec phases dans le JSON
- `GET /companies/:id/traces/:traceId` — retourne trace + observations tree
- `POST /companies/:id/trace-lenses/:lensId/analyze/:traceId` — lance analyse gold

**Integration RunDetail** — le frontend fait un query supplementaire :
- Si le heartbeat run a un `traceId` lié, le RunDetail charge les phases et les affiche

## 5. Stories d'implementation

| # | Story | Description | Effort | Depends |
|---|-------|-------------|--------|---------|
| **PIPE-01** | Fix bronze E2E | Tester bronze-trace-capture avec un vrai agent run. Debug, fix, verifier que les observations apparaissent dans la DB et dans l'UI `/traces`. | S (2h) | — |
| **PIPE-02** | Silver enrichment service | Creer `silver-trace-enrichment.ts`. Phase detection deterministe. Appele inline a la completion de la trace. Stocker les phases dans `traces.phases` JSONB. | M (4h) | PIPE-01 |
| **PIPE-03** | Silver UI — phases dans TraceDetail | Afficher les phases silver dans TraceDetail.tsx : cards collapsibles par phase, resume deterministe, badge de type. Le raw est toujours en drill-down. | M (4h) | PIPE-02 |
| **PIPE-04** | Gold — connecter lens analysis | Brancher le LensSelector dans TraceDetail au backend lens-analysis.ts. Tester avec un vrai prompt. Verifier le cache, le cout estime, le rendu markdown. | M (4h) | PIPE-02 |
| **PIPE-05** | Integration RunDetail | Dans AgentDetail.tsx → RunDetail, ajouter un onglet/section "Trace" qui charge les phases et observations du run via son heartbeatRunId lié. | M (4h) | PIPE-03 |
| **PIPE-06** | Silver — Haiku naming (optionnel) | Appeler Haiku pour nommer les phases en langage naturel ("Comprehension du systeme d'auth" au lieu de "COMPREHENSION — 14 reads"). Config par env var. | S (2h) | PIPE-02 |
| **PIPE-07** | QC verification bout-en-bout | Lancer un agent, verifier bronze→silver→gold, screenshot de chaque etape, E2E test. Ne rien marquer DONE sans preuve visuelle. | S (2h) | PIPE-05 |

**Ordre d'implementation** : PIPE-01 → PIPE-02 → PIPE-03 + PIPE-04 (parallele) → PIPE-05 → PIPE-06 → PIPE-07

**Effort total** : ~22h (~3 jours dev)

## 6. Acceptance Criteria

- [ ] Un agent run genere automatiquement des bronze observations dans `trace_observations`
- [ ] La page `/traces` affiche les traces reelles (pas des seeds)
- [ ] Le TraceDetail montre les phases silver (cards collapsibles) + raw en drill-down
- [ ] Un user peut ecrire un prompt d'analyse et recevoir un resultat gold markdown
- [ ] Le panel RunDetail (AgentDetail) affiche les traces du run en cours/termine
- [ ] Le cout LLM est estime avant lancement et affiche a l'user
- [ ] Tout est verifie par screenshot (QC agent mandatory)

## 7. NFR

- **Performance** : l'insertion bronze ne doit pas ralentir l'agent run (async, fire-and-forget avec catch)
- **Cout** : silver deterministe = $0. Gold Haiku = ~$0.001-0.01 par analyse. Caching obligatoire.
- **Securite** : RLS sur toutes les tables trace (deja en place). Pas de data leak cross-company.

## 8. Risques

| Risque | Prob | Impact | Mitigation |
|--------|------|--------|------------|
| Bronze ralentit les agent runs | Moyenne | Eleve | Fire-and-forget avec try/catch, pas de await bloquant |
| Le stream-json des adapters n'est pas du JSON valide ligne par ligne | Haute | Moyen | Le bronze buffer deja les lignes partielles. Tester avec claude-local real output |
| L'env var LLM pas configuree → gold ne marche pas | Haute | Moyen | Fallback: "LLM non configure, seul le resume deterministe est disponible" |
| Phases silver trop granulaires ou pas assez | Moyenne | Faible | Parametrable (gap threshold, min observations per phase). Iterer avec l'user |

---

*Tech Spec generee par BMAD Tech Spec workflow. Ready for sprint planning.*
