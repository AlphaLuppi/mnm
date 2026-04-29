# Stories — Status Index

75 user stories BMAD triées par statut. Cet index est le source-of-truth pour savoir ce qui a été livré, ce qui reste à faire, et ce qui a été abandonné.

- **Shipped** : 54 stories. Code en prod (tables BD + routes + UI vérifiables).
- **Pending** : 14 stories. À exécuter. Dépendances majoritairement shipped.
- **Abandoned** : 7 stories. Direction Docker sandbox déprioritisée 2026-03-21 (clients locaux privilégiés).

Indice de validation : où vérifier que la story est bien livrée (table, route API, page UI).

## Shipped (54)

[`_shipped/`](_shipped/)

| ID | Titre court | Domaine | Validation |
|----|-------------|---------|------------|
| A2A-S01 | Agent-to-Agent Bus | A2A | bus events table, routes A2A |
| CHAT-S01 | Collaborative Chat — model | Chat | chats/messages tables |
| CHAT-S02 | Chat — service | Chat | chat service module |
| CHAT-S03 | Chat — API routes | Chat | routes /chats |
| CHAT-S04 | Chat — UI | Chat | page Chat (superseded by Superpowers plan 2026-04-03 mais shipped) |
| COMP-S02 | Compaction Recovery | Compaction | recovery service |
| COMP-S03 | Compaction Réinjection | Compaction | reinjection logic |
| CONF-S01 | Config Layers — model | Config | config_layers tables |
| CONF-S02 | Config Layers — service | Config | layer service |
| CONF-S03 | Config Layers — merge | Config | priority merge logic |
| CONF-S04 | Config Layers — API | Config | routes /config-layers |
| CONF-S05 | Config Layers — UI | Config | page config layers |
| DASH-S01 | Dashboards aggregées | Dashboard | dashboards table |
| DASH-S02 | Dashboard UI | Dashboard | page Dashboard |
| DASH-S03 | Dashboard WebSocket | Dashboard | live updates SSE |
| DRIFT-S01 | Drift detection — model | Drift | drift tables |
| DRIFT-S02 | Drift detection — service | Drift | drift service |
| DRIFT-S03 | Drift detection — UI | Drift | drift indicators UI |
| MU-S01 | Multi-User invitations email | MU | invitations table + email |
| MU-S02 | Page membres | MU | page Members |
| MU-S04 | Company selector | MU | selector header |
| MU-S06 | Sign-out | MU | route sign-out |
| OBS-S01 | audit_events table | Observability | audit_events |
| OBS-S02 | Audit service | Observability | audit service |
| OBS-S03 | LLM summary | Observability | LLM enrichment |
| OBS-S04 | Audit UI | Observability | page Audit |
| ONB-S01 | Onboarding CEO wizard B2B | Onboarding | wizard pages |
| ORCH-S01 | XState workflow engine | Orch | XState integration |
| ORCH-S02 | WorkflowEnforcer | Orch | enforcer module |
| ORCH-S03 | HITL flow | Orch | HITL gates |
| ORCH-S04 | API routes orchestration | Orch | routes /orchestration |
| PROJ-S01 | Projects memberships | Projects | project_memberships |
| PROJ-S02 | Projects service | Projects | project service |
| PROJ-S03 | Projects scope filtering | Projects | scope middleware |
| PROJ-S04 | Projects UI | Projects | pages Projects |
| RBAC-S01 | RBAC roles table | RBAC | roles |
| RBAC-S02 | RBAC permissions | RBAC | permissions |
| RBAC-S03 | RBAC role_permissions | RBAC | role_permissions |
| RBAC-S04 | RBAC service | RBAC | rbac service |
| RBAC-S05 | RBAC middleware | RBAC | route guards |
| RBAC-S06 | RBAC API | RBAC | routes /rbac |
| RBAC-S07 | RBAC UI | RBAC | page RBAC |
| SSO-S01 | SSO table + service | SSO | sso table |
| SSO-S02 | SSO BetterAuth SAML/OIDC | SSO | BetterAuth providers |
| SSO-S03 | SSO UI | SSO | page SSO |
| TECH-01 | Postgres externe | Tech | docker compose pg |
| TECH-02 | Docker compose | Tech | docker-compose.yml |
| TECH-03 | Test infra | Tech | playwright + setup |
| TECH-04 | Redis | Tech | redis service |
| TECH-05 | RLS | Tech | RLS policies |
| TECH-06 | Schema 10 tables | Tech | migrations |
| TECH-07 | Mods 5 tables | Tech | migrations |
| TECH-08 | CI/CD | Tech | .github/workflows |
| VP-S01 | View Presets data + API + hook | VP | view_presets table |

## Pending (14)

[`_pending/`](_pending/) — À exécuter. Dépendances majoritairement déjà shipped.

| ID | Titre court | Domaine | Dépendances |
|----|-------------|---------|-------------|
| A2A-S02 | Permissions granulaires A2A | A2A | A2A-S01 shipped |
| A2A-S03 | Audit A2A | A2A | A2A-S01, OBS-S01-04 shipped |
| A2A-S04 | Connecteurs MCP | A2A | A2A-S01 shipped |
| COMP-S01 | CompactionWatcher détection | Compaction | COMP-S02-03 shipped |
| DUAL-S01 | Table automation_cursors + service | Dual-mode | TECH-06 shipped |
| DUAL-S02 | UI curseur 3 positions | Dual-mode | DUAL-S01 |
| DUAL-S03 | Enforcement curseur dans workflow | Dual-mode | DUAL-S01, ORCH-S01-04 shipped |
| MU-S03 | Invitation bulk CSV | MU | MU-S01 shipped |
| MU-S05 | Désactivation signup libre | MU | MU-S01-02 shipped |
| ONB-S02 | Cascade hiérarchique | Onboarding | ONB-S01 shipped |
| ONB-S03 | Import Jira intelligent | Onboarding | ONB-S01 shipped |
| ONB-S04 | Dual-mode config onboarding | Onboarding | ONB-S01, DUAL-S01-03 |
| ORCH-S05 | UI éditeur workflow | Orch | ORCH-S01-04 shipped (UI déjà partiellement couverte par Workflow Studio U13) |
| RT-S01 | Remove polling, WebSocket hardening | Realtime | DASH-S03 shipped |

## Abandoned (7)

[`_abandoned/`](_abandoned/) — Direction Docker sandbox déprioritisée 2026-03-21. Clients locaux (MCP, Desktop, CLI) privilégiés.

| ID | Titre court | Raison |
|----|-------------|--------|
| CONT-S01 | ContainerManager Docker | Sandbox déprioritisé |
| CONT-S02 | Credential Proxy HTTP | Sandbox déprioritisé |
| CONT-S03 | Mount Allowlist Tamper-proof | Sandbox déprioritisé |
| CONT-S04 | Isolation Réseau Docker | Sandbox déprioritisé |
| CONT-S05 | Tables Container Schema | Sandbox déprioritisé |
| CONT-S06 | UI Container Status | Sandbox déprioritisé |
| SANDBOX-AUTH-AUTOBOOTSTRAP | Auto-bootstrap first admin sandbox auth | Sandbox déprioritisé |

## Migration vers Superpowers ?

Plusieurs groupes pending pourraient être consolidés en plans Superpowers cohérents :

- **DUAL-S01-03** → un seul plan `docs/superpowers/plans/YYYY-MM-DD-dual-mode-cursor.md` (table + UI + enforcement). Cohérent fonctionnellement.
- **A2A-S02-04** → plan `governance` ou `permissions` (granulaire + audit + MCP) sur le bus A2A existant.
- **MU-S03/S05** → petites tâches, pourraient rester atomiques ou être groupées dans un plan `multi-user-hardening`.
- **ONB-S02-04** → plan `onboarding-v2` (cascade + Jira + dual-mode). Forte interdépendance.

Décision à Tom. RT-S01 et ORCH-S05 sont indépendants et peuvent être traités à part.
