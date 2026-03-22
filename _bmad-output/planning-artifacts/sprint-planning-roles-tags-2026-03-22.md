# Sprint Plan — Roles + Tags + Dynamic Permissions

> **Date** : 2026-03-22
> **Source** : epics-roles-tags-2026-03-22.md, architecture-roles-tags-2026-03-22.md (v2)
> **Équipe** : Tom + Claude (1 dev humain + AI pair programming)
> **Sprint** : 1 semaine (cadence rapide, pas en prod)
> **Capacité** : ~40 SP/sprint (vélocité élevée grâce au pair programming Claude)

---

## Résumé

| Métrique | Valeur |
|----------|--------|
| Stories | 34 |
| Story Points | 132 |
| Sprints planifiés | 5 |
| Capacité/sprint | ~30-40 SP |
| Durée estimée | 5 semaines |

---

## Sprint 1 — Foundation (Schema + Nuke + Single-Tenant)

**Goal :** Le nouveau data model est en place, le legacy est supprimé, l'app compile.

| Story | Titre | SP | Epic |
|-------|-------|----|------|
| SCHEMA-01 | Tables permissions, roles, role_permissions | 3 | SCHEMA |
| SCHEMA-02 | Tables tags, tag_assignments | 3 | SCHEMA |
| SCHEMA-03 | Modifier company_memberships (role_id FK) | 2 | SCHEMA |
| SCHEMA-04 | Modifier agents (drop role, add created_by_user_id) | 2 | SCHEMA |
| SCHEMA-05 | Nuke code legacy (constantes, presets, grants) | 5 | SCHEMA |
| TENANT-01 | Auto-inject companyId middleware | 3 | TENANT |
| TENANT-02 | Supprimer companyId des URL paths | 5 | TENANT |
| TENANT-03 | Supprimer company UI | 2 | TENANT |

**Total : 25 SP** | Risque : faible (pas de logique complexe, juste du schema + cleanup)

**Definition of Done Sprint 1 :**
- [ ] Nouvelles tables créées avec RLS
- [ ] Schema Drizzle synchronisé
- [ ] Ancien code supprimé
- [ ] `bun run typecheck` passe (0 erreurs)
- [ ] `bun run build` passe
- [ ] Routes sans :companyId
- [ ] Company selector supprimé de l'UI

---

## Sprint 2 — Permission Engine (PERM + API)

**Goal :** Le moteur de permissions fonctionne avec le nouveau modèle. Les routes CRUD pour roles/tags/permissions sont opérationnelles.

| Story | Titre | SP | Epic |
|-------|-------|----|------|
| PERM-05 | Seed permissions standard | 2 | PERM |
| PERM-01 | Réécrire access.ts (hasPermission, canUser) | 5 | PERM |
| PERM-02 | TagScope middleware | 3 | PERM |
| PERM-03 | Cache permissions + tags | 3 | PERM |
| PERM-04 | Validation permissions au startup | 3 | PERM |
| API-01 | Routes CRUD Roles | 5 | API |
| API-04 | Routes Permissions + Member Role | 3 | API |

**Total : 24 SP** | Risque : moyen (hasPermission est critique, bien tester)

**Ordre important :**
1. PERM-05 d'abord (seed les permissions pour que le reste ait de la data)
2. PERM-01 (le coeur du moteur)
3. PERM-02 (TagScope dépend de PERM-01)
4. PERM-03 + PERM-04 en parallèle
5. API-01 + API-04 en parallèle

**Definition of Done Sprint 2 :**
- [ ] `hasPermission()` fonctionne avec roles DB + tag intersection
- [ ] TagScope injecté dans toutes les requêtes
- [ ] Cache avec invalidation fonctionnel
- [ ] Startup validation des permission slugs
- [ ] CRUD roles opérationnel via API
- [ ] Tests unitaires sur hasPermission (happy path + edge cases)

---

## Sprint 3 — Tags + Isolation

**Goal :** Les tags sont gérables via API. L'isolation inter-tags est enforced sur agents, issues, et traces.

| Story | Titre | SP | Epic |
|-------|-------|----|------|
| API-02 | Routes CRUD Tags | 5 | API |
| API-03 | Routes Tag Assignments | 5 | API |
| ISO-01 | Tag filtering sur les agents | 5 | ISO |
| ISO-02 | Tag filtering sur les issues | 5 | ISO |
| ISO-03 | Tag filtering sur traces et runs | 3 | ISO |
| ISO-04 | Tests E2E isolation inter-tags | 5 | ISO |

**Total : 28 SP** | Risque : moyen-élevé (isolation = sécurité, tester minutieusement)

**Ordre important :**
1. API-02 + API-03 d'abord (les tags doivent exister avant de filtrer)
2. ISO-01 puis ISO-02 puis ISO-03 (même pattern, difficulté décroissante)
3. ISO-04 en dernier (teste tout ce qui précède)

**Definition of Done Sprint 3 :**
- [ ] Tags CRUD opérationnel
- [ ] Assign/remove tags sur users et agents
- [ ] User Tag-A ne voit PAS les agents/issues de Tag-B
- [ ] Admin voit tout (bypass_tag_filter)
- [ ] User sans tags ne voit rien
- [ ] Tests E2E passent

---

## Sprint 4 — Agents + UI

**Goal :** Les agents sont visibles par tags, le sandbox routing fonctionne, l'admin panel et l'onboarding sont refaits.

| Story | Titre | SP | Epic |
|-------|-------|----|------|
| AGENT-01 | Agent creation avec tags obligatoires | 3 | AGENT |
| AGENT-02 | Partage d'agent par ajout de tag | 3 | AGENT |
| AGENT-03 | Sandbox routing — resolveRunActor | 3 | AGENT |
| AGENT-04 | Liste agents filtrée dans le dashboard | 3 | AGENT |
| UI-01 | Admin panel — Gestion des rôles | 5 | UI |
| UI-02 | Admin panel — Gestion des tags | 5 | UI |
| UI-03 | Admin panel — Gestion des membres | 5 | UI |

**Total : 27 SP** | Risque : moyen (beaucoup d'UI, mais patterns répétitifs)

**Ordre important :**
1. AGENT-01..04 d'abord (backend d'abord)
2. UI-01, UI-02, UI-03 en parallèle (pages indépendantes)

**Definition of Done Sprint 4 :**
- [ ] Création d'agent avec tags obligatoires
- [ ] Partage d'agent = ajout de tag
- [ ] executeRun() résout l'acteur pour le sandbox routing
- [ ] Dashboard agents filtré par tags
- [ ] Admin panel roles/tags/membres fonctionnel
- [ ] Contrôle hiérarchique sur l'assignation de rôles

---

## Sprint 5 — Onboarding + Task Pool + CAO

**Goal :** L'onboarding est refait, le task pool fonctionne, le CAO est opérationnel.

| Story | Titre | SP | Epic |
|-------|-------|----|------|
| UI-04 | Onboarding wizard repensé (5 steps) | 8 | UI |
| UI-05 | Issue assignment par tag (Task Pool) | 5 | UI |
| CAO-01 | Agent CAO system (auto-création) | 3 | CAO |
| CAO-02 | Hook auto-tagging (nouveau tag → CAO) | 2 | CAO |
| CAO-03 | CAO watchdog (mode silencieux) | 5 | CAO |
| CAO-04 | CAO interactif (@cao) | 5 | CAO |

**Total : 28 SP** | Risque : élevé sur CAO-03/04 (intégration LLM, edge cases)

**Ordre important :**
1. CAO-01 + CAO-02 d'abord (le CAO doit exister avant de faire quoi que ce soit)
2. UI-04 (onboarding) en parallèle de CAO-01/02
3. UI-05 (task pool) indépendant
4. CAO-03 puis CAO-04 (silencieux avant interactif)

**Definition of Done Sprint 5 :**
- [ ] Onboarding 5 steps fonctionnel (presets, tags, invites, premier agent)
- [ ] Issues assignables par tag, vue Pool, action "Prendre"
- [ ] CAO auto-créé à la création d'une company
- [ ] Nouveaux tags auto-assignés au CAO
- [ ] CAO détecte les anomalies et commente les issues
- [ ] @cao dans un commentaire → le CAO répond

---

## Graphe de Dépendances

```
Semaine 1          Semaine 2          Semaine 3          Semaine 4          Semaine 5
─────────          ─────────          ─────────          ─────────          ─────────
SCHEMA-01─┐        PERM-05──┐         API-02───┐         AGENT-01─┐        UI-04
SCHEMA-02─┤        PERM-01──┤         API-03───┤         AGENT-02─┤        UI-05
SCHEMA-03─┼──▶     PERM-02──┼──▶      ISO-01───┼──▶      AGENT-03─┼──▶     CAO-01──▶CAO-03
SCHEMA-04─┤        PERM-03──┤         ISO-02───┤         AGENT-04─┤        CAO-02──▶CAO-04
SCHEMA-05─┤        PERM-04──┤         ISO-03───┤         UI-01────┤
TENANT-01─┤        API-01───┤         ISO-04───┘         UI-02────┤
TENANT-02─┤        API-04───┘                            UI-03────┘
TENANT-03─┘
```

---

## Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| **Tag isolation incomplète** | Fuite de données intra-tenant | TagScope enforced par types + tests E2E (ISO-04) |
| **hasPermission() régression** | Blocage total de l'app | Tests unitaires exhaustifs sur PERM-01 |
| **CAO LLM instable** | Réponses incorrectes/lentes | Haiku pour silencieux (rapide), Sonnet pour interactif, fallback graceful |
| **Onboarding trop complexe** | Users perdus au setup | 3 presets simples, wizard step-by-step |
| **Nuke legacy casse tout** | L'app ne compile plus pendant le sprint 1 | SCHEMA-05 en dernier dans sprint 1, typecheck fréquent |

---

## Notes

- **Pas en prod** : on peut casser et rebuilder sans crainte. Pas de feature flags ni rollback.
- **Sprint = 1 semaine** : cadence rapide vu le pair programming Claude. Si un sprint déborde, on décale — pas de pression deadline.
- **Ordre strict** : les sprints doivent être faits dans l'ordre (chaque sprint débloque le suivant). Seul TENANT (sprint 1) est parallélisable avec SCHEMA.
- **Definition of Done globale** : `bun run typecheck` + `bun run build` + tests E2E existants ne cassent pas.
