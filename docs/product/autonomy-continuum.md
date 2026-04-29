# L'Autonomy Continuum

L'autonomie agent n'est pas un *switch* humain-vs-IA. C'est un **continuum** à six niveaux où l'utilisateur choisit son curseur, par tâche, par étape, et où la progression est pilotée par les KPI.

> *L'agent prouve qu'il mérite l'autonomie. L'humain reste juge.*

C'est le pilier **Contrôle** dans son expression la plus structurante. Il imbrique aussi Confiance (les KPI ouvrent la progression) et Transparence (chaque niveau rend visible ce qu'il convient).

## Les six niveaux

| Niveau | Nom | Qui drive | Ce qui se passe |
|--------|-----|-----------|-----------------|
| **L0** | **Manual** | Humain seul | L'humain fait tout, pas d'IA. Le baseline historique. |
| **L1** | **Assisted** | Humain + IA standalone | L'humain utilise Claude Code, Cursor ou Codex en solo. Aucun lien avec MnM. |
| **L2** | **Connected** | Humain pilote, MnM injecte le contexte | L'humain utilise son IDE-IA habituel **avec le MnM MCP Server**. MnM fournit issues, specs, ACs, scoring contracts. L'artefact final est soumis à MnM pour scoring. |
| **L3** | **Guided** | Humain dans le chat MnM | L'humain travaille dans le chat MnM (mode chat dans un workflow step). MnM capture tout (traces Bronze/Silver/Gold, feedbacks, itérations). Full visibility pour les leads. |
| **L4** | **Supervised** | Agent auto + humain en gate | L'agent MnM exécute en autonomie. L'humain review en gate à la fin. Le scoring multi-dimensions informe la décision ; l'humain peut steer / corriger. |
| **L5** | **Autopilot** | Agent autonome | Auto-approve quand toutes les dimensions du scoring sont au-dessus du seuil. L'humain est notifié mais n'intervient pas (ou par exception). |

### Niveau par niveau

#### L0 — Manual

Pas d'IA. Le développeur, le PM, le QA fait son travail comme avant. C'est le point de départ historique. Beaucoup d'équipes y restent encore sur les tâches sensibles ou non-codables. MnM ne pousse personne à le quitter.

#### L1 — Assisted

L'humain utilise un IDE-IA (Claude Code, Cursor, Codex, Copilot) en standalone. MnM est invisible à ce niveau. C'est l'état du marché aujourd'hui pour la majorité des devs IA-équipés. Le problème : aucun partage, aucun feedback objectif, aucun contexte enrichi. Le développeur qui découvre MnM commence presque toujours par L1 puis migre vers L2.

#### L2 — Connected

Le pivot. L'humain garde son IDE préféré et y branche le **MnM MCP Server**. À partir de là, depuis Claude Code (ou tout client MCP), il a accès à :

```
mnm_get_my_tasks()                    → Plan du jour
mnm_get_step_context(step_id)         → Contexte enrichi (issue, specs, ACs, scoring)
mnm_complete_step(step_id, artifact)  → Soumettre l'artifact pour scoring
mnm_submit_review(...)                → Gate review
mnm_launch_auto_agents([...])         → Lancer des agents en parallèle
mnm_steer_agent(run_id, msg)          → Injecter un message
mnm_create_issue(...)                 → Créer une issue depuis Claude Code
mnm_handoff(content)                  → Handoff brainstorm → projet
```

Le développeur reste libre — on **ne flique pas la méthode**. On capture le résultat (l'artefact final) et on le score. Le tracing détaillé est perdu à ce niveau, et c'est un choix philosophique : *résultat > méthode*. C'est aussi à ce niveau que MnM devient une **killer feature standalone** pour les développeurs solos et les freelancers.

#### L3 — Guided

L'humain travaille **dans MnM**. Dans le chat MnM connecté à un workflow step. Tout est tracé : conversations Bronze, phases Silver, analyse Gold automatique. Les leads et les coachs ont visibilité complète sur la session. C'est le niveau idéal pour :

- Les juniors en formation (le continuum *est* un programme de formation).
- Les tâches sensibles (architecture, sécurité, compliance).
- Les sessions de pair-programming agent + humain.
- Toute situation où on veut maximiser le partage et la rétention de connaissance.

#### L4 — Supervised

Bascule majeure. **L'agent exécute seul**. L'humain n'est plus dans la boucle pendant l'exécution — il intervient en **gate review** à la fin. Le scoring multi-dimensions par agents reviewers tourne en parallèle de l'exécution, prépare le verdict. Quand l'agent finit :

- Si tous les scores sont au-dessus du seuil et le profile autorise auto-approve → L4 peut passer en quasi-L5.
- Sinon → gate review humaine obligatoire avec feedback structuré.

Le développeur peut *steer* l'agent en cours d'exécution s'il observe une dérive (`mnm_steer_agent`), ou *interrupt* pour reprendre la main.

#### L5 — Autopilot

**Verrouillé par défaut.** Déblocable uniquement quand les KPI le prouvent (typiquement >90% first-pass rate sur 10+ runs consécutifs, par dimension). Le système refuse de basculer en L5 si les KPI ne le justifient pas — un override explicite est possible mais tracé (*je comprends les risques*).

En L5, l'agent exécute, score, auto-approve, et merge. L'humain est notifié, peut consulter, peut overrider a posteriori — mais n'intervient pas par défaut. C'est le full autopilot.

L5 n'est pas un état stable forcément : si les KPI baissent (drift), MnM alerte automatiquement et propose de redescendre en L4.

## Le principe : un niveau différent par entité

**Chaque entité peut être à un niveau différent.** Step, workflow, agent, équipe — tout peut avoir son propre niveau d'autonomie.

| Entité | Niveau type | Pourquoi |
|--------|-------------|----------|
| `unit-tests-step` | L4 ou L5 | Tâche répétitive, scoring fiable, peu de risque |
| `architecture-decisions-step` | L2 ou L3 | Sensible, contexte large, valeur du jugement humain élevée |
| `security-review-step` | L3 ou L4 (jamais L5 par défaut) | Compliance + responsabilité humaine |
| `api-payments-feature` | L2 sur l'archi, L4 sur les tests | Dimensions différentes par sous-tâche |
| `agent-frontend-dev` | L4 | Confiance acquise par historique |
| `team-platform` | Niveau moyen 3.5 | Mix selon profils et tâches |

C'est une **matrice fine**, pas un curseur global. Les leads peuvent imposer des **minimums** : *"L'étape security review reste TOUJOURS en L3 minimum pour les features critiques."*

## La progression KPI-driven

C'est le coeur de la mécanique. La progression n'est pas une décision politique — c'est une **conséquence des KPI**.

```
KPI faibles (< 70% first-pass)
   → MnM ne propose AUCUNE progression.
   → L'utilisateur peut monter manuellement (avec override), mais l'outil ne pousse pas.

KPI moyens (70–90%)
   → MnM SUGGÈRE le niveau suivant via une notification douce.
   → "Ton first-pass rate sur 'unit-tests' est de 85% sur les 10 derniers runs. Passer en Supervised ?"

KPI hauts (> 90% sur 10+ runs)
   → MnM RECOMMANDE FORTEMENT et met en avant la transition.
   → Le niveau Autopilot reste verrouillé jusqu'à preuve par dimension.

KPI qui baissent après progression
   → ALERTE automatique.
   → Option de redescendre proposée.
   → Capture du contexte de la dégradation pour analyse (Improvement Cockpit).
```

L'utilisateur **choisit toujours**. MnM suggère, alerte, recommande — jamais ne force. Le narratif est essentiel : la progression est une **récompense méritée par les KPI**, pas une obligation managériale.

## Adapter le continuum par task type

Tous les types de tâches ne suivent pas la même trajectoire d'autonomie :

| Type de tâche | Trajectoire typique | Notes |
|---------------|---------------------|-------|
| **Refactoring local** | L2 → L4 → L5 | Scoring déterministe (tests, lint, complexity) |
| **Implémentation feature simple** | L2 → L3 → L4 | Le L3 est utile pour calibrer |
| **Implémentation feature complexe** | L2 → L3 (rarement plus) | Trop de jugement humain |
| **Architecture / decisions structurelles** | L1 → L2 (jamais plus) | L'humain reste juge |
| **Tests unitaires** | L3 → L4 → L5 | Idéal pour l'auto-approve |
| **Tests E2E sensibles** | L3 → L4 | L5 risqué (false positives coûteux) |
| **Review de sécurité** | L3 → L4 | L5 jamais par défaut (responsabilité humaine) |
| **Documentation** | L2 → L4 → L5 | Scoring LLM-as-a-judge sur cohérence + complétude |
| **Compliance / réglementaire** | L3 maximum | Audit trail + signature humaine requise |

Ces trajectoires ne sont pas figées — chaque entreprise les calibre selon son contexte. Le système permet, n'impose pas.

## Le narratif fondamental

Le continuum est volontairement présenté comme un **renversement** :

- ❌ *"Le développeur lâche du contrôle au fur et à mesure"* — c'est faux et anxiogène.
- ✅ *"L'agent prouve qu'il mérite l'autonomie. Le développeur est juge, l'agent est candidat."* — c'est juste et motivant.

La progression d'autonomie est une **récompense** : plus l'agent est bon, plus il est libre, plus le développeur peut investir son énergie ailleurs (architecture, design, valeur produit). C'est l'inverse du discours dystopique de surveillance.

## L'imbrication avec les Quality Profiles

Le continuum d'autonomie ne vit pas seul — il est **conditionné** par le scoring multi-dimensions des Quality Profiles. Un step ne peut passer en L5 que si **toutes les dimensions** de sa Quality Profile attachée sont au-dessus du seuil sur N runs consécutifs.

```
Quality Profile "Backend Dev"
   ├── security:        threshold 7  → 9.1 ✅
   ├── maintainability: threshold 6  → 6.4 ✅
   ├── test-coverage:   threshold 7  → 7.8 ✅
   └── spec-conformity: threshold 7  → 6.9 ❌

→ Passage en Autopilot REFUSÉ (spec-conformity sous le seuil)
→ Reste en Supervised
→ Improvement Cockpit suggère : "Améliorer le skill de l'agent dev sur la lecture des ACs"
```

C'est cette imbrication qui rend la progression **objectivement défendable** auprès du CTO et de la direction. La confiance n'est pas un *feeling* — c'est une métrique.

## Le continuum s'applique aussi aux reviewers

Subtilité importante : le continuum d'autonomie ne concerne pas que les agents *qui exécutent* — il concerne aussi les agents *qui reviewent*.

```
Phase 1 → Humains scorent manuellement (L0/L1 du scoring)
Phase 2 → Agents reviewers proposent, humain valide (L3/L4 du scoring)
Phase 3 → Auto-approve sur les dimensions calibrées (L5 du scoring)
```

C'est ce qui rend la mécanique scalable : on ne dépend pas d'agents reviewers parfaits dès le jour 1. Les humains bootstrappent, MnM apprend, les agents prennent le relais quand ils sont prêts.

## Pour aller plus loin

- La vision globale : [`vision.md`](./vision.md).
- Les piliers et leur imbrication : [`three-pillars.md`](./three-pillars.md).
- Architecture technique : `CLAUDE.md` à la racine du repo.

---

*Autonomy Continuum — Studio Manifeste — 2026.*
