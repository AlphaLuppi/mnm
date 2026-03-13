# Analyse Approfondie : entire.io vs MnM

**Date :** 2026-02-20  
**Auteur :** Atlas (Research Agent)  
**Pour :** Tom — Vision produit MnM

---

## Résumé Exécutif (5 points clés)

1. **Entire.io** est fondé par **Thomas Dohmke** (ex-CEO de GitHub) avec **$60M de seed funding** — un concurrent très bien financé dans l'espace "AI-native developer tools"

2. **Focus différent** : Entire = **traçabilité** ("pourquoi ce code a été écrit") vs MnM = **alignment** ("est-ce que le code correspond à la vision produit")

3. **Leur CLI est open source** (Go/MIT), hooks Git, supporte Claude Code + Gemini CLI — approche infrastructure-first, pas de GUI

4. **Vision à long terme** : "Assembly line for agents" — plateforme de collaboration human-agent avec context graph et semantic reasoning layer

5. **Opportunité pour MnM** : Entire ne touche PAS l'orchestration de workflows, la détection de drift specs/code, ni l'interface interactive avec les specs — ce sont nos différenciateurs clés

---

## 1. Entire.io — Vision & Produit

### Mission

> "Build the world's next developer platform where agents and humans can collaborate, learn, and ship together."

Entire veut créer "l'assembly line pour l'ère des agents" — une analogie avec la révolution Ford pour la production automobile. Leur thèse : les workflows de développement actuels (Git, PRs, Issues) ont été conçus pour la collaboration human-to-human et craquent sous la pression du code généré par AI.

### Problème adressé

Le problème principal qu'ils ciblent : **la perte de contexte**.

Quand un développeur ferme une session Claude Code :
- Le code reste (commité)
- Le raisonnement disparaît
- Les contraintes et décisions sont perdues
- Le prochain dev (ou agent) doit repartir de zéro

Symptoms identifiés :
- Issues = unités de travail humaines, pas machine-readable
- Git ne version que les fichiers, pas l'intent/context
- PRs ne scalent pas pour le code AI-generated en masse
- Agents throttled par rate limits centralisés
- Context perdu quand les sessions se terminent

### Fondateurs & Background

| Personne | Rôle | Background |
|----------|------|------------|
| **Thomas Dohmke** | CEO/Founder | Ex-CEO de GitHub (2021-2025), ex-VP Developer Experience, chez GitHub depuis 2018. Allemand, basé à SF. Avant : startups dev tools |

**Note importante :** Dohmke a dirigé GitHub pendant l'ère Copilot, il connaît intimement les challenges de l'AI dans le dev workflow.

### Funding & Investisseurs

| Métrique | Valeur |
|----------|--------|
| **Round** | Seed |
| **Montant** | $60M |
| **Lead** | Felicis Ventures |
| **Autres VCs** | Madrona, M12 (Microsoft), Basis Set, 20VC, Cherry Ventures, Picus Capital, Global Founders Capital |
| **Angels notables** | Gergely Orosz (Pragmatic Engineer), Theo Browne (t3.gg), Jerry Yang (Yahoo), Olivier Pomel (Datadog), Garry Tan (Y Combinator) |

**Analyse :** C'est un des plus gros seeds dans le dev tooling. La présence de M12 (Microsoft) est notable vu le background GitHub de Dohmke. Les angels (Gergely, Theo) assurent une crédibilité "developer influencer".

### Business Model (inféré)

Pas encore annoncé officiellement, mais pattern prévisible :
1. **Open source CLI** gratuit → adoption
2. **Hosted platform** (GitHub-like pour AI dev) → SaaS revenue
3. **Enterprise features** (SSO, audit, compliance) → upsell

### Stage & Traction

| Métrique | Status |
|----------|--------|
| **Stage** | Early (vient de sortir de stealth, Feb 2026) |
| **Produit public** | CLI "Checkpoints" seulement |
| **GitHub stars** | ~2.5k (en croissance rapide) |
| **Adoption** | Buzz HN/X, pas de chiffres publics |

---

## 2. Leurs Outils CLI — Analyse Technique

### Vue d'ensemble

| Aspect | Détail |
|--------|--------|
| **Nom** | `entire` CLI |
| **Langage** | Go |
| **License** | MIT |
| **Repo** | `github.com/entireio/cli` |
| **Installation** | Homebrew tap ou `go install` |

### Installation

```bash
# Homebrew
brew tap entireio/tap
brew install entireio/tap/entire

# Go
go install github.com/entireio/cli/cmd/entire@latest

# Script
curl -fsSL https://entire.io/install.sh | bash
```

### Comment ça fonctionne

```
Your Branch                       entire/checkpoints/v1
    │                                      │
    ▼                                      │
[Base Commit]                              │
    │                                      │
    │ ┌─── Agent works ───┐               │
    │ │     Step 1        │               │
    │ │     Step 2        │               │
    │ │     Step 3        │               │
    │ └───────────────────┘               │
    │                                      │
    ▼                                      ▼
[Your Commit] ─────────────────────► [Session Metadata]
    │                                  (transcript, prompts,
    │                                   files touched, tokens)
    ▼
```

**Mécanisme :**
1. `entire enable` installe des Git hooks
2. Les hooks interceptent les sessions Claude Code / Gemini CLI
3. À chaque commit (ou réponse agent selon strategy), un "checkpoint" est créé
4. Les checkpoints sont stockés sur une branche séparée `entire/checkpoints/v1`
5. L'historique Git principal reste propre

### Commandes disponibles

| Commande | Description |
|----------|-------------|
| `entire enable` | Active Entire dans le repo (installe hooks) |
| `entire disable` | Désactive (retire hooks) |
| `entire status` | Affiche session courante et config |
| `entire rewind` | Revient à un checkpoint précédent |
| `entire resume <branch>` | Restaure session et continue sur une branche |
| `entire explain` | Explique une session ou commit |
| `entire doctor` | Debug/fix sessions stuck |
| `entire reset` | Supprime shadow branch et état |
| `entire clean` | Nettoie data orpheline |

### Flags importants (`entire enable`)

| Flag | Description |
|------|-------------|
| `--strategy <name>` | `manual-commit` (défaut) ou `auto-commit` |
| `--agent <name>` | `claude-code` (défaut) ou `gemini` |
| `--skip-push-sessions` | Ne pas push les logs automatiquement |
| `--local` | Écrire config en local (pas committed) |

### Strategies

| Strategy | Quand checkpoint créé | Best for |
|----------|----------------------|----------|
| `manual-commit` | Au commit Git | Historique propre, contrôle |
| `auto-commit` | Après chaque réponse agent | Granularité maximale, rewind précis |

### Données capturées

```json
{
  "session_id": "2026-02-20-abc123de-...",
  "agent": "claude-code",
  "prompts": ["..."],
  "responses": ["..."],
  "files_touched": ["src/auth.ts", "..."],
  "token_usage": {
    "input": 12000,
    "output": 8500
  },
  "tool_calls": [
    {"name": "edit", "file": "src/auth.ts"},
    {"name": "exec", "cmd": "npm test"}
  ],
  "timestamp": "2026-02-20T10:30:00Z"
}
```

### Features additionnelles

- **Auto-summarization** : Génère des résumés AI des sessions au commit (opt-in, utilise Claude CLI)
- **Secret redaction** : Détecte et masque API keys/tokens avant stockage
- **Git worktrees** : Support natif, sessions indépendantes par worktree
- **Concurrent sessions** : Peut tracker plusieurs agents en parallèle

### Ce qui N'EST PAS dans le CLI

❌ Pas de GUI / dashboard  
❌ Pas d'orchestration multi-agent  
❌ Pas de workflow definition  
❌ Pas de drift detection (specs vs code)  
❌ Pas de notion de "specs" ou "product vision"  
❌ Pas de file locking / conflict prevention  
❌ Pas de real-time agent monitoring (juste logging post-hoc)

---

## 3. Analyse Comparative : entire.io vs MnM

### Tableau de comparaison

| Aspect | entire.io | MnM |
|--------|-----------|-----|
| **Core Problem** | Context loss in AI sessions | Alignment crisis + workflow opacity |
| **Solution** | Session capture + checkpoints | Workflow Editor + Cross-doc drift + Spec-as-Interface |
| **Target Users** | Individual devs, teams wanting audit/traceability | Product engineers, solopreneurs, small teams |
| **Primary Interface** | CLI only (pas de GUI) | GPUI app (Rust/GPU-accelerated) |
| **Tech Stack** | Go, Git hooks, branch-based storage | Rust, GPUI, SQLite, Claude API |
| **Agent Support** | Claude Code, Gemini CLI | Claude Code (MVP) |
| **Agent Orchestration** | Non — capture seulement | Oui — definition + execution + monitoring |
| **Workflow Definition** | Non | Oui — chat-first + visual builder |
| **Drift Detection** | Non | Oui — code-vs-spec + cross-document |
| **Specs Integration** | Aucune | Core feature (Spec-as-Interface) |
| **Real-time Monitoring** | Non (post-hoc logs) | Oui (live status, presence indicators) |
| **Business Model** | Open source CLI → Hosted platform | TBD (likely similar pattern) |
| **Funding** | $60M seed | Bootstrapped |
| **Stage** | Just launched (Feb 2026) | Pre-launch (POC phase) |

### Positionnement visuel

```
                    Traceability/Audit
                           ▲
                           │
                           │  entire.io
                           │     ★
                           │
                           │
    Code-first ◄───────────┼───────────► Product-first
                           │
                           │
                           │
                           │        ★ MnM
                           │
                           ▼
                    Orchestration/Alignment
```

### Analyse des différenciateurs

| Feature | entire.io | MnM | Avantage |
|---------|-----------|-----|----------|
| **Traçabilité sessions** | ✅ Core | ❌ Non prévu | entire.io |
| **Rewind/Resume** | ✅ Natif | ❌ Non prévu | entire.io |
| **Workflow Definition** | ❌ Non | ✅ Core | MnM |
| **Chat-first workflows** | ❌ Non | ✅ Core | MnM |
| **Drift detection** | ❌ Non | ✅ Core | MnM |
| **Cross-doc consistency** | ❌ Non | ✅ Core | MnM |
| **Spec interactivity** | ❌ Non | ✅ Core | MnM |
| **Agent presence** | ❌ Non | ✅ Core | MnM |
| **File locking** | ❌ Non | ✅ Core | MnM |
| **Real-time monitoring** | ❌ Non | ✅ Core | MnM |
| **GPU-accelerated UI** | N/A (CLI only) | ✅ Core | MnM |

### Chevauchement

Le seul chevauchement réel : **stocker du context autour du code généré par AI**.

- entire.io stocke le "comment" (session transcripts)
- MnM stocke le "pourquoi" (specs, vision, alignment)

Ce sont des approches **complémentaires**, pas concurrentes.

---

## 4. Ce qu'on peut apprendre

### Features intéressantes à reprendre

| Feature entire.io | Adaptation pour MnM |
|-------------------|---------------------|
| **Checkpoints/Rewind** | Pourrait être intéressant d'avoir des "save points" dans les workflows — rewind un workflow à un step précédent |
| **Auto-summarization** | Générer des résumés automatiques des sessions agent pour le changelog/rapport d'équipe |
| **Secret redaction** | Masquer les secrets dans les logs agent avant affichage |
| **Git worktree support** | À considérer si MnM supporte les worktrees |
| **Concurrent session tracking** | MnM fait déjà mieux (agent orchestration) |
| **Strategy modes** | Concept de "manual" vs "auto" checkpoint pourrait s'appliquer aux workflows |

### Erreurs à éviter

| Ce qu'ils font | Risque | Leçon pour MnM |
|----------------|--------|----------------|
| CLI-only launch | Friction à l'adoption | Notre GUI native est un avantage — garder l'UX smooth |
| Dépendance Git hooks | Fragile, conflits possibles | MnM utilise Git mais pas de hooks invasifs |
| Branche séparée pour data | Pollution du repo | MnM stocke en local (.mnm/) — plus propre |
| Pas de real-time | Limité pour debugging | Notre monitoring live est un différenciateur clé |
| Focus narrow (traçabilité) | Risque de commoditization | MnM vise plus large (alignment + orchestration) |

### Positionnement différent possible

**entire.io dit :** "On capture ce que les agents font pour que vous compreniez pourquoi votre code existe."

**MnM peut dire :** "On s'assure que vos agents construisent ce que vous voulez vraiment — pas juste ce qu'ils peuvent."

Angles de différenciation :

1. **Product-first vs Code-first** : entire.io voit le code comme l'output. MnM voit le produit comme l'output.

2. **Proactive vs Reactive** : entire.io capture après coup. MnM guide en amont (drift detection avant que le code soit écrit).

3. **Orchestration vs Observation** : entire.io observe les sessions. MnM orchestre les workflows.

4. **Specs as source of truth** : entire.io ignore les specs. MnM les met au centre.

### Gaps qu'ils ne couvrent pas

| Gap | Opportunité MnM |
|-----|-----------------|
| **Workflow orchestration** | MnM est le seul avec chat-first workflow definition |
| **Cross-document consistency** | MnM détecte "SSE vs Websocket" dans les specs |
| **Spec-as-Interface** | MnM rend les specs actionnables (pas juste du texte) |
| **Product vision alignment** | MnM garde la vision ambient et accessible |
| **Multi-agent coordination** | MnM gère les dépendances, file locking, parallelism |
| **Real-time agent presence** | MnM montre qui travaille sur quoi, live |
| **Onboarding conversationnel** | MnM = zero config, conversation-first |

---

## 5. Recommandations pour MnM

### Court terme (POC)

1. **Ne pas essayer de concurrencer sur la traçabilité** — c'est leur core, ils ont $60M et un ex-CEO GitHub. Concentrer sur l'alignment + orchestration.

2. **Considérer l'intégration future** — Les deux outils sont complémentaires. MnM pourrait lire les checkpoints entire.io pour enrichir le context.

3. **Clarifier le messaging** — "MnM is not about tracking what agents did — it's about ensuring they do what you actually want."

### Moyen terme (v1)

4. **Documenter la différence** — Créer une page "MnM vs entire.io" pour le positioning.

5. **Feature parity optionnelle** — Si les users demandent du session logging, on peut ajouter une version simplifiée (sans la complexité des checkpoints Git).

6. **Workflow templates** — Là où entire.io n'a rien, MnM peut proposer des workflows pre-built (BMAD, TDD, etc.).

### Long terme

7. **Partenariat possible ?** — entire.io = infrastructure layer, MnM = product layer. Les deux pourraient coexister.

8. **Surveiller leur évolution** — S'ils bougent vers l'orchestration, on a un concurrent direct. Mais leur branding actuel ("assembly line", "traceability") suggère un autre angle.

---

## 6. Sources

### Documentation lue

| Source | URL |
|--------|-----|
| GitHub repo (CLI) | https://github.com/entireio/cli |
| Site web | https://entire.io (minimaliste) |
| Article TechPlanet (funding) | https://techplanet.today/post/ex-github-ceo-launches-entire-the-60m-bet-on-ai-native-development-infrastructure |
| Blog review (mager.co) | https://www.mager.co/blog/2026-02-10-entire-cli/ |
| AlternativeTo | https://alternativeto.net/software/entire-io/about/ |

### Docs MnM référencés

| Document | Path |
|----------|------|
| Product Brief MnM | `/Users/assistant/dev-projects-repos/mnm/_bmad-output/planning-artifacts/product-brief-mnm-2026-02-19.md` |
| Synthèse Agent Orchestration | `/Users/assistant/dev-projects-repos/mnm/_research/SYNTHESE-AGENT-ORCHESTRATION.md` |

---

## TL;DR

**entire.io** est un outil CLI pour capturer les sessions AI et comprendre "pourquoi ce code existe". C'est un outil de **traçabilité et d'audit**.

**MnM** est un ADE pour s'assurer que le code correspond à la vision produit. C'est un outil d'**alignment et d'orchestration**.

**Ce sont des outils complémentaires, pas concurrents directs.** entire.io regarde en arrière (qu'est-ce qui s'est passé ?), MnM regarde en avant (qu'est-ce qu'on veut construire ?).

L'avantage de MnM : **product-first thinking** + **workflow orchestration** + **drift detection** = une catégorie que entire.io ne touche pas.

---

*Fin de l'analyse. Questions → ping Atlas.*
