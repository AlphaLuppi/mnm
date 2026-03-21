# Sprint Change Proposal — Spec-Driven Development + Drift Detection Programmatique

**Date** : 2026-03-21
**Auteur** : Gabri (avec Claude)
**Statut** : Draft — en attente validation equipe
**Scope** : MAJEUR — Nouvelle approche testing + drift detection

---

## 1. Resume du changement

### Probleme
Le drift detection actuel dans MnM est LLM-based (drift.ts compare 2 documents via LLM — coute des tokens, perdu au restart). Les 69 tests E2E existants sont des verifications de structure de fichiers (readFile + expect(content).toContain), pas des vrais tests fonctionnels. On ne peut pas prouver qu'une story est implementee correctement.

### Declencheur
- Les tests E2E sont des squelettes statiques sans logique fonctionnelle
- Le drift detection LLM coute des tokens et est non-deterministe
- Besoin d'un mecanisme de validation automatique pour le workflow B2B (chaque role doit pouvoir verifier que son travail est fait)
- Le mouvement Spec-Driven Development (2025-2026) valide cette approche

### Vision cible
Passer a un modele **contract-first Spec-Driven Development** ou :
1. Les AC/FR en Gherkin sont la **source de verite unique**
2. `playwright-bdd` genere les tests E2E depuis les feature files
3. L'implementation reference les AC via des annotations (`@implements AC-RBAC-04`)
4. Un **script statique** (0 token LLM) verifie le drift en temps reel
5. Le workflow MnM impose : Specs (Gherkin) → Agent QA ecrit tests → Agent Dev implemente → Script valide

---

## 2. Principes directeurs

1. **Gherkin = source de verite** — les AC/FR ecrits en Given/When/Then sont le contrat
2. **Drift detection programmatique** — un script statique verifie la couverture AC→tests→impl, sans LLM
3. **Contract-first** — les tests sont ecrits AVANT l'implementation, l'agent Dev doit les faire passer
4. **Annotations comme lien** — l'implementation reference les AC via annotations (pas de nommage rigide)
5. **LLM en complement** — le drift LLM existant reste pour l'analyse semantique, le script statique couvre la couverture structurelle

---

## 3. Architecture technique

### 3.1 Pipeline Spec-Driven

```
Story (RBAC-S04.md)
  |
  | AC1: Manager cannot approve
  | AC2: Admin CAN approve
  | AC3: audit event logged
  |
  v
Feature file Gherkin (e2e/features/RBAC-S04.feature)
  |
  | @AC-RBAC-S04-01
  | Scenario: Manager cannot approve application
  |   Given authenticated manager
  |   When POST /approvals/:id/approve
  |   Then response 403
  |
  v
playwright-bdd genere les tests Playwright
  |
  | e2e/tests/RBAC-S04.spec.ts (auto-genere)
  | → test.describe('@AC-RBAC-S04-01', () => { ... })
  |
  v
Implementation reference les AC
  |
  | /** @implements AC-RBAC-S04-01 */
  | export function requirePermission(key) { ... }
  |
  v
Script de drift (scripts/drift-check.ts)
  |
  | 1. Parse .feature → extraire @AC-XXX tags
  | 2. Grep tests → chaque AC a un test ?
  | 3. Grep impl → chaque AC est reference ?
  | 4. Rapport : couverture, manques, orphelins
  |
  v
Dashboard MnM : pastille par story (vert/rouge/gris)
```

### 3.2 Script de drift statique

```typescript
// scripts/drift-check.ts

// 1. Parse toutes les .feature files → extraire les tags @AC-XXX
const allACs = parseFeatureFiles('e2e/features/**/*.feature');

// 2. Grep les test files → verifier que chaque AC a un test
const testCoverage = grepFiles('e2e/tests/**/*.spec.ts', allACs);

// 3. Grep l'implementation → verifier que chaque AC est reference
const implCoverage = grepFiles('server/src/**/*.ts', allACs, '@implements');

// 4. Generer le rapport
const report = {
  totalACs: allACs.length,
  testedACs: testCoverage.found.length,
  implementedACs: implCoverage.found.length,
  missingTests: testCoverage.missing,    // AC sans test = DRIFT
  missingImpl: implCoverage.missing,     // AC sans impl = DRIFT
  orphanTests: testCoverage.orphans,     // Tests sans AC = ORPHELIN
  orphanImpl: implCoverage.orphans,      // @implements sans AC = ORPHELIN
};
```

### 3.3 Convention de nommage

```
Tags AC :     @AC-{EPIC}-{STORY}-{NUM}     ex: @AC-RBAC-S04-01
Tags FR :     @FR-{EPIC}-{NUM}              ex: @FR-ORCH-01
Feature file : e2e/features/{STORY-ID}.feature
Test file :    e2e/tests/{STORY-ID}.spec.ts  (auto-genere par playwright-bdd)
Annotation :   /** @implements AC-RBAC-S04-01 */
```

### 3.4 Stack technique

| Composant | Outil | Maturite |
|---|---|---|
| Feature files | Gherkin (Cucumber standard) | 15+ ans |
| Test runner | playwright-bdd (v8.5, 638 stars) | Mature |
| E2E automation | Playwright (deja en place) | Mature |
| Script de drift | Custom TypeScript (scripts/drift-check.ts) | A creer |
| Annotations impl | JSDoc `@implements` | Standard |
| Living documentation | Rapport HTML auto-genere | A creer |

---

## 4. Impact sur les Epics existants

### 4.1 Epic DRIFT — Drift Detection (MODIFIE)

**Avant** : 3 stories LLM-based (drift.ts, drift monitor, UI diff)
**Apres** : Le drift programmatique devient le mecanisme PRINCIPAL. Le LLM reste en complement pour l'analyse semantique.

| Story | Avant | Apres |
|---|---|---|
| DRIFT-S01 | Fix drift en memoire → DB | Garde : persister les rapports de drift programmatique aussi |
| DRIFT-S02 | Drift Monitor LLM | **Split** : drift programmatique (script statique) + drift semantique (LLM, optionnel) |
| DRIFT-S03 | UI Diff visuel | **Enrichi** : afficher les manques AC→test→impl dans la UI en plus du diff semantique |

### 4.2 Nouvel Epic SDD — Spec-Driven Development

| Story | Description | Effort | Bloque par |
|---|---|---|---|
| **SDD-S01** | Setup playwright-bdd dans le projet. Config, integration avec Playwright existant. | S (2 SP) | Aucun |
| **SDD-S02** | Migration des 69 stories en feature files Gherkin. Tags @AC-XXX sur chaque scenario. | M (5 SP) | SDD-S01 |
| **SDD-S03** | Script drift-check.ts — parse features, grep tests, grep impl, genere rapport JSON. | M (3 SP) | SDD-S02 |
| **SDD-S04** | Convention @implements dans le code existant. Annoter les methodes existantes avec les AC qu'elles implementent. | M (5 SP) | SDD-S02 |
| **SDD-S05** | Integration CI — drift-check.ts tourne dans la pipeline, bloque si couverture < seuil. | S (2 SP) | SDD-S03, TECH-08 |
| **SDD-S06** | API + UI pastille par story — endpoint /stories/:id/drift-status, badge vert/rouge/gris dans le dashboard. | M (5 SP) | SDD-S03 |
| **SDD-S07** | Workflow MnM enforced — le workflow impose Specs → Tests (agent QA) → Impl (agent Dev) → Drift check. | M (3 SP) | SDD-S03, ORCH-S01 |
| **SDD-S08** | Agent QA generation — l'agent QA genere les feature files Gherkin depuis les stories (claude -p). | M (5 SP) | SDD-S01, SDD-S02 |

**Effort total Epic SDD : ~30 SP, ~3-4 semaines**

### 4.3 Impact sur Epic ORCH — Orchestrateur

- **ORCH-S02 (WorkflowEnforcer)** : doit supporter une etape "Drift Check" obligatoire avant de marquer une story "done". Le script drift-check.ts est appele comme gate de sortie.

### 4.4 Impact sur le PRD

- **FR19-FR24** (Drift Detection) : enrichir avec "drift programmatique basee sur la couverture AC → tests → implementation"
- **Nouveau FR** : "Le systeme peut verifier automatiquement, sans LLM, que chaque AC a un test E2E et une implementation correspondante"

---

## 5. Sequence d'implementation

### Phase 1 — Setup (1 semaine)
- **SDD-S01** : installer playwright-bdd, configurer l'integration
- Convertir 2-3 stories pilotes en .feature Gherkin (ex: RBAC-S01, MU-S01)
- Valider que playwright-bdd genere et execute les tests correctement

### Phase 2 — Migration (2 semaines)
- **SDD-S02** : migrer les 69 stories en feature files Gherkin
- **SDD-S04** : annoter le code existant avec @implements
- **SDD-S08** : utiliser Claude Haiku pour accelerer la generation des features files (95% acceptation selon la recherche)

### Phase 3 — Script + CI (1 semaine)
- **SDD-S03** : creer drift-check.ts
- **SDD-S05** : integrer dans la CI (GitHub Actions)
- Premier rapport de couverture global

### Phase 4 — UI + Workflow (1-2 semaines)
- **SDD-S06** : API et pastille par story dans la UI
- **SDD-S07** : integration dans le workflow MnM (gate de sortie)

**Total : ~5-6 semaines**, parallelisable avec le reste du dev B2B.

---

## 6. Relation avec le pipeline existant

### Ce qui RESTE inchange
- Pipeline Bronze → Silver → Gold (observabilite agents) — pas touche
- E2E Playwright infrastructure (59 tests browser existants) — enrichie, pas remplacee
- Heartbeat / adapters — pas touche

### Ce qui CHANGE
- Drift detection : LLM → programmatique (principal) + LLM (complement)
- Tests E2E : file-content matching → vrais tests fonctionnels via Gherkin
- Workflow dev : code-first → spec-first (Gherkin avant impl)

### Ce qui est NOUVEAU
- Feature files Gherkin (e2e/features/)
- playwright-bdd comme generateur de tests
- drift-check.ts (script statique)
- Annotations @implements dans le code
- Pastilles de couverture par story dans la UI

---

## 7. Risques et mitigations

| Risque | Probabilite | Impact | Mitigation |
|---|---|---|---|
| **Overhead migration** — 69 stories a convertir en Gherkin | Moyenne | Retard 1-2 sem | Utiliser Claude Haiku pour generer 80% des feature files (AutoUAT : 95% acceptation) |
| **Granularite AC → impl** — 1 AC peut correspondre a N methodes | Haute | Mapping imparfait | Utiliser annotations multiples : une methode peut avoir plusieurs @implements |
| **Resistance dev** — nommage/annotations imposes | Moyenne | Adoption lente | Phase pilote sur 3 stories, puis generaliser si ca marche |
| **playwright-bdd breaking changes** — dependance externe | Faible | Tests cassent | Pin version, tests d'integration dans la CI |
| **Feature files stale** — les specs evoluent mais les features pas | Moyenne | Drift non-detecte | Le script drift-check.ts detecte aussi les features orphelines |

---

## 8. Points ouverts pour discussion avec Tom

1. **playwright-bdd vs Playwright pur** — Tom a deja 59 tests Playwright. Est-ce qu'on migre tout ou on fait cohabiter les deux ?
2. **Granularite des annotations** — @implements au niveau methode, classe, ou fichier ?
3. **CI gate** — le drift check bloque le merge ou juste warn ?
4. **Feature files : qui les ecrit ?** — Agent QA (Claude Haiku) genere, humain valide ? Ou humain ecrit, agent valide ?
5. **Cohabitation drift LLM + drift programmatique** — meme UI ou vues separees ?

---

## 9. Classification du changement

**Scope : MAJEUR** — Nouvelle approche testing et drift detection

**Handoff** :
- **Tom** : Evaluer playwright-bdd, valider la cohabitation avec les tests existants, proposer l'archi technique du script drift-check.ts
- **Gabri** : Valider la vision, prioriser les stories SDD, definir le scope du pilote
- **Ensemble** : Trancher les 5 points ouverts, integrer SDD dans le sprint planning

**Documents associes** :
- Deep research : playwright-bdd, BDD drift detection, SDD movement
- Brainstorming Gab : `_bmad-output/brainstorming/idees-vrac-gab-2026-03-21.md`
- Sprint Change Proposal B2B : `sprint-change-proposal-2026-03-12.md`
