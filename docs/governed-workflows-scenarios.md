# MnM — Governed Workflows (brainstorm)

*Session du 2026-04-16 — founder × Claude*

Synthèse du brainstorm sur la manière d'imposer des workflows déterministes dans MnM,
quel que soit le point d'entrée (Chat, Claude Code + MCP, API, UI), tout en restant
agnostique du provider de code source.

---

## 1. Contexte : priorisation MnM pour enterprise tier 2

Lecture du plan `team-mnm-transformation.md`. L'ordre de construction recommandé (section 7) :

```
1. KG Memory          ← prérequis bloquant, fondation de tout
2. Nightly Synthesis  ← dépend du KG
3. Jira Intelligent   ← dépend du KG
4. Sensei             ← dépend du KG + marketplace
5. Skills Marketplace ← backée par your enterprise GitLab Group
6. Bot Teams          ← MCP Teams à créer, dépend du KG
```

**Le KG Memory est bloquant pour 4 des 6 features critiques.** pgvector est déjà dans la stack,
travail sur les nœuds déjà commencé → c'est le premier chantier MnM.

---

## 2. Le problème de fond

> "Il faut que les utilisateurs soient FORCÉS de suivre certains workflows,
> que ce soit via le chat, les agents, le MCP ou l'API."

**Contraintes :**
- Multiple points d'entrée (chat, MCP, API, UI, agents)
- Provider-agnostic (GitLab, GitHub, local — pas couplage fort comme Glass/Ramp)
- Invisible pour les non-tech (un PM ne doit jamais ouvrir GitLab)
- **Déterministe** — pas de "le LLM a le workflow dans son contexte donc il le fera"

**Inspiration Ramp (Glass) :** ils contrôlent toute la chaîne UI → GitLab. MnM doit obtenir le
même résultat sans ce couplage.

---

## 3. La solution : Governed Actions

Toute opération significative (créer un skill, commit, push, publier sur la marketplace)
est une **Governed Action** enregistrée dans un registre central.

```
 Chat / MCP / API / UI
         │
         ▼
 ┌──────────────────┐
 │   Action Gate    │  ← code serveur, déterministe
 │   (le registre)  │
 └────────┬─────────┘
          │
          ▼
 ┌──────────────────┐
 │ Workflow Engine  │  ← session + étapes obligatoires
 └────────┬─────────┘
          │
          ▼
 ┌──────────────────┐
 │  Git Provider    │  ← abstraction GitLab/GitHub/local
 │   (invisible)    │
 └──────────────────┘
```

**Registre d'actions** (concept) :

```
create-skill         → workflow requis: skill-creation
create-app           → workflow requis: app-creation
propose-marketplace  → préconditions: tests ✓, pas de secrets
commit               → règles: atomique, conventional commits
```

---

## 4. Les Guards MCP — techniquement

Point clé : **un guard MCP, c'est un `if` côté serveur, rien d'autre.**

Quand Claude Code appelle un tool MCP, c'est un POST HTTP vers le serveur MnM. Le serveur
exécute du code déterministe. Le LLM n'a aucun contrôle sur la réponse.

**État actuel dans MnM** (`server/src/mcp/registry/define-mcp-tools.ts:66-86`) :

```
wrappedHandler:
  1. Permission check    ← DÉJÀ EN PLACE
  2. Handler métier
```

**À ajouter :**

```
wrappedHandler:
  1. Permission check         ← existant
  2. ★ Workflow guard ★       ← AJOUT (5-10 lignes)
     - Lookup session active pour ce workflow
     - Si absente → return mcpError("WORKFLOW_REQUIRED", hint)
     - Si mauvaise étape → return mcpError("WORKFLOW_STEP_MISMATCH")
  3. Handler métier (jamais atteint si rejet)
```

**Ce que le LLM reçoit en cas de rejet :**

```json
{
  "isError": true,
  "error": "WORKFLOW_REQUIRED",
  "hint": "Start the workflow first with start_bugfix"
}
```

Le LLM peut guider l'utilisateur vers le bon tool via le `hint`, mais **il ne peut pas**
bypasser le rejet. C'est un 403, point.

---

## 5. Chat vs MCP : matérialisation du Gate

### Gate côté Chat

```
teammate-B: "Je veux brainstormer une feature"
  │
  ▼
Backend Chat (POST /chat/message)
  │
  1. Intent Classifier (rule-based + Haiku)
     → match: "brainstorm-feature"
  │
  2. Lookup registry → workflow obligatoire
  │
  3. Pas de session → backend CRÉE la session
     et INJECTE le system prompt du workflow
  │
  4. LLM reçoit:
     system: "Tu es dans workflow brainstorm,
              étape 1/4, pose ces questions: [...]"
     user: message de teammate-B
  │
  → Le LLM est enfermé dans le workflow
    (il ne voit que ça dans son contexte)
```

**Mécanisme :** interception AVANT le LLM, contrôle du system prompt.

### Gate côté MCP

```
teammate-A (Claude Code): "Corrige FEAT-001"
  │
  ▼
Claude Code appelle MCP: create_branch
  │
  ▼
MnM MCP Server — wrappedHandler:
  1. Permission check        ✓
  2. Workflow guard          ❌ pas de session
     → return mcpError("WORKFLOW_REQUIRED")
  │
  ▼
Claude Code reçoit l'erreur + hint
  │
  ▼
Claude Code appelle: start_bugfix(FEAT-001)
  (pas de requiredWorkflow sur ce tool — c'est le point d'entrée)
  → crée la session, retourne contexte enrichi
  │
  ▼
Claude Code re-appelle: create_branch
  1. Permission ✓
  2. Session active ✓ + bonne étape ✓
  3. Handler exécute → branche créée
```

**Mécanisme :** interception APRÈS le LLM, rejet de la réponse.

### Différence synthétique

```
CHAT                             MCP
────                             ───
Contrôle CONTEXTE du LLM         Contrôle RÉPONSE au LLM
(system prompt injecté)          (erreur retournée)

Intercept AVANT le LLM           Intercept APRÈS le LLM

LLM enfermé dans workflow        LLM bloqué hors workflow

       Les deux = déterministes, code serveur
       Les deux = le LLM ne décide rien
```

**Point de vigilance chat :** l'Intent Classifier est le maillon.
- Rule-based (regex/keywords) = 100% déterministe mais rigide
- Haiku rapide = flexible mais probabiliste
- **Compromis** : rule-based pour les intents critiques (create-app, create-skill),
  Haiku pour le reste.

---

## 6. Scénarios concrets

### Scénario 1 — PM : Brainstorm → Proto live

```
teammate-B (PM) — Chat MnM
│
├─ "Je veux brainstormer une feature de facturation"
│   └─ Gate chat: brainstorm workflow OBLIGATOIRE
│       ├─ Questions guidées + contexte KG
│       └─ → PRD markdown généré
│
├─ "Je veux prototyper"
│   └─ Gate: app-creation workflow OBLIGATOIRE
│       ├─ Git Provider → repo perso GitLab (template your-org)
│       ├─ Scaffold app + commit atomique
│       └─ MCP K8S → deploy sur cluster interne
│
├─ proto.example.com = LIVE
│
└─ "Partage à l'équipe dev"
    └─ Notif Teams + lien PRD + proto
       (teammate-B n'a jamais ouvert GitLab)
```

### Scénario 2 — Dev : Bug fix via Claude Code + MCP

```
teammate-A (Dev) — Claude Code + MCP MnM
│
├─ "Corrige FEAT-001" (lien Jira)
│   └─ Gate MCP: bug-correction workflow OBLIGATOIRE
│       ├─ Fetch Jira → description, prio, composant
│       ├─ Fetch Sentry → stacktraces, occurrences
│       └─ Fetch KG → décisions passées sur ce module
│
├─ Git Provider → branche fix/FEAT-001
│   └─ teammate-A code le fix avec Claude Code
│
├─ "Commit"
│   └─ Gate: ❌ BLOQUÉ — reviews pas faites
│       ├─ Sub-agent Archi    → ✓
│       ├─ Sub-agent Sécu     → ✓
│       ├─ Sub-agent Impact   → ⚠️ 2 callers à adapter
│       └─ teammate-A adapte → reviews OK
│
├─ Gate: ✅ commit autorisé
│   └─ Git Provider → commit atomique + push + MR
│
└─ Jira FEAT-001 → "In Review" (auto)
```

### Scénario 3 — Lead : Skill → Marketplace → Auto-install

```
the maintainer — Claude Code + MCP MnM
│
├─ MCP: create_skill("sentry-bug-context")
│   └─ Gate: ❌ WORKFLOW_REQUIRED
│
├─ MCP: start_skill_creation(...)
│   └─ Gate: ✅ workflow "skill-creation" lancé
│       ├─ Étape 1: comportement (trigger, I/O)
│       ├─ Étape 2: dépendances (MCP Sentry)
│       ├─ Étape 3: tests (auto-run, doivent passer)
│       └─ Étape 4: Git Provider → commit repo perso
│
├─ "Partage à mon équipe"
│   └─ Gate: marketplace-proposal workflow
│       ├─ Git Provider → fork vers team-skills/ + MR
│       └─ Review + merge → publié ✓
│
├─ 🌙 Nuit : Sensei Nightly Synthesis
│   └─ Nouveau skill se trigger sur "bug-correction"
│       → Règle auto: équipe Produit + bug-fix
│         = pré-charger ce skill
│
└─ Lendemain : un dev fait start_bugfix("FEAT-001")
    └─ Contexte Sentry injecté automatiquement
       (le dev ne sait même pas que le skill existe)
```

---

## 7. Ce qui existe déjà vs à construire

### Existe
- `ToolRegistry.listForActor` : filtrage dynamique des tools par permissions
  (`server/src/mcp/registry/tool-registry.ts:10-13`)
- `wrappedHandler` avec permission check déterministe au runtime
  (`server/src/mcp/registry/define-mcp-tools.ts:66-86`)
- 68 tools MCP sur 14 domaines, schémas Zod, audit fire-and-forget
- `WorkflowEnforcer` XState pour les étapes d'exécution d'agents
- `McpActor` avec `effectivePermissions: Set<PermissionSlug>`
- Actions Gate pattern embryonnaire : `McpErrorCode` + `mcpError()` helper

### À construire
- **Registry de Governed Actions** : table + service qui map action → workflow requis
- **WorkflowSession** : table + service (actor, workflow, currentStep, status)
- **Intent Classifier** côté chat : rule-based pour intents critiques + Haiku pour le reste
- **Workflow guard** dans `wrappedHandler` : ~10 lignes, pattern identique au permission check
- **GitProvider abstraction** : interface + implémentations GitLab/GitHub/local
- **MCP K8S** : à évaluer (existe-t-il dans l'écosystème ou à créer ?)
- **Templates GitLab self-hosted** : repos template pour les apps greenfield avec CI/CD embarqué
- **MCP Teams** : gros chantier, identifié P1 dans le plan (bot Teams)

---

## 8. Points clés à retenir

1. **Le guard c'est juste un `if` côté serveur.** Pas de magie, pas de LLM qui "décide".
   Le code métier ne s'exécute tout simplement pas si la précondition workflow n'est pas remplie.

2. **Chat et MCP ont deux mécanismes différents mais équivalents.**
   Chat = contrôle du system prompt envoyé au LLM.
   MCP = rejet de la réponse au tool call.
   Dans les deux cas, c'est déterministe et côté serveur.

3. **Provider-agnostic = GitProvider abstraction.** C'est ce qui permet de ne pas être
   couplé à GitLab comme Glass. Le prix : une couche d'abstraction à construire, mais
   la flexibilité pour supporter GitHub, local, etc. sans rewrite.

4. **Le "plancher qui monte" de Ramp est activé par le Sensei.** Un skill créé par un lead
   devient automatiquement baseline pour l'équipe via la Nightly Synthesis — personne
   n'a à configurer manuellement "installe ça pour tout le monde".

5. **Le KG Memory est le prérequis bloquant.** Sans lui, le Sensei est aveugle, la
   Nightly Synthesis n'a pas de destination, le Jira Intelligent manque de contexte.
   **C'est le premier chantier.**

6. **On s'appuie sur l'existant.** Le workflow guard est une extension du permission
   check qui existe déjà. Le pattern `McpActor` + `effectivePermissions` se prolonge
   naturellement avec `effectiveWorkflowSessions`. Pas de refonte, une addition.

---

## 9. Prochaines étapes suggérées

1. **Modéliser le schéma du KG Memory** (entités, relations, services d'alimentation)
2. **POC du Workflow Guard MCP** : un seul tool (`create_skill`) avec son workflow pour
   valider le pattern technique de bout en bout
3. **Définir le GitProvider interface** et stubber une implémentation GitLab minimale
4. **Lister les Governed Actions initiales** pour le enterprise tier 2 (probablement 10-15)
5. **Prototyper l'Intent Classifier chat** (rule-based) sur 3-4 intents critiques

---

*Note : ce doc remplace la version précédente avec les gros diagrammes Mermaid qui
étaient illisibles en terminal. Tout est maintenant en ASCII compact.*
