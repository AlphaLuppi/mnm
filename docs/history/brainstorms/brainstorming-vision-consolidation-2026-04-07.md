# Brainstorming Session: Consolidation Vision MnM — 3 Piliers

**Date:** 2026-04-07
**Objectif:** Consolider la vision MnM, trouver les angles morts, identifier les synergies entre concepts, renforcer le positionnement stratégique
**Contexte:** Suite au brainstorming 3 piliers (Confiance, Contrôle, Transparence) issu de la session Tom + CEO enterprise customer. 7 concepts validés. 3 itérations de corrections fondamentales.
**Input:** `_bmad-output/brainstorming/brainstorming-3-pillars-2026-04-07.md`

## Techniques Used
1. **Reverse Brainstorming** — "Comment tuer MnM ?" → 12 anti-solutions → 12 insights défensifs
2. **Six Thinking Hats** — 6 perspectives sur la vision → stress-test complet
3. **SCAMPER** — Transformation des concepts existants → innovations

---

## Technique 1 : Reverse Brainstorming — "Comment tuer MnM ?"

### Anti-solution 1 : Rendre l'onboarding interminable
> Configurer 6 niveaux d'autonomie × N steps × scoring contracts × agents reviewers × MCP...

**Insight :** **Time to First Value < 30 minutes.** Le continuum d'autonomie démarre invisible. Tout le monde commence au niveau 2 (Connected) avec des defaults intelligents. Scoring, reviewers, niveaux se découvrent progressivement.

### Anti-solution 2 : Friction Claude Code ↔ MnM
> Le dev doit faire `mnm_start_step()` avant de coder, `mnm_complete_step()` après. S'il oublie, rien n'est tracé.

**Insight :** **Intégration opt-in passive.** MnM détecte automatiquement quand un commit/PR correspond à une issue MnM (branch naming, commit message, PR labels) et rattache l'artifact sans action manuelle.

### Anti-solution 3 : Noyer les leads sous les métriques
> L'Improvement Cockpit affiche 47 KPIs, 12 dimensions...

**Insight :** **Action-oriented, pas data-oriented.** Pattern push : "MnM a détecté 3 thèmes de correction récurrents. Voici le top 1 avec 4 cas concrets. [Améliorer le skill]."

### Anti-solution 4 : Scoring contract trop complexe à configurer
> Dimensions, agents reviewers, poids, thresholds, méthodes...

**Insight :** **Quality Profile templates par métier.** "Backend Dev", "Frontend", "QA". Clone un template, override ce qu'on veut. Aussi simple qu'un `.eslintrc`.

### Anti-solution 5 : Dépendre d'agents reviewers parfaits dès le jour 1
> Agents reviewers médiocres → scores faux → confiance zéro → pilier Confiance s'effondre.

**Insight :** **Le scoring humain bootstrappe le scoring agent.** Phase 1 : humains scorent manuellement. Phase 2 : MnM entraîne les reviewers sur les patterns humains. Phase 3 : agents proposent, humain valide. Phase 4 : auto-approve. Le même continuum d'autonomie appliqué AUX REVIEWERS.

### Anti-solution 6 : Ignorer le dev solo / freelance
> MnM conçu pour des équipes structurées. Le dev solo → pas de valeur.

**Insight :** **Le niveau 2 (Connected) est une killer feature standalone.** Un dev solo connecte MnM MCP → scoring de ses PRs, tracking de progression, suggestions d'amélioration. Hook d'acquisition.

### Anti-solution 7 : Promettre "full autopilot" trop tôt
> Le CEO met ses agents en auto sans KPIs suffisants → catastrophe → blame MnM.

**Insight :** **Niveau 5 verrouillé par défaut.** Déblocable uniquement quand KPIs le prouvent. Le système REFUSE de passer en auto si les KPIs ne le justifient pas (override explicite possible avec "je comprends les risques").

### Anti-solution 8 : Ne pas gérer le multi-tool
> MCP conçu pour Claude Code. Cursor a une API différente. Copilot n'en a pas.

**Insight :** **MnM CLI en complément du MCP Server.** `mnm tasks`, `mnm submit`, `mnm status` — tool-agnostic. MCP = canal premium (Claude Code). CLI = fallback universel. API REST pour intégrations custom.

### Anti-solution 9 : Silo entre Web UI et MCP
> PM configure un workflow dans la Web UI. Le dev ne le voit pas dans Claude Code.

**Insight :** **Bidirectionnalité totale.** Tout ce qui est fait dans la Web UI est visible via MCP et inversement. Notifications cross-canal.

### Anti-solution 10 : Review Lenses trop rigides
> Blocks prédéfinis. Client utilise Azure DevOps → pas de Block → inutile.

**Insight :** **Block SDK.** Un Block = schéma JSON + renderer React + source de données (MCP, webhook, API). Les clients créent leurs propres Blocks.

### Anti-solution 11 : Sous-estimer la résistance au changement
> Les devs voient MnM comme "surveillance" et résistent passivement.

**Insight :** **MnM = AMPLIFICATEUR, pas contrôleur.** Le narratif n'est jamais "on te surveille" mais "on te donne du feedback objectif." La progression d'autonomie est un REWARD : plus tu es bon, plus tu es libre.

### Anti-solution 12 : Pas de story de migration progressive
> enterprise customer a équipes pluri-disciplinaires. Migration big-bang impossible.

**Insight :** **Adoption en cercles concentriques.** Cercle 1 : 1 équipe pilote, 1 workflow, niveau 2. Cercle 2 : scoring activé. Cercle 3 : Improvement Cockpit. Cercle 4 : continuum d'autonomie. Chaque cercle indépendant et apporte de la valeur.

---

## Technique 2 : Six Thinking Hats

### White Hat (Faits)
- **Marché :** L'IA coding explose mais AUCUN outil ne fait supervision/orchestration enterprise
- **enterprise customer feedback :** Le CEO veut garder Claude Code + du CONTROLE, pas un remplacement
- **Stack :** MnM a déjà 70% de l'infra nécessaire (agents, heartbeat, sandboxes, entity_links, tags, RBAC)
- **Concurrence :** Langfuse (observabilité), Patronus (évaluation), Braintrust (scoring). Aucun ne fait orchestration + scoring + continuum
- **Donnée manquante :** Temps acceptable avant ROI pour un CEO/DSI

### Red Hat (Émotions/Intuitions)
- L'analogie **"Kubernetes de l'IA coding"** est PUISSANTE — c'est le pitch moment "aha"
- Le continuum à 6 niveaux est séduisant mais peut effrayer ("par où je commence ?")
- Le scoring universel est élégant mais risque de paraître abstrait sans exemples concrets
- L'**Improvement Cockpit** est la feature qui VEND au CEO (ROI visible)
- **Intuition forte :** La killer feature n'est ni le scoring ni le continuum — c'est le **feedback loop fermé** (agent → scoring → feedback → amélioration → agent amélioré). Ce cycle est unique.

### Black Hat (Risques)
1. **"Ivory tower"** — 6 mois à architecturer sans livrer. Il faut un MVP brutal
2. **Dépendance Claude Code** — Si Anthropic change l'API MCP/hooks, MnM casse. Abstraction adapter nécessaire
3. **Scoring gaming** — Devs optimisent pour le score, pas la qualité. Solution : varier les dimensions + review humain
4. **Feature creep Review Lenses** — Chaque client veut son Block → framework de widgets au lieu de produit
5. **Complexity budget** — 6 niveaux × N workflows × scoring × reviewers × Lenses × MCP + Web UI = surface de bug énorme
6. **RGPD/compliance** — Traces de conversations contiennent du code propriétaire

### Yellow Hat (Opportunités)
1. **Flywheel de données** — Plus on utilise MnM, meilleurs sont les scoring contracts. Moat d'usage
2. **Network effects intra-entreprise** — équipes pluri-disciplinaires → scoring contracts calibrés sur la vraie base de code. Impossible à répliquer
3. **Upsell naturel** — Solo dev (gratuit, Connected) → Équipe (payant, niveaux 2-4) → Enterprise (premium, niveaux 2-5 + Cockpit)
4. **Positioning unique** — "Le Kubernetes de l'IA coding" — niche vide
5. **Timing parfait** — Adoption massive de l'IA coding SANS supervision. MnM arrive au bon moment

### Green Hat (Idées nouvelles)

**Idée 1 : Scoring Marketplace interne**
Les équipes partagent leurs quality profiles. L'équipe Sécurité publie "Security Review v3" que toutes les équipes dev utilisent. Standard de qualité organique, bottom-up.

**Idée 2 : Agent Recipes**
Combos pré-packagées : "Backend Dev Stack" = agent-dev + agent-security-reviewer + agent-test-reviewer + quality profile "Backend Quality". One-click setup. Le `create-react-app` de MnM.

**Idée 3 : Confidence Badge**
Score UNIQUE dérivé de tous les quality profiles, affiché partout comme un badge. Feature map : 🟢 92%, 🟡 74%, 🔴 45%. Le CEO voit la santé du projet en 3 secondes.

**Idée 4 : Replay Mode**
Pour les issues < threshold, MnM "rejoue" l'issue avec un skill amélioré sur les mêmes inputs. Avant/après. Le lead voit l'impact concret sans attendre la prochaine vraie issue.

**Idée 5 : MnM Insights — Weekly Digest LLM**
Chaque lundi : "La qualité des tests a baissé de 12%. 3 devs oublient les edge cases d'auth. Suggestion : ajouter un AC template 'auth edge cases'." Proactif, pas réactif.

**Idée 6 : Pair Scoring**
Quand un humain override un score (approuve un 5/10, rejette un 9/10), MnM capture la divergence pour calibrer le reviewer. L'humain améliore l'agent scorer.

**Idée 7 : Autonomy Leaderboard**
Pas compétitif — visualisation : "Équipe Backend au niveau 3.2, Frontend au 2.8." Le CEO voit la maturité IA. Objectif : monter le niveau moyen.

**Idée 8 : Shadow Mode**
Avant passage en Supervised : l'agent exécute en parallèle de l'humain. On compare. Si l'agent fait aussi bien 10 fois → transition validée empiriquement.

### Blue Hat (Prochaines étapes)

| Phase | Quoi | Pourquoi d'abord |
|-------|------|-----------------|
| **Phase 0** | MnM MCP Server basique (`get_tasks`, `get_context`, `complete_step`) | Time to value immédiat pour les devs |
| **Phase 1** | Quality profiles + gate review humaine | Pilier Confiance sans dépendance aux agents reviewers |
| **Phase 2** | Improvement Cockpit (KPIs, themes, feedback loop) | Pilier Transparence — c'est ce qui vend au CEO |
| **Phase 3** | Agents reviewers (1-2 dimensions) | Automatisation progressive du scoring |
| **Phase 4** | Continuum d'autonomie (Connected → Supervised) | Pilier Contrôle — quand la confiance est établie |
| **Phase 5** | Autonomous (niveau 5) + Shadow Mode | Quand les KPIs le prouvent |

---

## Technique 3 : SCAMPER

### Substitute (Remplacer)
- **"Scoring Contract" → "Quality Profile"** — business-friendly, CEO-compatible
- **Niveaux numérotés → Noms évocateurs :**
  - 0: **Manual** — humain sans IA
  - 1: **Assisted** — humain + IA standalone
  - 2: **Connected** — Claude Code + MnM MCP
  - 3: **Guided** — dans MnM, tracé
  - 4: **Supervised** — auto + gate review
  - 5: **Autonomous** — full autopilot

### Combine (Fusionner)
- **Improvement Cockpit + Autonomy Continuum** → Un seul écran : performance + maturité + transitions suggérées
- **Scoring + Review Lenses** → Scores affichés EN CONTEXTE sur l'artifact (annotations inline sur le diff, comme des commentaires de PR)
- **MnM MCP Server + Hooks Claude Code** → MCP pour interactions explicites + hooks pour capture implicite. Les deux, pas l'un ou l'autre

### Adapt (Adapter d'ailleurs)
- **Modèle Spotify** → Chapters partagent des quality profiles. Squads ont leur propre niveau d'autonomie
- **Canary deployments → Canary scoring** → Nouveau quality profile appliqué à 20% des issues pendant 1 semaine avant rollout
- **GitOps → Config MnM versionnée en Git** → Quality profiles, workflows, agent configs en YAML dans le repo. Changement = PR + review

### Modify (Amplifier)
- **"Résultat > Méthode" amplifié** → MnM ne trace JAMAIS le process au niveau 2. Même au niveau 3, traces opt-in. Message clair : "On ne te flique pas."
- **Feedback loop amplifié** → MnM suggère de modifier LE SCORING LUI-MÊME : "10 dernières issues > 9/10 en sécurité. Scoring trop facile ou agent vraiment bon ? [Recalibrer] [Garder]"

### Put to other uses (Autres usages)
- **MnM pour le non-code** → Rédaction marketing, support client, data analysis. Content manager supervise ses agents de rédaction avec quality profile "Brand Voice + SEO + Accuracy". Élargissement TAM massif
- **MnM comme outil de formation** → Le continuum IS un programme de formation. Junior commence en Guided, monte progressivement. Talent development automatisé
- **MnM pour l'audit/compliance** → Quality profiles + Review Lenses = piste d'audit automatique. ISO/SOC2 facilité

### Eliminate (Supprimer)
- **"Workflow step" → "Checkpoint"** → Plus flexible. Le dev choisit quand il soumet. Le workflow définit les checkpoints ATTENDUS, pas OBLIGATOIRES
- **Distinction Web UI vs MCP dans le messaging** → UNE plateforme, pas deux produits. Comme Slack web vs Slack desktop

### Reverse (Inverser)
- **Le narratif du continuum** → Ce n'est pas "le dev lâche du contrôle". C'est "l'agent PROUVE qu'il mérite l'autonomie". Le dev est le JUGE, l'agent est le CANDIDAT
- **Double scoring** → Les devs scorent les AGENTS aussi. MnM a un scoring bidirectionnel : qualité de l'artifact ET qualité de l'agent
- **Improvement Cockpit inversé** → Les insights remontent AUX DEVS, pas juste aux leads. MnM comme coach personnel

---

## Les 10 Key Insights

### Insight 1 : "Le Flywheel MnM" — Le moat défensif
**Description :** Le cycle fermé Agent → Scoring → Feedback → Skill amélioré → Agent amélioré → Score monte → Autonomie augmente. Chaque cycle rend MnM plus intelligent pour CE client.
**Source :** Yellow Hat + SCAMPER (Modify)
**Impact :** CRITIQUE
**Effort :** Moyen — composition des features existantes
**Why it matters :** Moat d'usage impossible à copier. Les données du cycle sont propriétaires au client.

### Insight 2 : "L'agent prouve, le dev juge" — Inverser le narratif
**Description :** Le continuum n'est PAS "le dev lâche du contrôle". C'est "l'agent GAGNE la confiance en prouvant sa compétence". Le dev est le juge, l'agent le candidat. Élimine la résistance au changement.
**Source :** SCAMPER (Reverse) + Reverse Brainstorming (#11)
**Impact :** Haut
**Effort :** Faible — messaging/UX
**Why it matters :** La résistance des devs est le risque #1.

### Insight 3 : "Nommer les niveaux" — Manual → Assisted → Connected → Guided → Supervised → Autonomous
**Description :** Les numéros sont abstraits. Des noms évocateurs rendent le continuum tangible. "Mode Supervised" > "Niveau 4". Le CEO explique au board en 30 secondes.
**Source :** SCAMPER (Substitute)
**Impact :** Moyen
**Effort :** Faible

### Insight 4 : "Adoption en cercles concentriques"
**Description :** Phase 0 (MCP basique) → Phase 1 (scoring + gate humaine) → Phase 2 (Cockpit) → Phase 3 (agents reviewers) → Phase 4 (continuum) → Phase 5 (auto-approve). Chaque phase indépendante et apporte de la valeur.
**Source :** Reverse Brainstorming (#12) + Blue Hat
**Impact :** CRITIQUE
**Effort :** Moyen — priorisation

### Insight 5 : "Shadow Mode" — Transition de confiance empirique
**Description :** Avant passage en Supervised, l'agent exécute en parallèle de l'humain. On compare. Si l'agent fait aussi bien 10 fois → transition validée avec des preuves.
**Source :** Green Hat (#8)
**Impact :** Haut
**Effort :** Moyen

### Insight 6 : "Pair Scoring" — Les humains calibrent les agents scorers
**Description :** Quand un humain override un score, MnM capture la divergence pour calibrer le reviewer. Le continuum d'autonomie s'applique AUSSI aux reviewers.
**Source :** Green Hat (#6) + Reverse Brainstorming (#5)
**Impact :** Haut
**Effort :** Moyen

### Insight 7 : "MnM coach, pas flic"
**Description :** Les insights remontent AUX DEVS, pas juste aux leads. "Tes 5 derniers PR corrigés pour error handling — voici un pattern." MnM est un amplificateur. Le narratif doit être clair à chaque touchpoint.
**Source :** SCAMPER (Reverse) + Reverse Brainstorming (#11)
**Impact :** Haut
**Effort :** Faible-Moyen

### Insight 8 : "Quality Profile" > "Scoring Contract"
**Description :** Renaming business-friendly + templates par métier + Agent Recipes (combos pré-packagées). Le `create-react-app` de MnM.
**Source :** SCAMPER (Substitute) + Reverse Brainstorming (#4)
**Impact :** Moyen
**Effort :** Faible

### Insight 9 : "Confidence Badge" — Le score unique
**Description :** Score unique dérivé de tous les quality profiles, affiché comme un badge partout. 🟢 92%, 🟡 74%, 🔴 45%. Le hero metric pour les décideurs.
**Source :** Green Hat (#3)
**Impact :** Haut
**Effort :** Faible

### Insight 10 : "GitOps for MnM Config"
**Description :** Quality profiles, workflows, agent configs versionnés en Git. Changement = PR + review. Les devs font confiance à Git → ils traitent la config MnM avec le même sérieux que le code.
**Source :** SCAMPER (Adapt)
**Impact :** Moyen
**Effort :** Moyen

---

## Synergies découvertes entre les concepts validés

| Synergie | Concepts combinés | Valeur ajoutée |
|----------|------------------|----------------|
| Le continuum s'applique aux reviewers aussi | Autonomy Continuum + Agent Review Panel | Résout le cold-start problem du scoring |
| L'Improvement Cockpit INCLUT la vue continuum | Improvement Cockpit + Autonomy Continuum | Un seul écran pour performance + maturité |
| Les quality profiles vivent dans Git | Scoring universel + MnM MCP Server | Les devs gèrent la config dans leur outil |
| Le Review Lens affiche les scores inline | Review Lenses + Scoring universel | Scoring en contexte, pas dans un dashboard séparé |
| Le MCP + hooks = capture complète | MnM MCP Server + Résultat > Méthode | Explicite (MCP) + implicite (hooks), sans tracing intrusif |
| Le Confidence Badge agrège les quality profiles | Scoring universel + Review Lenses | Hero metric pour décideurs |

---

## Angles morts identifiés

1. **Multi-tenancy data isolation** — Quand MnM est SaaS, les quality profiles d'un client ne doivent jamais leak vers un autre. Le "scoring marketplace" interne est safe, pas cross-clients.
2. **Versioning des quality profiles** — Quand on change un scoring, les scores historiques deviennent incomparables. Il faut un "scoring version" pour les trends.
3. **Agent reviewer sprawl** — Si chaque dimension a son agent, une entreprise avec 20 dimensions a 20 agents reviewers à maintenir. Prévoir de la consolidation.
4. **Offline/déconnecté** — Le dev en avion sans accès MnM MCP. Le CLI doit pouvoir queue les submissions pour sync ultérieur.
5. **Billing model** — Le continuum d'autonomie = plus d'agents = plus de compute. Le pricing doit aligner les incentives : l'user VEUT monter en autonomie, pas être pénalisé financièrement.
6. **International/multi-langue** — Les quality profiles, feedback, et insights LLM doivent fonctionner dans la langue de l'équipe.

---

## Recommandation : Concept unificateur — "Le Flywheel MnM"

Tous les concepts validés et insights de cette session convergent vers UN mécanisme central :

```
                    ┌─────────────────┐
                    │   AGENT EXÉCUTE  │
                    │  (dans l'outil   │
                    │   du dev)        │
                    └────────┬────────┘
                             │ artifact
                             ▼
                    ┌─────────────────┐
                    │  QUALITY PROFILE │
                    │  scoring objectif│
         ┌────────▶│  (agents + humain)│
         │          └────────┬────────┘
         │                   │ scores + rapport
         │                   ▼
         │          ┌─────────────────┐
         │          │   GATE REVIEW    │
 calibration        │  (humain juge)   │
         │          └────────┬────────┘
         │                   │ feedback + verdict
         │                   ▼
         │          ┌─────────────────┐
         │          │  IMPROVEMENT     │
         └──────────│  COCKPIT         │
                    │  (lead améliore  │
                    │   skills)        │
                    └────────┬────────┘
                             │ skill amélioré
                             ▼
                    ┌─────────────────┐
                    │  AUTONOMY        │
                    │  CONTINUUM       │
                    │  (KPIs montent → │
                    │   plus d'auto)   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   AGENT EXÉCUTE  │
                    │   (mieux)        │
                    └─────────────────┘
```

**Chaque composant de MnM est un rouage de ce flywheel.** Le pitch n'est pas "on a 7 features" — c'est "on a UN cycle d'amélioration continue qui rend vos agents meilleurs chaque jour."

---

## Recommended Next Steps

1. **Architecture** — Architecturer le MnM MCP Server (Phase 0) comme première brique. Run `/bmad:architecture`
2. **PRD** — Formaliser les quality profiles + gate review (Phase 1) en requirements. Run `/bmad:prd`
3. **UX Design** — Wireframer l'Improvement Cockpit avec le Confidence Badge. Run `/bmad:create-ux-design`
4. **Tech Spec** — Spécifier l'extension d'entity_links pour le scoring universel. Run `/bmad:tech-spec`

---

## Statistics
- Total ideas generated: **38**
- Categories: **7** (onboarding, integration, scoring, adoption, trust, UX, strategy)
- Key insights: **10**
- Synergies discovered: **6**
- Blind spots identified: **6**
- Techniques applied: **3** (Reverse Brainstorming, Six Thinking Hats, SCAMPER)

---

*Generated by BMAD Method v6 - Creative Intelligence*
*Session: 2026-04-07 — Consolidation Vision MnM*
