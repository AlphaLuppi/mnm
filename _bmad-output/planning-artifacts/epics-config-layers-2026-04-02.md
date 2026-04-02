# Epic CONF — Config Layers (Couches de Configuration MCP/Skills/Hooks)

> **Version** : 1.0 | **Date** : 2026-04-02 | **Statut** : DONE
> **Auteur** : Tom (Solo)
> **Sources** : Brainstorming Config Layers, Architecture MnM v2, Pivot mars 2026

---

## Table des Matieres

1. [Vue d'ensemble](#1-vue-densemble)
2. [Epic CONF — Config Layers](#2-epic-conf--config-layers)
3. [Stories](#3-stories)
4. [Architecture Decisions](#4-architecture-decisions)
5. [Graphe de Dependances](#5-graphe-de-dependances)
6. [Recapitulatif Quantitatif](#6-recapitulatif-quantitatif)

---

## 1. Vue d'ensemble

### 1.1 Probleme

Le champ `adapterConfig` JSONB sur les agents est une boite noire : pas de structure, pas de versioning, pas de partage entre agents, pas de validation. Chaque agent duplique sa config MCP, ses skills, ses hooks. L'admin n'a aucune visibilite sur ce qui tourne.

### 1.2 Vision

**Config Layers** = un systeme de couches de configuration structurees et partageables, avec priorite, merge automatique, et historique des versions.

Un agent herite de plusieurs layers (compagnie, equipe, personnelles) qui se fusionnent automatiquement au moment du run. La couche company (priorite 999) est toujours appliquee et ne peut pas etre contournee. C'est la garantie de conformite enterprise.

**Differenciateur cle** : on peut attacher/detacher des layers d'un agent sans redeploy, avec preview du merge avant application, et detection de conflits avant qu'ils ne causent des erreurs en production.

### 1.3 Structure

| Epic | Stories | Effort estime |
|------|---------|---------------|
| **CONF** — Config Layers | 5 | ~47 SP |

### 1.4 Principes Directeurs

1. **Tout-en-layers** — `adapterConfig` JSONB reste en fallback legacy, les agents avec `base_layer_id` utilisent le systeme couches
2. **Priority merge** — SQL CTE avec `DISTINCT ON` par (item_type, item_key), ordre decroissant par priorite
3. **Company-enforced** — la layer company (priorite 999) est auto-creee, non deletable, appliquee a tous les agents
4. **Scope visibility** — private (createur seulement), team (tags partages), public (tous), company (toute la compagnie)
5. **Versioning** — chaque modification d'une layer cree une revision dans `config_layer_revisions`
6. **Promotion** — une layer de scope private peut etre promue en team ou public par un admin

---

## 2. Epic CONF — Config Layers

**Objectif** : Remplacer le JSONB `adapterConfig` par un systeme de couches de configuration structurees (MCP Servers, Skills, Hooks, Settings) avec RBAC, tag isolation, conflict detection, et version history.

**Phase** : Post-pivot mars 2026 (apres 69 stories B2B)
**Effort total** : 5 stories | ~47 SP | ~3 semaines
**Assignation** : Tom (solo)

---

## 3. Stories

### CONF-S01 — Schema DB + Migrations

**Description** : 8 nouvelles tables avec RLS + 3 migrations Drizzle. Fondation du systeme config layers.
**Effort** : L (8 SP, 4-5j)
**Statut** : DONE
**Bloque par** : Aucun (base DB)
**Debloque** : CONF-S02, CONF-S03, CONF-S04, CONF-S05

**Acceptance Criteria** :
- Given la migration 0052 When elle s'execute Then 8 tables creees : `config_layers`, `config_layer_items`, `config_layer_files`, `config_layer_revisions`, `agent_config_layers`, `workflow_template_stage_layers`, `workflow_stage_config_layers`, `user_mcp_credentials`
- Given la migration 0053 When elle s'execute Then colonne `base_layer_id` FK ajoutee sur `agents`
- Given la migration 0054 When elle s'execute Then donnees `adapterConfig` migrees vers base layers pour chaque agent
- Given une config_layer When elle est creee Then RLS garantit l'isolation par companyId
- Given un agent avec base_layer_id Then la requete de merge retrouve ses layers par priorite

---

### CONF-S02 — Backend CRUD + Conflict Detection

**Description** : Service `config-layer.ts` (CRUD layers/items/files/revisions/promotion), service `config-layer-conflict.ts` (detection de conflits + advisory locks + merge preview), 22+ routes, seed 8 permissions.
**Effort** : XL (13 SP, 7-9j)
**Statut** : DONE
**Bloque par** : CONF-S01
**Debloque** : CONF-S03, CONF-S04, CONF-S05

**Acceptance Criteria** :
- Given un Manager When il cree une config layer Then elle est persistee avec scope, priorite, et revision initiale
- Given deux layers When leurs items ont la meme cle et type Then le service de conflit les detecte et retourne le detail
- Given une promotion When un admin la demande Then le scope de la layer est mis a jour et une revision est creee
- Given un attach concurrent When deux requetes veulent attacher la meme layer Then l'advisory lock PostgreSQL empeche la corruption
- Given une permission `config_layers:read` absente When un user fait GET /config-layers Then 403 retourne
- Given les 8 permissions When le serveur demarre Then elles sont seedees en DB si absentes

---

### CONF-S03 — Runtime Merge + Integration Heartbeat

**Description** : Service `config-layer-runtime.ts` (merge engine SQL CTE, cache TTL 1 min, generation fichiers .mcp.json / settings.json / skills/), integration heartbeat dual-path (base_layer_id vs legacy adapterConfig).
**Effort** : L (8 SP, 4-5j)
**Statut** : DONE
**Bloque par** : CONF-S01, CONF-S02
**Debloque** : rien (terminal)

**Acceptance Criteria** :
- Given un agent avec base_layer_id When heartbeat demarre un run Then resolveConfigForRun() est appele et retourne la config mergee
- Given un agent sans base_layer_id When heartbeat demarre un run Then le chemin legacy adapterConfig est utilise (aucune regression)
- Given la meme config layer deux fois dans la meme minute When resolveConfigForRun() est appele Then le cache retourne le resultat sans hit DB
- Given deux layers avec la meme cle MCP When merge s'execute Then la layer de plus haute priorite gagne (DISTINCT ON priorite DESC)
- Given des items de type mcp_server When la config est generee Then un fichier .mcp.json valide est produit

---

### CONF-S04 — OAuth + MCP Credentials

**Description** : Service `mcp-credential.ts` (stockage AES-256-GCM, refresh, revocation), service `mcp-oauth.ts` (flow OAuth2 PKCE, authorize, callback avec popup postMessage), routes OAuth.
**Effort** : M (5 SP, 2-3j)
**Statut** : DONE
**Bloque par** : CONF-S01 (table user_mcp_credentials)
**Debloque** : CONF-S05 (bouton OAuth UI)

**Acceptance Criteria** :
- Given un user qui autorise un MCP server OAuth When le callback reçoit le code Then le token est chiffre en AES-256-GCM et stocke dans `user_mcp_credentials`
- Given un token expire When refreshCredential() est appele Then le token est rafraichi via le refresh_token et re-chiffre
- Given une revocation When revokeCredential() est appele Then le token est supprime de la DB et invalide cote provider
- Given le flow PKCE When authorize() est appele Then un code_verifier est genere, stocke en session, et le popup ouvre l'URL provider
- Given le popup OAuth When il se ferme Then postMessage est envoye a la fenetre parente avec le statut

---

### CONF-S05 — Frontend

**Description** : Page admin ConfigLayersPage, LayerEditor (onglets MCP/Skills/Hooks/Settings), editeurs par type (McpItemEditor, HookItemEditor, SkillItemEditor, SettingItemEditor), onglet AgentLayersTab dans le detail agent, MergePreviewPanel, ConflictResolutionDialog, McpOAuthConnectButton.
**Effort** : XL (13 SP, 7-9j)
**Statut** : DONE
**Bloque par** : CONF-S02, CONF-S03, CONF-S04
**Debloque** : rien (terminal)

**Acceptance Criteria** :
- Given un Admin When il ouvre /config-layers Then il voit la liste enrichie des layers avec createur, badges items (MCP/Skills/Hooks/Settings), et nombre d'agents utilisant chaque layer
- Given le LayerEditor When il s'ouvre Then 4 onglets apparaissent : MCP Servers, Skills, Hooks, Settings avec compteur d'items
- Given un agent detail When il a des layers attachees Then l'onglet Layers montre les layers par priorite avec bouton detach
- Given un attach de layer When l'utilisateur clique Attach Then la mise a jour UI est instantanee (optimistic update) sans attendre la reponse serveur
- Given un conflit When deux layers partagent une meme cle Then ConflictResolutionDialog propose les deux valeurs et laisse choisir
- Given un MCP server OAuth When McpOAuthConnectButton est clique Then un popup s'ouvre et revient avec le statut de connexion

---

## 4. Architecture Decisions

### ADR-CONF-01 : Tout-en-layers (dual-path)

**Decision** : Conserver `adapterConfig` JSONB en fallback legacy. Les agents avec `base_layer_id` utilisent le systeme couches, les autres continuent sur l'ancien chemin.

**Raison** : Migration zero-downtime. Pas de casse des agents existants. La migration 0054 migre progressivement les donnees.

### ADR-CONF-02 : Priority merge via SQL CTE + DISTINCT ON

**Decision** : Merge calcule en SQL avec `DISTINCT ON (item_type, item_key) ORDER BY priority DESC`. Pas d'implementation applicative du merge.

**Raison** : Atomicite, performance (un seul aller-retour DB), lisibilite des regles de merge.

### ADR-CONF-03 : Cache TTL 1 minute pour resolveConfigForRun()

**Decision** : Cache in-memory Map<agentId, {config, expiresAt}> avec TTL 1 minute.

**Raison** : Les runs d'agents sont frequents. Evite N hits DB par run. 1 minute = bon compromis fraicheur/perf.

### ADR-CONF-04 : Advisory locks PostgreSQL pour attach concurrent

**Decision** : `SELECT pg_try_advisory_lock(hash)` avant chaque operation d'attach/detach de layer.

**Raison** : Evite la corruption silencieuse en cas de requetes concurrentes sur le meme agent. PostgreSQL natif, pas de coordination applicative.

### ADR-CONF-05 : AES-256-GCM pour credentials MCP OAuth

**Decision** : Chiffrement `AES-256-GCM` avec IV aleatoire par credential. Cle derivee de `MNM_ENCRYPTION_KEY` env var.

**Raison** : GCM assure integrite + confidentialite. IV aleatoire evite la reutilisation de nonce.

### ADR-CONF-06 : Scope visibility (private / team / public / company)

**Decision** : 4 scopes controles par tag isolation existante. `private` = createur seulement. `team` = tags partages. `public` = tous les users. `company` = toute la company (layers enforced).

**Raison** : Reutilise l'infrastructure TagScope existante. Pas de nouveau systeme de permissions a inventer.

---

## 5. Graphe de Dependances

```
CONF-S01 (DB Schema)
    |
    +---> CONF-S02 (Backend CRUD)
    |         |
    |         +---> CONF-S03 (Runtime + Heartbeat)
    |         |
    |         +---> CONF-S04 (OAuth + Credentials)
    |         |         |
    |         |         +---> CONF-S05 (Frontend)
    |         |
    |         +---> CONF-S05 (Frontend)
    |
    +---> CONF-S04 (user_mcp_credentials table)
```

**Chemin critique** : CONF-S01 → CONF-S02 → CONF-S05 (34 SP, ~2 semaines)

---

## 6. Recapitulatif Quantitatif

| Story | Titre | Effort | SP | Statut |
|-------|-------|--------|-----|--------|
| CONF-S01 | DB Schema + Migrations | L | 8 | DONE |
| CONF-S02 | Backend CRUD + Conflict Detection | XL | 13 | DONE |
| CONF-S03 | Runtime Merge + Heartbeat | L | 8 | DONE |
| CONF-S04 | OAuth + MCP Credentials | M | 5 | DONE |
| CONF-S05 | Frontend | XL | 13 | DONE |
| **TOTAL** | | | **47 SP** | **5/5 DONE** |

**Couverture fonctionnelle** :
- MCP Servers : creation, edition, OAuth connect, merge, generation .mcp.json
- Skills : CRUD, partage par scope, merge par priorite
- Hooks : CRUD, pre/post run, partage
- Settings : cle/valeur typee, override par layer
- RBAC : 8 permissions (config_layers:create/edit/delete/read/manage/promote/attach, mcp:connect)
- Versioning : revision automatique a chaque modification
- Conflits : detection, preview merge, resolution UI
- Heartbeat : dual-path zero regression
