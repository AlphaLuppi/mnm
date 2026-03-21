---
stepsCompleted: [1, 2, 3]
session_topic: 'Enterprise-readiness MnM — Architecture organisationnelle + CAO + Per-user Pods'
session_goals: 'Définir architecture enterprise atomique, customisable, résistante au changement'
selected_approach: 'technical-feasibility'
context_file: ''
---

# Architecture Enterprise MnM — Roles + Tags + Workflows

**Brainstorming stratégique : rendre MnM adaptable à toute structure d'entreprise**

**Participants :** Tom (co-founder), Gab (dev), Niko (CEO)
**Dates :** 2026-03-20 → 2026-03-21

---

## 1. Le problème

MnM aujourd'hui est rigide :

- **4 business roles hardcodés** : admin, manager, contributor, viewer
- **12 agent roles hardcodés** : engineer, designer, pm, qa...
- **Permissions figées dans le code** (ROLE_PERMISSION_PRESETS)
- **Assignation directe uniquement** : 1 issue → 1 agent ou 1 user
- **Pas de teams, services, départements** — seulement des projects
- **Multi-company inutile** — 1 instance MnM = 1 entreprise
- **Pas de pool de tâches** — tout est assigné à quelqu'un
- **Pas d'orchestrateur intelligent** — le routage est manuel

Ça ne marche pas pour les vraies entreprises qui ont des structures variées, des gens qui bougent, et des process qui évoluent.

---

## 2. Ce qu'on veut

1. L'admin définit SA structure organisationnelle à l'onboarding
2. Niveaux de permissions hiérarchiques (Admin > Lead > Member...)
3. Assignation flexible (personne, groupe, rôle, ou pool)
4. Un CAO qui surveille et conseille sans bloquer
5. Que ça marche pour une startup de 3 comme pour une corp de 500
6. Que ce soit maintenable dans le temps (turnover, re-orgs, migration IA)
7. Per-user pods pour isoler les auth Claude Code

---

## 3. Décisions prises (Tom, 2026-03-20)

| # | Décision | Détail |
|---|----------|--------|
| D1 | **Single-tenant** | 1 instance MnM = 1 entreprise. Virer la sidebar company. Garder companyId en DB (0 migration, RLS intact), cacher de l'UI. |
| D2 | **Task Pool = issues sans assignee** | Pas de nouvelle table. Le pool c'est les issues non-assignées. Multi-niveaux : personne → pool, groupe → pool filtré, direct → assignation classique. |
| D3 | **Pods persistants par user** | Chaque user pop un Docker avec son `claude login`. Persistent (sinon il faut re-login = enfer). Idle timeout long (heures). |
| D4 | **CAO = dual-nature** | Service système silencieux (monitore, commente, trace les bypass) + agent adressable (@cao dans un commentaire → il répond). Le "concierge intelligent". |
| D5 | **Rôles custom** | Les 4 business roles et 12 agent roles hardcodés disparaissent. L'entreprise définit ses propres rôles et sa propre structure. |
| D6 | **Business model** | Package entreprise : install + onboarding + consulting + formation IA. Abo annuel par taille. Budget Claude poolifié (pas per-user). |
| D7 | **CAO = watchdog, pas gatekeeper** | L'utilisateur route comme il veut. Le CAO surveille, commente, trace les bypass, émet des warnings. Ne bloque JAMAIS. |

---

## 4. Trois solutions explorées

### Solution A — Tags flat

**Principe :** 1 seul concept. Un tag = rôle, team, service, skill, tout.

```
4 tables : tags, principal_tags, tag_permissions, tag_includes
```

| + | - |
|---|---|
| Flexibilité maximale (★★★★★) | Concept ambigu — "c'est quoi un tag ?" |
| 1 seul mécanisme partout | Mélange permissions + organisation |
| Skills natifs | Risque chaos / tag sprawl |
| Couverture ~95% des use cases | Niveaux = add-on, pas natif |
| | Dur à maintenir avec le turnover |

### Solution B — Roles + Teams

**Principe :** 2 concepts séparés. Rôle = droits. Team = organisation.

```
2 tables : roles, teams (+2 colonnes modifiées)
```

| + | - |
|---|---|
| Mental model clair (★★★★★) | Casse sur les profils cross-équipes |
| Niveaux natifs | Pas de skills natif |
| Résistant au chaos | Lead IA cross 5 produits = 5 membership rows |
| Nouvel admin comprend en 30s | Rôles transversaux (Proxy-PO) = awkward |
| Couverture ~85% des use cases | |

### Solution C — Hybride (Roles + Tags)

**Principe :** Séparer ce qui est STABLE de ce qui est VOLATILE.

```
STABLE = les RÔLES (permissions, niveaux, change rarement)
VOLATILE = les TAGS (organisation, routing, change avec l'org)
```

```
roles  (id, name, permissions jsonb, inherits_from_id, color, icon)
  → Petit set stable : Admin, Lead, Member, Viewer
  → Permissions + hiérarchie intégrées
  → Change rarement (promotion = changement de rôle)

tags   (id, name, color, icon, description, archived_at)
  → Set flexible : teams, produits, skills, fonctions...
  → AUCUNE permission — juste de l'organisation
  → Bouge tout le temps (re-orgs, nouveaux produits, splits...)
  → archived_at pour les tags legacy

company_memberships (modifié)
  → business_role text  →  role_id uuid FK

principal_tags (nouveau)
  → (principal_type, principal_id, tag_id) — many-to-many

issues (modifié)
  → + assignee_tag_id uuid FK
```

**2 nouvelles tables. Modifications sur 2 existantes.**

---

## 5. Crash test — AlphaLuppi vs CBA

### AlphaLuppi (3 pers, 2 produits)

```
Rôles : Admin, Member
Tags  : MnM, Bienvenue

Tom    → role=Admin,  tags=[MnM, Bienvenue]
Gab    → role=Member, tags=[MnM, Bienvenue]
Niko   → role=Admin,  tags=[MnM, Bienvenue]

→ Les 3 solutions marchent. Match nul. (Normal, 3 personnes.)
```

### CBA (structure matricielle complexe)

```
5 produits, teams front/back par produit, Cross Tech, UIKit,
Lab Innovation, Market, Com, PO par produit ET multi-produit,
Proxy-PO, designers cross, UXR, Lead IA cross...
```

**8 profils testés :**

```
                                    Tags    R+T    Hybride
                                    ────    ───    ───────
Jean  (Dev Product-A + Lead UIKit)   ✅      ✅      ✅
Marie (PO multi-produit A+B)         ✅      ✅      ✅
Sophie (Designer + cross-design)     ✅      😬      ✅
Lucas (Cross Tech hardware)         ✅      ✅      ✅
Léa   (Lead IA cross 5 produits)    ✅      😬😬    ✅
Pierre (Proxy-PO Product-C)         ✅      😬      ✅
Camille (UXR cross)                 ✅      ✅      ✅
Hugo  (Dev Product-B + Lab Inno)    ✅      ✅      ✅
                                    ────    ───    ───────
Score                               8/8    5/8     8/8
```

**Roles+Teams casse sur les profils cross et les rôles transversaux.**
Tags et Hybride gèrent tout nativement.

Exemple concret avec l'hybride :
```
Jean → role=Member, tags=[Developer, Frontend, Product-A, UIKit, Lead-UIKit]
Léa  → role=Lead,   tags=[IA, Product-A, Product-B, Product-C, Product-D, Product-E]

Permissions Jean : Member (agents:launch, traces:read...)
Visibilité Jean  : issues assignées à Developer, Frontend, Product-A, ou UIKit
```

---

## 6. Résistance au changement

**Scénarios testés :**

| Changement | Hybride |
|------------|---------|
| **Re-org** (Product → Domain teams) | Créer nouveaux tags, ajouter aux gens, archiver les anciens. Les deux structures COEXISTENT pendant la transition. Permissions intactes. |
| **Promotion** (Dev → Lead) | Changer role_id. Tags inchangés. Nouvelles permissions instantanées. |
| **Split team** (Auth → Auth-Identity + Auth-OAuth) | 2 nouveaux tags, répartir les gens, archiver l'ancien. Issues historiques lisibles. |
| **Rôle disparaît** (QA → tout le monde teste) | Supprimer/mettre à jour le rôle. Tags inchangés. |
| **Nouveau venu** | 1 rôle + copier les tags du prédécesseur. 1 clic. |
| **Transition graduelle** (Dev → Product Engineer) | Nouveau rôle "Product Engineer". Migrer les gens progressivement. Les deux rôles coexistent. |
| **Fusion produits** (D+E → DE) | Nouveau tag Product-DE, ajouter aux gens, archiver D et E. |

**Principe clé : les rôles bougent PAS, les tags bougent.** Quand l'org change → tags. Quand les droits changent → rôles. Les deux dimensions sont indépendantes.

**Les tags sont ADDITIFS** — on ajoute avant de retirer. Pendant la transition, ancien et nouveau coexistent. Pas de switch binaire.

**Le CAO aide au nettoyage :**
- "⚠️ 3 issues sont encore assignées à Auth-Squad (archivé)"
- "⚠️ Jean a le tag Product-D mais ce produit a fusionné en Product-DE"

---

## 7. Tableau comparatif final

```
                            Tags flat   Roles+Teams   HYBRIDE
                            ─────────   ───────────   ───────
Flexibilité                  ★★★★★       ★★★★☆        ★★★★★
Clarté                       ★★☆☆☆       ★★★★★        ★★★★☆
Niveaux natifs               ★★★☆☆       ★★★★★        ★★★★★
Résistance au chaos          ★★☆☆☆       ★★★★☆        ★★★★☆
Maintenabilité               ★★☆☆☆       ★★★★★        ★★★★☆
Gestion du changement        ★★★★★       ★★★☆☆        ★★★★★
Profils cross/matriciels     ★★★★★       ★★☆☆☆        ★★★★★
Skills natifs                ★★★★★       ★★☆☆☆        ★★★★★
Tables nouvelles             4            2(+2 cols)   2(+2 cols)
Couverture use cases         ~95%         ~85%         ~95%
Score CBA                    8/8          5/8          8/8
```

---

## 8. Faisabilité technique

### L'existant MnM réutilisable

| Feature | Status |
|---------|--------|
| Container lifecycle manager | ✅ Fait |
| Mount allowlist + credential proxy | ✅ Fait |
| Network isolation | ✅ Fait |
| RLS PostgreSQL (51 tables) | ✅ Fait |
| Agent JWT auth | ✅ Fait |
| XState state machine (11 états) | ✅ Fait |
| Wakeup requests (signaling agents) | ✅ Fait |
| Onboarding wizard (7 steps) | ✅ Fait |
| Permission resolution 2-couches | ✅ Fait (à adapter) |

### Effort estimé

| Axe | Effort | Risque |
|-----|--------|--------|
| Roles + Tags + Single-tenant | 3-4 sem | Faible |
| CAO (service + agent dual) | 3-4 sem | Moyen |
| Per-user pods (Docker) | 4-6 sem | Moyen-élevé |
| **Total parallélisé** | **~6-8 sem** | |

### Migration depuis l'existant

```
Phase 1 : Tables roles + tags + principal_tags
Phase 2 : Migration auto : businessRole → role_id, agentRole → tags
Phase 3 : hasPermission() check via roles au lieu des presets
Phase 4 : assignee_tag_id sur issues
Phase 5 : Single-tenant (hide company UI, auto-inject companyId)
Phase 6 : Onboarding wizard repensé
Phase 7 : CAO agent
Phase 8 : Per-user pods

Chaque phase déployable indépendamment. Pas de big-bang.
```

---

## 9. Per-user Pods — Architecture

```
MnM Server (central)
├── PostgreSQL (centralisé, RLS)
├── Redis (sessions, queues)
├── User Pod Orchestrator
│
├── Pod Alice (Docker, persistant)
│   ├── HOME=/user-pods/alice/
│   ├── .claude/config (auth Claude d'Alice)
│   └── Tous les agents d'Alice tournent ici
│
├── Pod Bob (Docker, persistant)
│   ├── HOME=/user-pods/bob/
│   ├── .claude/config (auth Claude de Bob)
│   └── Tous les agents de Bob tournent ici
```

**Ce qui manque :** pod lifecycle manager, claude login UI (WebSocket terminal), table user_pods, idle timeout.

**Docker first**, K8s plus tard.

---

## 10. CAO — Chief Agent Officer

```
Auto-créé au setup de l'instance.
A tous les tags (voit tout).
Rôle = Admin (toutes les permissions).

MODE SILENCIEUX :
  → Hook sur events issue/stage lifecycle
  → Détecte les bypass de workflow
  → Commente les issues (suggestions, warnings)
  → Trace dans l'audit log
  → Détecte les tags archivés encore utilisés

MODE INTERACTIF :
  → @cao dans un commentaire → il répond
  → "Quels agents sont dispo ?"
  → "Ce workflow est-il respecté ?"
  → "Suggère-moi qui devrait prendre ça"
  → "Résume l'état du projet X"
```

Nom "CAO" déposé par Niko.

---

## 11. Questions ouvertes

1. **Naming des tables** — `tags` comme nom de table pour l'organisation, ça convient ? Ou un autre mot ? (groups, labels, scopes...)
2. **Onboarding UX** — Presets à proposer ? ("Par rôles", "Par équipes", "Agile", "Custom")
3. **Docker cassé** — "docker not available" à investiguer
4. **Le CAO techniquement** — Quel LLM pour le CAO ? Claude via le même pod system ? Haiku pour le monitoring silencieux, Sonnet pour les réponses interactives ?
5. **Priorité de dev** — Quel axe en premier ? Recommandation : Roles+Tags (base) → CAO → Pods
