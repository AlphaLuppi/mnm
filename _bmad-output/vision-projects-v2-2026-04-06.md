# Vision: Projects v2 — MnM

**Date:** 2026-04-06
**Auteur de la vision:** Tom (co-fondateur AlphaLuppi)
**Documenté par:** Session brainstorm interactive

---

## Philosophie fondamentale

MnM est un **cockpit de supervision**, pas un IDE, pas un Jira, pas un GitHub. Les devs gardent leurs IDEs. Les PM ne font pas de la gestion de tickets. MnM **orchestre des agents AI** et donne à chaque personne la visibilité dont elle a besoin sur le produit.

**Trois principes non-négociables :**

1. **Légèreté** — Pas de nouvelles entités spécifiques (pas de "Feature", "Handoff", "HealthScore" comme tables DB). On relie ce qui existe déjà.
2. **Agnosticité** — Doit marcher pour AlphaLuppi (3 personnes, startup) comme pour CBA (enterprise réglementé). Zéro logique métier hardcodée.
3. **Flexibilité** — La puissance vient des liens entre entités + des Blocks composables + des agents configurables, pas de structures figées.

---

## La vision en une phrase

> **Un produit est un ensemble de fonctionnalités vivantes, reliées à des specs, du code et des tests, où chacun collabore via le chat avec l'IA et où les agents maintiennent les liens automatiquement.**

---

## Les deux espaces

MnM se divise en deux espaces fondamentaux :

### Espace Créatif (le Chat)

C'est là que les gens **pensent**. L'interface primaire pour brainstormer, itérer, prototyper.

- Chat avec l'IA, pas un éditeur de documents
- **Share & Fork** — partager un chat, quelqu'un d'autre le fork, bosse dessus, repartage. Modèle git-like du contexte. Pas de co-editing temps réel.
- **Pas de rôles figés** — n'importe qui peut brainstormer sur n'importe quoi. Un "PM" peut faire de l'archi, un "dev" peut faire du product. Les rôles sont de plus en plus flous. Chacun ajoute ses inputs, les idées circulent entre les personnes qui ont besoin du "goût" des autres.
- **Context toggle** — deux modes :
  - **Green field** : sans accès à la codebase existante, pour ne pas polluer la créativité avec le legacy
  - **Impact mode** : avec accès à la codebase via GitNexus MCP, pour comprendre comment les idées s'implémentent dans le produit actuel
- **Prototypage & déploiement** — l'IA peut générer un prototype, le déployer sur l'infra MnM pour des tests utilisateurs. Anti shadow IT : les PM ne déploient pas sur Vercel/Netlify en douce. MnM est l'outil officiel. Anti shadow IA aussi.
- **Le chat produit des artefacts** : PRD, recos UX, prototypes, études, références, cahiers des charges — tout ce qui sort du brainstorm.

### Espace Production (le Projet)

C'est là que les agents **travaillent**. Le terrain commun entre les personnes et les agents.

- **Projet = Produit** — un projet MnM représente un produit complet (ex: "Agathe" chez CBA)
- **Multi-codebase** — un produit peut avoir N codebases/workspaces (app mobile, web Angular, vieille app Struts...). Chaque codebase a son MCP GitNexus.
- **Issues = l'unité universelle** — une issue peut représenter n'importe quoi : une feature, une tâche, un bug, un requirement. La sémantique vient des tags/labels et des liens, pas du type.
- **Visibilité par tags + RBAC** — le projet appartient à l'entreprise. Plusieurs personnes y accèdent selon leurs tags et rôles. Chacun voit et fait des choses différentes.
- **Dashboards composables (Blocks)** — chaque personne compose sa vue. Pas d'onglets figés.

---

## La transition : du Chat au Projet

La transition entre brainstorm et réalisation doit être **la plus fluide possible avec le moins de perte d'information**.

### Le problème du chat brut

Un chat de brainstorm de 2h contient du bruit : fausses pistes, digressions, itérations abandonnées. Le PM ne veut pas tout balancer aux équipes prod. Il a besoin d'un outil pour **distiller** son brainstorm en quelque chose de propre et structuré.

### La solution : un agent extracteur (skill/tool)

Le handoff n'est pas une entité — c'est un **agent/skill** dans MnM.

1. Le PM brainstorme dans un chat avec l'IA
2. Le chat accumule des **context links** vers des artefacts (documents, prototypes, autres chats, références)
3. Quand le résultat est satisfaisant, le PM invoque le **skill de handoff** (ex: `/handoff` ou un agent dédié)
4. L'agent extracteur :
   - Lit tout le chat + les artefacts liés
   - Extrait les décisions clés, specs validées, recos, références
   - Produit un **document structuré** (artifact) — propre, lisible, prêt pour les équipes prod
   - Le PM review et ajuste avant de valider
5. Ce document structuré est **lié au projet** comme un artifact
6. Les destinataires lisent CE document (pas le chat brut)
7. À partir du document, un agent peut proposer un découpage en issues

### Ce que le document de handoff peut contenir

Selon la taille du besoin, l'agent extracteur adapte le format :
- Un résumé en quelques bullet points (petit truc → juste une issue)
- Un document structuré avec specs, recos UX, contraintes techniques, références
- Un lien vers un prototype déployé + retours utilisateurs
- Des références vers les fichiers source du brainstorm (études, stats, chiffres)
- Un cahier des charges formel avec requirements numérotés (si le PM a poussé jusque-là)

### Le flow complet

```
Chat (brainstorm)
  → Context links (artefacts accumulés)
    → Skill "/handoff" (agent extracteur)
      → Document structuré (artifact)
        → PM review & valide
          → Lié au projet
            → Agent propose découpage en issues
              → Équipes prod prennent le relais
```

**Le chat peut aussi être partagé/forké** (fonctionnalité existante) pour que d'autres collaborateurs ajoutent leurs inputs avant le handoff. Le fork/share sert à la collaboration AVANT le handoff. Le document structuré sert au transfert VERS la production.

### Où atterrit le handoff ?

L'agent extracteur propose l'atterrissage en fonction du contenu. Le PM valide.

| Taille du besoin | Atterrissage | Exemple |
|---|---|---|
| **Gros truc nouveau** | Nouveau noeud feature (en status draft) | "Ajout SSO entreprise" → nouvelle feature |
| **Évolution d'un existant** | Issues ajoutées sous une feature existante + maj spec | "Ajouter OIDC à l'auth" → issues sous feature "Authentification" |
| **Petit truc** | Juste une issue rattachée à la bonne feature | "Fix le timeout SSO" → issue sous "Authentification" |

Pas de workflow rigide — **le contenu dicte la forme**. L'agent propose, l'humain dispose.

---

## La traceability (sans nouvelles entités)

### Le modèle de données

**Deux ajouts structurels :**

**1. Feature nodes** — l'arbre de fonctionnalités du produit

```sql
features (
  id            UUID PRIMARY KEY,
  project_id    UUID NOT NULL REFERENCES projects(id),
  company_id    UUID NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,              -- le TLDR humain
  parent_id     UUID REFERENCES features(id),  -- arbre
  metadata      JSONB,             -- métriques cachées + libre
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
)
```

Ultra léger — juste un nom dans un arbre. Le metadata stocke les métriques agrégées (issues done/total, tests passing/total, coverage %, compliance status). Mis à jour via live events.

**2. Entity links** — le graph de liens entre toutes les entités

```sql
entity_links (
  id            UUID PRIMARY KEY,
  company_id    UUID NOT NULL,
  source_type   TEXT NOT NULL,     -- 'feature', 'issue', 'chat_channel', 'artifact'
  source_id     UUID NOT NULL,
  target_type   TEXT NOT NULL,     -- 'feature', 'issue', 'document', 'test', 'artifact'
  target_id     UUID NOT NULL,
  link_type     TEXT NOT NULL,     -- libre: 'implements', 'tests', 'references', 'spec', ...
  metadata      JSONB,             -- infos complémentaires libres
  created_by    UUID,
  created_at    TIMESTAMPTZ
)
```

Les link_types sont **libres** — pas d'enum. Chaque entreprise utilise les siens.

**Ce que ça connecte :**

```
Feature ←→ Issue         (feature contient des issues)
Feature ←→ Document      (feature a des specs)
Feature ←→ Test          (feature est testée par)
Feature ←→ Feature       (parent/child via parent_id, OU dépendances via link)
Issue   ←→ Issue         (parent/child, depends-on, blocks)
Issue   ←→ Document      (implements, references)
Issue   ←→ Test          (tested-by, validates)
Chat    ←→ Feature       (originated-from, discusses)
Chat    ←→ Document      (produced, references)
```

Les agents maintiennent ces liens automatiquement :
- Quand un agent crée une issue à partir d'un chat → lien auto
- Quand un agent dev commit → lien issue ↔ fichiers modifiés
- Quand un agent QA écrit un test → lien test ↔ issue/spec

### Comment ça répond à chaque besoin

**"Où en est ma feature ?"**
→ Une issue parent avec des issues enfants. Un Block agrège : X% issues done, Y tests passing, Z specs liées. Pas besoin d'entité "Feature" — c'est juste une issue avec des enfants et des liens.

**"Quelle est la couverture de test de mon produit ?"**
→ Un Block parcourt toutes les issues du projet avec leurs liens vers les tests. Calcule la couverture. Chaque entreprise définit ce que "couverture" signifie pour elle.

**"Ce cahier des charges est-il couvert ?"**
→ Un document (cahier des charges) lié à N issues. Chaque issue liée à des tests. Le Block montre : REQ-01 → issue done + 3 tests passing. REQ-02 → issue in progress + 0 tests. Couverture : 50%.

**"Si je change cette feature, quel impact ?"**
→ Le chat a le contexte du projet (via context link). L'agent query : liens de la spec → issues → leur statut → tests liés. Plus GitNexus MCP pour l'impact code. Réponse contextualisée selon l'état du lifecycle.

**"Je veux supprimer cette feature, c'est safe ?"**
→ L'agent montre : cette feature a 8 issues (toutes done), 15 tests (tous passent), liée à 2 cahiers des charges (REQ-04, REQ-07). Si les cahiers des charges ne l'exigent plus → safe to remove. Si c'est requis → warning.

---

## Code Intelligence : 1 MCP server par repo

Chaque codebase/workspace dans un projet a un **MCP server GitNexus** qui expose le knowledge graph du code.

### Qui l'utilise

- **Les agents dev** (dans leur sandbox) — pour ne plus faire de blind edits, comprendre les dépendances, évaluer l'impact avant de modifier
- **Les gens dans leur chat** (via context toggle) — pour comprendre comment leurs idées s'implémentent, évaluer la complexité, mesurer l'impact d'un changement
- **Les gens dans leur IDE** (Cursor, VSCode, Claude Code) — en se connectant au MCP endpoint du projet MnM

### Comment ça marche

1. Un repo est lié au projet (ProjectWorkspace avec repoUrl)
2. MnM auto-clone dans le sandbox + `gitnexus analyze`
3. `gitnexus mcp` tourne comme process dans le sandbox
4. MnM expose un proxy : `/projects/:id/mcp` → forward vers le sandbox
5. N'importe quel client MCP peut se connecter

### Ce que ça permet

- "Quels fichiers sont impactés si je change l'interface User ?" → sans cloner le repo
- "Montre-moi le call chain de processPayment" → visualisation bout en bout
- "Combien de modules dépendent du service d'auth ?" → évaluation de complexité
- "Ce changement est-il risqué ?" → blast radius analysis

---

## La Feature Map — vue centrale du projet

### Ce que c'est

La Feature Map est **la vue principale** quand on ouvre un projet. C'est le plan du produit — toutes ses fonctionnalités, à plusieurs niveaux de granularité. C'est pas un Block parmi d'autres dans un dashboard — c'est la **structure de navigation** du projet.

C'est la documentation centrale vivante du produit, maintenue automatiquement par les agents.

### Pourquoi c'est structurant

Quand quelqu'un ouvre un projet dans MnM, peu importe qui il est, il voit les features du produit. Ensuite il creuse au niveau de granularité qui l'intéresse :

| Qui | Ce qu'il cherche | Niveau de profondeur |
|-----|-----------------|---------------------|
| **Nouveau dans l'entreprise** (onboarding) | Scanner les projets, comprendre ce que fait le produit | Niveau 0 : liste des features + descriptions |
| **Nouveau PO** sur le projet | Comprendre les specs fonctionnelles de chaque feature | Niveau 1 : specs liées, ACs, cahiers des charges |
| **PM chevronné** | Impact de chaque feature, importance, liens compliance | Niveau 2 : dépendances, cahiers des charges gouvernementaux, couverture |
| **Nouveau dev** sur le projet | Voir les fichiers sources et le code lié à une feature | Niveau 3 : code (via GitNexus MCP), issues techniques, tests E2E |
| **QA** | Couverture de tests par feature | Niveau 2-3 : tests liés, résultats, coverage % |
| **Compliance officer** | Conformité par requirement | Niveau 1-2 : cahier des charges → requirements → tests prouvant conformité |
| **CEO / Direction** | Vue macro santé du produit | Niveau 0 : features + indicateurs globaux |

### Comment ça marche sans entité "Feature"

Une "feature" n'est pas un type d'entité — c'est **une issue qui a des enfants et des liens vers des specs/tests**. La sémantique vient des tags et des liens.

```
Projet: Agathe
│
├── "Authentification"              [tag libre]
│   ├── Specs liées: auth-spec.md, sso-architecture.md
│   ├── Issues enfants: 5/7 done
│   ├── Tests E2E liés: 8 (tous passent)
│   ├── Code source: 3 modules (via GitNexus)
│   └── Cahier des charges: ISO-27001-A942
│
├── "Tableau de bord"               [tag libre]
│   ├── Specs liées: dashboard-prd.md
│   ├── Issues enfants: 3/5 done
│   ├── Tests E2E liés: 4 (2 passent, 2 pending)
│   └── Code source: 2 modules
│
└── "Conformité RGPD"              [tag libre]
    ├── Specs liées: cahier-des-charges-rgpd.md
    ├── Issues enfants: 2/4 done
    ├── Tests E2E liés: 5 (3 passent, 1 fail, 1 pending)
    └── Réglementaire: RGPD Art. 17, Art. 20
```

### Les niveaux de granularité

**Niveau 0 — Carte** (vue par défaut)
```
Feature              Status       Issues    Tests     Coverage
Authentification     ● active     5/7       8/8 ✅    89%
Tableau de bord      ● active     3/5       2/4 ⚠️    45%
Conformité RGPD      ● active     2/4       3/5 ⚠️    60%
SSO Entreprise       ○ nouveau    0/0       0/0       0%
```

**Niveau 1 — Feature** (clic sur une feature)
- Description / brief (auto-généré ou manuel)
- Specs et documents liés
- Cahiers des charges / compliance liés
- Liste des issues enfants avec statut
- Résumé couverture tests

**Niveau 2 — Detail** (clic sur une spec, un cahier des charges, etc.)
- Contenu de la spec
- Requirements individuels → issues liées → tests liés
- Drift detection (spec vs implémentation actuelle)
- Historique des changements

**Niveau 3 — Code** (via GitNexus MCP)
- Modules et fichiers liés à cette feature
- Call graph, dépendances
- Blast radius si modification
- Complexité technique

### La flexibilité par l'usage

- **Startup (AlphaLuppi)** : features avec quelques issues chacune, pas de cahier des charges. La Feature Map montre l'avancement de chaque feature. Simple.
- **Enterprise réglementé (CBA)** : features structurées avec requirements numérotés, liens vers cahiers des charges, couverture de tests par requirement. La même Feature Map montre une matrice de conformité.
- **Agence / freelance** : features par client/contrat, liées aux specs du brief client.
- **Même mécanisme. Même UI. Usage différent.** La sémantique vient des tags et des liens, pas des types d'entités.

### Deux vues par feature : TLDR + Full Doc

**TLDR = métriques cachées sur le noeud feature**

Le noeud feature stocke des métriques agrégées dans son `metadata JSONB`, mises à jour à chaque événement (issue fermée, test passé, lien ajouté) via les live events existants :

```json
{
  "issuesDone": 14, "issuesTotal": 22,
  "testsPassing": 20, "testsTotal": 26,
  "coverage": 77,
  "complianceStatus": "partial",
  "lastUpdated": "2026-04-06T14:30:00Z"
}
```

C'est ce que la Feature Map affiche dans la vue liste. Coût de rendu : quasi zéro (pas de query complexe, juste lire le noeud).

**Full Doc = document complet auto-généré par un agent**

Même pattern que les traces Gold (Bronze → Silver → Gold). Un agent génère un document exhaustif de la feature, stocké comme artifact lié au noeud :

```markdown
# Création d'ordonnance

## Résumé
Permet aux médecins de créer des ordonnances électroniques...

## État actuel
- Issues: 14/22 (64%)
- Tests E2E: 20/26 (77%)
- Compliance HAS: 8/10 requirements

## Specs liées
- spec-ordonnance-global.md (approved)
- cahier-des-charges-HAS.md → REQ-04, REQ-07, REQ-12...

## Plateformes
### Web (Angular)
- 8/12 issues, 15 tests
- Modules: ordonnance-service, prescription-form...
### Mobile (React Native)
- 6/10 issues, 11 tests
- Modules: OrdonnanceScreen, PrescriptionAPI...

## Code source (via GitNexus)
- 3 modules partagés, 2 web-only, 2 mobile-only
- Call chain: createPrescription → validateDrug → signOrdonnance

## Historique
- 2026-03-15: Handoff PM → équipe dev
- 2026-03-22: 50% issues done
- 2026-04-01: Premier test E2E compliance HAS passé
```

**Régénéré** quand un changement significatif se produit (issue fermée, test status change, spec modifiée) — pas à chaque commit. L'agent reçoit l'événement, régénère le doc, le stocke comme artifact.

Quand quelqu'un ouvre une feature → le doc est déjà là, pas de query à la volée.

### Comment la Feature Map est alimentée

- **Manuellement** : quelqu'un crée une issue "Authentification" avec un tag et des sous-issues
- **Via handoff** : l'agent de handoff crée la feature + ses sous-issues à partir du document distillé
- **Par discovery** : un agent analyse la codebase (GitNexus) et propose une feature map initiale basée sur les clusters fonctionnels détectés
- **En continu** : les agents maintiennent les liens (code → feature, test → feature) au fur et à mesure de leur travail

La Feature Map **vit et grandit** avec le produit. C'est pas un document à maintenir manuellement — les agents font le gros du boulot.

---

## Smart Change Impact — guidé par l'état du lifecycle

Le PM dans son chat demande : "Je veux modifier le flow d'authentification."

L'agent regarde l'état des liens :

| État détecté | Réponse de l'agent |
|---|---|
| Aucune issue liée | "Aucun travail en cours sur cette spec. Tu peux la modifier librement." |
| Issues créées mais pas commencées | "3 issues ont été créées mais personne n'a commencé. Modification sans impact." |
| Issues en cours | "2 issues en cours (MNM-42 par agent-backend, MNM-43 par agent-frontend). ~15h de travail effectué. Modifier la spec impactera leur travail. Je recommande une synchro." |
| Feature livrée | "Feature en production. 12 tests E2E passent. Le code touche 3 modules (auth-service, session-manager, middleware via GitNexus). Modifier nécessitera : update des specs, potentiellement 8 tests à réécrire, 2 modules à refactorer." |

**L'agent calcule tout ça** à partir des liens (issue status + test results) et du knowledge graph code (GitNexus MCP). Pas besoin d'entité "ChangeImpact" — c'est un calcul à la volée.

---

## Ce qui existe déjà vs ce qu'il faut construire

### Déjà là (câbler/améliorer)

| Brique | Fichiers | État |
|--------|----------|------|
| Chat avec IA | Chat.tsx, AgentChatPanel, chat.ts, chat-completion.ts | ✅ Fonctionne |
| Chat sharing (share + fork) | chat-sharing.ts, SharedChat.tsx | ✅ Fonctionne |
| Context links sur chats | chatSharingApi.addContextLink | ✅ Fonctionne |
| Issues + tags | Issues système complet | ✅ Fonctionne |
| Issue parent/child | Issue linking basique | ⚠️ Vérifier/enrichir |
| Workspace + repo | ProjectWorkspace (repoUrl, repoRef) | ✅ Stockage OK, pas d'auto-clone |
| Blocks Platform | BF-03 à BF-07 livrés | ✅ Fonctionne |
| RBAC dynamique | Roles, permissions en DB | ✅ Fonctionne |
| Tags + visibilité | Tag-based isolation | ✅ Fonctionne |
| Prototype deployment | Artifact deployment (commencé) | 🔄 En cours |
| GitNexus | Indexé sur MnM (8752 nodes, 21K edges) | ✅ Testé |

### À construire (nouveau)

| Brique | Description | Effort estimé |
|--------|-------------|---------------|
| **Feature nodes** | Table `features` (arbre de noeuds légers par projet) | 1-2j |
| **Entity links** | Table `entity_links` (graph de liens générique entre toutes entités) | 2-3j |
| **Feature Map UI** | Vue centrale du projet : arbre de features + TLDR métriques | 3-5j |
| **Feature Full Doc** | Agent qui génère le document exhaustif par feature (pattern Gold) | 2-3j |
| **Feature metrics cache** | Listener live events → met à jour metadata des feature nodes | 1-2j |
| **Auto-clone + GitNexus dans sandbox** | Clone repo au setup workspace + gitnexus analyze | 2-3j |
| **MCP proxy** | `/projects/:id/mcp` proxy vers le sandbox GitNexus | 1-2j |
| **Context toggle sur chat** | Activer/désactiver GitNexus MCP dans le contexte du chat | 1-2j |
| **Handoff skill** | Agent extracteur qui distille un chat en document structuré | 2-3j |
| **Agent link maintenance** | Les agents créent/maintiennent les links automatiquement | 3-5j |
| **Change impact computation** | Agent calcule l'impact depuis les liens + GitNexus | 2-3j |

**Total nouveau : ~20-30 jours**

---

## Anti-patterns à éviter

1. **Ne pas créer d'entités "Feature", "Handoff", "Requirement"** — tout passe par les issues + liens + tags
2. **Ne pas hardcoder des rôles** (PM, Dev, QA) dans l'UI — chaque personne compose sa vue via Blocks
3. **Ne pas recréer GitHub/Jira** — pas de board Kanban, pas de burndown, pas de sprint planning (sauf si un Block le fait)
4. **Ne pas faire de git UI** — les diffs, branches, PRs restent dans les IDEs/GitHub
5. **Ne pas forcer un workflow** — le système de liens est flexible, chaque entreprise structure comme elle veut
6. **Ne pas sur-spécifier les link_types** — laisser libre ("implements", "tests", "references" ou n'importe quoi d'autre)
7. **Ne pas oublier que MnM construit MnM** — si ça marche pas pour AlphaLuppi (3 personnes), c'est trop complexe

---

## Résumé exécutif

La vision Projects v2 repose sur **4 piliers** :

1. **Le Chat** comme espace créatif (share/fork, context toggle, prototypage)
2. **Les Liens** comme tissu connectif (entity_links générique entre tout)
3. **Les Blocks** comme vues composables (chacun voit ce qu'il veut)
4. **GitNexus MCP** comme intelligence code (1 server par repo, accessible à tous)

Zéro nouvelle entité métier. Un seul ajout structurel (entity_links). Le reste est du câblage entre ce qui existe + des Blocks de visualisation.

---

*Vision documentée le 2026-04-06 — Session brainstorm Tom + Claude*
