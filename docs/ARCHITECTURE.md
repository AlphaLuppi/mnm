# Architecture de MnM

Ce document decrit la stack technique et les decisions architecturales cles de MnM. Pour la vision produit et les features, voir le [README](../README.md). Pour le get started dev, voir [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Stack technique

```
React 18 + TypeScript (shadcn/ui + Tailwind)
  ↓
Express.js API (routes, auth middleware, rate limiting)
  ↓
71 Services backend (RBAC, orchestrateur, containers, audit, chat, drift, A2A, config layers)
  ↓
PostgreSQL 17 (51 tables, RLS sur 41) + Redis 7 (cache, pub/sub) + WebSocket (live events, chat)
  ↓
Agent Runtime (adapters, Docker containers, credential proxy, heartbeat)
```

**Monorepo Bun workspaces** avec 13 packages typechecked.

---

## Decisions architecturales cles

| Decision | Justification |
|---|---|
| **Zero polling** | Tous les updates temps reel via SSE/WebSocket. Jamais de `setInterval` ou `refetchInterval`. |
| **Single-tenant** | 1 instance = 1 entreprise. `company_id` auto-injecte, jamais expose en UI. |
| **RBAC dynamique** | Roles et permissions en DB, jamais de constantes hardcodees. |
| **Tags > Teams** | Les tags sont additifs et flexibles. Score 8/8 sur le test CBA vs 5/8 pour Roles+Teams. |
| **Config Layers > JSONB** | Config structuree, mergeable, versionee, avec detection de conflits. |
| **Trace Gold par defaut** | L'utilisateur voit la synthese intelligente, pas le bruit brut. |
| **Container par user** | Isolation securisee, credentials injectees par run, pas persistees sur disque. |

---

## Sandbox Auth

- **Token injection via env var** — `claude setup-token` → stocke dans `user_pods.claude_oauth_token` (migration 0051)
- **Per-run injection** — Heartbeat passe `CLAUDE_CODE_OAUTH_TOKEN` via `docker exec`. Pas de credentials sur le filesystem sandbox.
- `copyClaudeCredentials` est supprime. Le setup-token stocke en DB est la seule approche.

---

## Pipeline de Traces

- **Gold** = vue par DEFAUT (phases scorees, annotations, verdicts)
- **Silver** = detail groupe
- **Bronze** = JSON brut (debug)
- Gold est AUTO-GENERE a la completion du trace, pas un clic manuel.
- Le prompt Gold est HIERARCHIQUE : global → workflow → agent → issue context.
- Les traces sont un MIDDLEWARE au-dessus des adapters (`heartbeat.ts:onLog`), PAS dans les adapters.
- Enrichissement LLM : `claude -p --model haiku`.

---

## Config Layers

- `adapterConfig` JSONB remplace par des couches de config structurees. Toute la config agent vit dans les layers.
- **Priority merge** : Company enforced (999) > Base layer (500) > Additional (0-498).
- Base layer auto-creee par agent (migration 0054). Dual-path heartbeat pour migration zero-downtime.
- Advisory locks (`pg_advisory_xact_lock`) serialisent les attachements concurrents.
- **Tag-based visibility** : private (createur uniquement), team (tags partages), public (tous), company (tous).
- Types d'items : MCP Servers, Skills, Hooks, Settings, Credentials — chacun avec editeur dedie.
- OAuth2 PKCE pour credentials MCP (chiffrement AES-256-GCM).

---

## CAO (Chief Agent Officer)

- `adapter_type="claude_local"`, `metadata.isCAO=true`, auto-cree, a tous les tags, role Admin.
- Tourne dans le sandbox de l'admin.
- En mode watchdog, auto-commente les echecs.
- Interactif via les mentions `@cao`.

---

## Sandbox architecture

- Container Docker persistant par utilisateur.
- 5 couches de securite : ephemere, read-only, mount allowlist, credential proxy, reseaux isoles.
- `docker exec` avec rewrite automatique localhost → host.docker.internal.
- `runChildProcess` supporte l'option `dockerContainerId`. Les env vars avec URLs localhost sont reecrites vers `host.docker.internal`.

---

## MCP Server

MnM expose un serveur MCP (Model Context Protocol) complet :

- **68 tools** + **10 resources** sur 14 domaines (agents, issues, projects, chat, folders, artifacts, config-layers, workflows, traces, sandbox, users, admin, a2a, documents)
- **Transport** : Streamable HTTP (recommande) + SSE legacy
- **Auth** : OAuth 2.1 avec PKCE, Dynamic Client Registration, ecran de consentement React granulaire par domaine (read/write/admin)
- **Filtrage dynamique** : les tools sont filtres par les permissions reelles de l'utilisateur/agent dans le token
- **Rate limiting** + semaphore DB (15 concurrent) + event loop monitoring
- **OAuth store** en PostgreSQL (migration 0063) — survit aux restarts

Voir [CONTRIBUTING.md](../CONTRIBUTING.md#mcp-server-pour-les-devs) pour le get started client.

---

## Agent permissions

- Les agents heritent des permissions de leur createur (`createdByUserId`).
- Routes travaillent avec ou sans prefixe `/companies/:companyId/`. Le middleware reecrit automatiquement.
- Agent JWT hardenees : TTL court, jti, fail-fast, `aud` claim validation.

---

## API simplifiee

- Les routes travaillent avec ou sans le prefixe `/companies/:companyId/` — un middleware reecrit automatiquement. Le code agent/client n'a jamais a connaitre le `company_id`.

---

## `_bmad/`

Framework BMAD (templates de workflows agents). **NE PAS MODIFIER** — c'est un framework externe.
