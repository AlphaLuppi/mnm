# PRD Section 6 — Faisabilité Technique Détaillée, Estimations & Dette Technique

*Par Amelia la Dev 💻* | Task #6 | 2026-03-13

---

## 1. Faisabilité par FR (14 blocs fonctionnels)

### FR1 — RBAC Métier (M, 3-5j)
- **Existe** : principal_permission_grants avec scope JSONB (non lu), 6 permission keys, hasPermission()
- **Trou critique** : hasPermission() (access.ts:45-66) ignore completement scope
- **À modifier** : constants.ts (+9 keys), access.ts (scope + presets), 22 fichiers routes
- **À créer** : role-presets.ts, CompanyMembers.tsx, RoleSelector.tsx, PermissionEditor.tsx

### FR2 — Scoping par Projet (M-L, 5-8j) | Dépend: FR1
- **Existe** : agents.scopedToWorkspaceId, filtrage workspace dans agents.ts
- **À créer** : table project_memberships, service, page ProjectAccess.tsx

### FR3 — Workflows Enforced (L, 8-10j) | Dépend: FR1
- **Existe** : workflow_templates, instances, stage_instances, service complet (267 lignes)
- **Manque** : State machine d'enforcement, validation transitions, fichiers obligatoires
- **À créer** : workflow-enforcer.ts, workflow-state-machine.ts

### FR4 — Drift Detection (M+L, 3j+2sem) | Dépend: FR3
- **Existe** : drift.ts (405 lignes), drift-analyzer.ts, routes + UI
- **Trou** : reportCache = new Map() — drift en mémoire uniquement, perdu au restart
- **À créer** : tables drift_reports + drift_items, drift-monitor.ts

### FR5 — Observabilité & Audit (M+M, 4j+4j)
- **Existe** : activity_log basique (46 lignes), heartbeat_run_events, cost_events
- **Manque** : queries/filtrage/export sur activity_log, résumé LLM
- **À créer** : audit-summarizer.ts, AuditLog.tsx

### FR6 — Chat Temps Réel (L, 8-10j) | Dépend: FR8
- **Existe** : live-events.ts (WebSocket unidirectionnel)
- **À créer** : agent-chat.ts, agent_chat_messages table, AgentChatPanel.tsx, useAgentChat.ts

### FR7 — Gestion Compaction (XL, 3+ sem) | Dépend: FR3, FR8
- **Rien n'existe** pour la gestion de compaction
- **À créer** : compaction-manager.ts, context-manager.ts, table compaction_snapshots

### FR8 — Containerisation (XL, 3-5 sem) | Parallélisable
- **Existe** : adapter pattern (8 types), secrets.ts (4 providers)
- **À créer** : dossier server/src/adapters/docker/ complet, credential-proxy.ts

### FR9 — SSO SAML/OIDC (S-M, 2-4j) | Dépend: FR1
### FR10 — Import Jira/Linear (L-XL, 2-3 sem) | Dépend: FR1, FR2
### FR11 — Onboarding Cascade (L, 1-2 sem) | Dépend: FR1, FR9
### FR12 — Agent-to-Agent (L, 1-2 sem) | Dépend: FR1, FR8
### FR13 — Curseur Automatisation (M, 4-5j) | Dépend: FR1, FR3
### FR14 — Dashboards par Rôle (M, 3-5j) | Dépend: FR1, FR5

## 2. Graphe de Dépendances

```
FR1 (RBAC) → FR2 → FR10
     └→ FR3 → FR4 → FR7
FR8 (Container) → FR6, FR7, FR12
```

**Piste A (Product Engineer)** : FR1 → FR2 → FR11 → FR10 → FR14
**Piste B (Ingénieur Système)** : FR8 → FR3 → FR7 → FR4

## 3. Effort Total : ~16-24 semaines (2 devs = 8-12 semaines)

## 4. Dette Technique (7 items, ~12-19j de résolution)

| # | Dette | Sévérité | Effort |
|---|-------|----------|--------|
| DT1 | hasPermission() ignore scope | **Critique** | 1-2j |
| DT2 | Drift en mémoire (Map) | Élevée | 2-3j |
| DT3 | WebSocket unidirectionnel | Moyenne | 2-3j |
| DT4 | 6 permission keys seulement | Moyenne | 0.5j |
| DT5 | Activity log sans query | Faible | 1-2j |
| DT6 | Pas de tests automatisés | Moyenne | 3-5j |
| DT7 | heartbeat.ts monolithique (2396 lignes) | Faible | 2-3j |

*~5000+ mots — Faisabilité détaillée par FR, estimations S/M/L/XL, dépendances, dette technique.*
