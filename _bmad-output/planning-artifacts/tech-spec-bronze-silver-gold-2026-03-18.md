# Tech Spec — Bronze/Silver/Gold Trace Pipeline

> **Date** : 2026-03-18 | **Version** : 2.0 (post-review + user vision alignment)
> **Statut** : Final — ready for implementation
> **Reviews** : Architect (6/10 → fixes applied), Adversarial (4 critical → fixed), QA (60+ AC)
> **Critical fixes** : Applied in commit c28219d (RLS, schema, casts, fire-and-forget)

---

## 1. Vision Produit

### L'user voit Gold → expand Silver → expand Bronze

```
┌─────────────────────────────────────────────────┐
│  GOLD — Vue timeline par défaut                  │
│  Phases intelligentes, scorées, filtrées         │
│  Contextuelles: issue + workflow + agent + prompt │
│  C'est CE QUE L'USER VOIT en premier            │
├─────────────────────────────────────────────────┤
│  ▼ expand une phase gold                         │
│  SILVER — Plus de détails, toujours retravaillé  │
│  Observations groupées, annotées, contextuelles  │
│  Fichiers touchés, décisions, résultats concrets │
├─────────────────────────────────────────────────┤
│  ▼ expand encore                                 │
│  BRONZE — Le JSON brut du LLM block par block    │
│  Stream-json quasi tel quel                      │
│  Pour le debug uniquement                        │
└─────────────────────────────────────────────────┘
```

### Gold est automatique et hiérarchique

Le Gold n'est PAS "l'user clique un bouton et écrit un prompt". C'est :

1. **Auto-généré** — une analyse gold tourne automatiquement quand une trace se complète
2. **Hiérarchique** — le prompt gold est COMPOSÉ de plusieurs couches :
   - **Default global** (admin) — "Résumé livraison : qu'est-ce qui a été fait, résultat, risques"
   - **Per workflow template** — "Pour les pipelines CI/CD, focus sur tests et déploiement"
   - **Per agent** — "Pour l'agent QA, focus sur couverture et bugs trouvés"
   - **Per issue** — quand l'agent travaille sur une issue, le titre + description + AC de l'issue sont injectés dans le prompt gold
   - **Per run** (optionnel) — l'user peut ajouter un focus spécifique
3. **Le résultat gold = des traces enrichies**, pas un bloc markdown :
   - Phases scorées par pertinence (vis-à-vis de l'issue/workflow)
   - Annotations contextuelles par phase
   - Observations clés highlightées
   - Verdict par phase (succès/échec/partiel vs objectif)
   - Liens avec les AC de l'issue

### Exemple concret : Workflow multi-agent

```
WORKFLOW: "Feature Login SSO" — 7 agents, 5 stages

═══════════════════════════════════════════════════
                 GOLD (vue par défaut)
═══════════════════════════════════════════════════

PM Agent     ██████░░░░░░░░░░░░░░░░░░░░  3min  $0.05
  ✓ Epic créé: "SSO SAML/OIDC pour CBA"
  ✓ 4 stories, 12 AC rédigés
  ⚠ Risk: "certificat SAML expiré = 500 silencieux"

         ┌─── parallèle ───┐
PO Agent ░░██████░░░░░░░░░░░░░░░░░░░░  5min  $0.12
  ✓ Story SSO-01 spécifiée (8 AC)
  ⚠ AC-4 vague → reformulé après feedback archi

Lead/Dsgn░░██████░░░░░░░░░░░░░░░░░░░░  4min  $0.08
  ✓ 3 wireframes login SSO
  ✓ Error states designés

Archi    ░░░██████░░░░░░░░░░░░░░░░░░░  6min  $0.15
  ✓ ADR-009: Better Auth SAML > passport-saml
  ⚠ Flag perf: "callback = 2 roundtrips, pré-cache"
         └─────────────────┘

         ┌─── parallèle ───┐
Dev      ░░░░░░░░░████████████░░░░░░░ 12min  $0.34
  ✓ 3 fichiers créés, 5 modifiés (+247/-18)
  ✗ 1er run: 2 failures → fix → 38/38 pass
  📊 Issue #42: AC-1 ✓ AC-2 ✓ AC-3 ✓

QA       ░░░░░░░░░░████████████░░░░░░ 10min  $0.22
  ✓ 42 E2E écrits, 38 pass, 4 skip (need IdP)
  ⚠ Edge case: redirect loop si callback ≠ config
         └─────────────────┘

Review   ░░░░░░░░░░░░░░░░░░░░░░████░░  4min  $0.09
  ✓ 0 bloquant, 2 suggestions (naming, index)

Validator░░░░░░░░░░░░░░░░░░░░░░░░░████  2min  $0.03
  ✓ 12/12 AC epic + 14/14 AC stories
  ✓ APPROVED — merge autorisé

Totaux: 46min │ $1.08 │ 7 agents │ Issue #42 ✓


═══════════════════════════════════════════════════
  ▼ EXPAND "Dev Agent" → SILVER (retravaillé)
═══════════════════════════════════════════════════

Dev Agent — 12min, $0.34, 47 observations

┌─ Phase 1: Compréhension (2min)
│  📖 Read 8 fichiers auth (better-auth.ts, routes/auth.ts...)
│  🔍 Grep "SAML|OIDC" → 3 résultats
│  💭 Décision: Better Auth natif (aligné ADR-009)
│
├─ Phase 2: Implémentation SSO Service (4min)
│  ✏️ Created sso-auth.ts (180 lignes, 4 fonctions)
│  ✏️ Created sso.ts routes (6 endpoints)
│  ✏️ Modified app.ts (+2 lignes mount)
│  📊 Issue #42: AC-1 "login SAML" ✓, AC-2 "login OIDC" ✓
│
├─ Phase 3: Schema + Migration (2min)
│  ✏️ Modified sso_configurations.ts (+7 colonnes)
│  ⚙️ db:generate → OK, db:migrate → OK
│
├─ Phase 4: UI (2min)
│  ✏️ Created SsoLogin.tsx + modified AuthForm.tsx
│
└─ Phase 5: Tests (2min) ⚠ échec puis fix
   ⚙️ 36/38 → fix mock cert → 38/38 ✓


═══════════════════════════════════════════════════
  ▼ EXPAND Phase 2 → BRONZE (JSON brut)
═══════════════════════════════════════════════════

#23 [tool_use] tool:Edit
    input: {"file_path":"src/services/sso-auth.ts","content":"..."}
#24 [tool_result]
    output: "File created successfully"
    is_error: false, duration: 45ms
#25 [text] "Now I need to create the routes..."
#26 [tool_use] tool:Read
    input: {"file_path":"src/routes/auth.ts"}
...
```

---

## 2. Architecture Technique

### Data Flow

```
AGENT RUN (adapter stdout)
     │
     ▼
BRONZE CAPTURE (heartbeat.ts:onLog → bronze-trace-capture.ts)
     │ Fire-and-forget, pas de await
     │ Parse stream-json ligne par ligne
     │ INSERT trace_observations (avec RLS context via transaction)
     │ Chaque chunk = 1 observation brute
     ▼
SILVER ENRICHMENT (silver-trace-enrichment.ts — NOUVEAU)
     │ Déclenché à la completion de la trace
     │ Script déterministe: grouper observations en phases
     │ MAIS influencé par le contexte (issue, workflow, agent type)
     │ Stocke dans traces.phases JSONB
     ▼
GOLD ENRICHMENT (gold-trace-enrichment.ts — NOUVEAU)
     │ Déclenché après silver (async, fire-and-forget)
     │ Prompt composé: default + workflow + agent + issue context
     │ LLM (Haiku) enrichit chaque phase gold:
     │   - Score pertinence vs issue/objectif
     │   - Annotation contextuelle
     │   - Verdict (succès/échec/partiel)
     │   - Lien avec les AC de l'issue
     │ Stocke dans traces.gold JSONB
     ▼
UI (Gold par défaut → Silver en expand → Bronze en expand)
```

### Data Model

**Colonne `phases` JSONB sur `traces`** (silver) — déjà ajoutée :
```typescript
interface TracePhase {
  order: number;
  type: "COMPREHENSION" | "IMPLEMENTATION" | "VERIFICATION" | "COMMUNICATION" | "INITIALIZATION" | "RESULT" | "UNKNOWN";
  name: string;           // "Compréhension du système d'auth"
  startIdx: number;
  endIdx: number;
  observationCount: number;
  summary: string;         // "Read 8 fichiers (src/auth/, src/middleware/)"
}
```

**Colonne `gold` JSONB sur `traces`** (à ajouter) :
```typescript
interface TraceGold {
  generatedAt: string;
  modelUsed: string;
  prompt: string;                    // le prompt composé utilisé
  promptSources: {                   // traçabilité du prompt
    global?: string;
    workflow?: string;
    agent?: string;
    issue?: { id: string; title: string };
    custom?: string;
  };
  phases: TraceGoldPhase[];          // enrichissement par phase
  verdict: "success" | "partial" | "failure";
  verdictReason: string;
  highlights: string[];              // observations clés
  issueAcStatus?: {                  // statut des AC de l'issue
    acId: string;
    label: string;
    status: "met" | "partial" | "not_met" | "unknown";
    evidence?: string;               // observation qui le prouve
  }[];
}

interface TraceGoldPhase {
  phaseOrder: number;                // réf vers silver phase
  relevanceScore: number;            // 0-100 vs objectif
  annotation: string;                // "C'est ici que le bug a été identifié"
  verdict: "success" | "partial" | "failure" | "neutral";
  keyObservationIds: string[];       // IDs des observations importantes
}
```

**Table `gold_prompts`** (à créer) — les prompts gold par scope :
```sql
CREATE TABLE gold_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  scope text NOT NULL,                  -- 'global', 'workflow', 'agent', 'issue'
  scope_id uuid,                        -- FK vers workflow_templates.id, agents.id, ou issues.id (nullable pour global)
  prompt text NOT NULL,                 -- le prompt d'enrichissement
  is_active boolean NOT NULL DEFAULT true,
  created_by text,                      -- userId
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Index pour lookup rapide par scope
CREATE INDEX gold_prompts_scope_idx ON gold_prompts(company_id, scope, scope_id);
```

### Gold Prompt Composition

Quand une trace se complète, le gold prompt est composé ainsi :
```
1. Charger gold_prompt WHERE scope='global' AND company_id=X
2. Si la trace a un workflowInstanceId → charger gold_prompt WHERE scope='workflow' AND scope_id=workflow_template_id
3. Charger gold_prompt WHERE scope='agent' AND scope_id=agent_id
4. Si la trace est liée à une issue → charger l'issue (titre, description, AC) et gold_prompt WHERE scope='issue' AND scope_id=issue_id
5. Composer le prompt final:
   SYSTEM: "Tu enrichis des traces d'agent IA pour MnM..."
   CONTEXT: [global prompt] + [workflow prompt] + [agent prompt]
   ISSUE: [titre] [description] [AC list]
   SILVER DATA: [phases résumées]
   INSTRUCTION: "Pour chaque phase, produis: relevanceScore, annotation, verdict, keyObservationIds. Puis un verdict global et le statut de chaque AC."
```

### API Endpoints

Nouveaux :
```
POST   /api/companies/:id/gold-prompts              — créer un prompt gold
GET    /api/companies/:id/gold-prompts               — lister (filtrer par scope)
PUT    /api/companies/:id/gold-prompts/:promptId     — modifier
DELETE /api/companies/:id/gold-prompts/:promptId     — supprimer
```

Existants enrichis :
```
GET /api/companies/:id/traces/:traceId              — retourne trace + phases (silver) + gold
GET /api/companies/:id/traces/:traceId/observations — retourne les observations bronze
```

---

## 3. Stories Redécoupées

| # | Story | Description | Effort | Depends |
|---|-------|-------------|--------|---------|
| **PIPE-01** | Bronze E2E verification | Tester bronze-trace-capture avec un vrai agent run. Vérifier que les observations apparaissent dans la DB et sur /traces. Fix bugs rencontrés. | S (2h) | — |
| **PIPE-02** | Silver enrichment service | `silver-trace-enrichment.ts` : phase detection déterministe, contextualisée par le type d'agent/workflow. Stocke dans `traces.phases`. Déclenché inline à la completion. | M (4h) | PIPE-01 |
| **PIPE-03** | Gold schema + prompts | Table `gold_prompts`, colonne `traces.gold` JSONB, CRUD API pour les prompts gold par scope (global/workflow/agent/issue). Migration + schema Drizzle. | M (3h) | — |
| **PIPE-04** | Gold enrichment engine | `gold-trace-enrichment.ts` : compose le prompt (global+workflow+agent+issue), appelle Haiku, enrichit chaque phase avec score/annotation/verdict, stocke dans `traces.gold`. Auto-déclenché après silver. Fallback déterministe si pas de LLM. | L (6h) | PIPE-02, PIPE-03 |
| **PIPE-05** | UI Gold timeline (vue par défaut) | TraceDetail affiche le gold par défaut : phases scorées, annotations, verdicts, liens AC. Expand → silver (détails retravaillés). Expand → bronze (JSON brut). | L (6h) | PIPE-04 |
| **PIPE-06** | UI Gold dans RunDetail | Intégrer la vue gold dans le panel agent run (AgentDetail → RunDetail). L'user voit les traces directement quand il regarde un run, sans aller sur /traces. | M (4h) | PIPE-05 |
| **PIPE-07** | UI Gold prompts management | Page settings pour gérer les prompts gold : default global, per workflow, per agent. Preview du prompt composé. | M (3h) | PIPE-03 |
| **PIPE-08** | Workflow-level gold | Quand un workflow multi-agent se termine, générer un gold au niveau workflow (agréger les traces de tous les agents). Timeline multi-agent comme dans l'exemple. | M (4h) | PIPE-04, PIPE-06 |
| **PIPE-09** | QC verification E2E | Lancer un agent, vérifier bronze→silver→gold bout-en-bout. Screenshot Chrome de chaque étape. E2E test. RIEN n'est DONE sans preuve visuelle. | S (2h) | PIPE-08 |

**Effort total** : ~34h (~4-5 jours dev)

**Ordre** :
```
PIPE-01 (bronze E2E) ──→ PIPE-02 (silver) ──→ PIPE-04 (gold engine) ──→ PIPE-05 (UI gold)
                                                      ↑                         │
PIPE-03 (gold schema) ─────────────────────────────────┘                  PIPE-06 (RunDetail)
                                                                                │
                         PIPE-07 (prompts UI) ←── PIPE-03                PIPE-08 (workflow)
                                                                                │
                                                                          PIPE-09 (QC)
```

---

## 4. Acceptance Criteria Clés

- [ ] Un agent run génère automatiquement des observations bronze dans trace_observations
- [ ] La page /traces affiche les traces réelles (pas des seeds manuelles)
- [ ] TraceDetail affiche le GOLD par défaut : phases scorées, annotations, verdicts
- [ ] Expand d'une phase gold → silver : observations groupées, retravaillées
- [ ] Expand du silver → bronze : JSON brut block par block
- [ ] Le gold est auto-généré à la completion (pas de clic manuel)
- [ ] Le gold prompt est composé : default + workflow + agent + issue
- [ ] Les AC de l'issue sont évaluées dans le gold (met/partial/not_met)
- [ ] Le panel RunDetail affiche les traces gold directement
- [ ] Un admin peut configurer les prompts gold par scope
- [ ] Un workflow multi-agent affiche une timeline gold agrégée
- [ ] Tout est vérifié par screenshot Chrome (QC mandatory)

---

## 5. Risques

| Risque | Mitigation |
|--------|------------|
| LLM pas configuré → pas de gold | Fallback déterministe : résumé mécanique sans scores/annotations |
| Gold trop lent (5-10s LLM) | Async fire-and-forget, UI affiche silver en attendant le gold |
| Prompt gold trop long (issue + workflow + agent) | Tronquer à 2000 tokens, prioriser issue context |
| Coût LLM sur chaque trace | Haiku = ~$0.001-0.01 par trace. Cache obligatoire. Rate limit configurable. |
| Gold quality inconsistante | Prompt structuré avec output JSON schema. Retry si parsing fail. |

---

*Tech Spec v2.0 — Post-review, aligned with user vision (Gold=default view, hierarchical prompts, auto-generated, issue-driven)*
