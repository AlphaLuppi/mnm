# CONF-S03 — Runtime Merge + Integration Heartbeat

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CONF-S03 |
| **Titre** | Runtime Merge + Integration Heartbeat — merge engine, cache TTL, dual-path |
| **Epic** | Epic CONF — Config Layers |
| **Effort** | L (8 SP, 4-5j) |
| **Priorite** | P0 — Fait fonctionner les agents avec les config layers en production |
| **Assignation** | Tom |
| **Bloque par** | CONF-S01 (schema DB), CONF-S02 (service config-layer, advisory locks) |
| **Debloque** | Rien (story terminale cote execution) |
| **Statut** | DONE |
| **Type** | Backend (service runtime + integration heartbeat) |

---

## Contexte

Les stories CONF-S01 et CONF-S02 posent la fondation DB et l'API CRUD. Cette story ferme la boucle cote execution : au moment ou un agent demarre un run, il faut resoudre sa configuration finale.

Deux cas a gerer :
1. **Agent avec `base_layer_id`** (nouveau systeme) : appel a `resolveConfigForRun()` qui merge toutes les layers par priorite, genere les fichiers de config (.mcp.json, settings.json, skills/), et les injecte dans le container de l'agent
2. **Agent sans `base_layer_id`** (legacy) : chemin existant via `adapterConfig` — aucune modification, zero regression

Le cache TTL 1 minute evite des hits DB a chaque heartbeat (les runs peuvent emettre des logs toutes les secondes). La generation de fichiers produit les formats attendus par Claude Code / les adapters.

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| CONF-S01 | DONE | Tables config_layers, config_layer_items, agent_config_layers — schema et migrations |
| CONF-S02 | DONE | Service config-layer.ts, advisory locks, liste des layers par agent |
| CONT-S01 | DONE | runChildProcess() avec dockerContainerId — injection env vars dans containers |
| CONT-S02 | DONE | Heartbeat pattern, onLog callback, structure du run |

---

## Acceptance Criteria (Given/When/Then)

### AC1 — Dual-path : agents avec base_layer_id

**Given** un agent avec `base_layer_id` non-null
**When** le heartbeat demarre un run via `startRun()`
**Then** `resolveConfigForRun(agentId)` est appele pour obtenir la config mergee

**And** la config mergee est passee au container via les fichiers generes (.mcp.json, settings.json)

### AC2 — Dual-path : agents sans base_layer_id (legacy)

**Given** un agent avec `base_layer_id = NULL`
**When** le heartbeat demarre un run
**Then** le chemin legacy `adapterConfig` est utilise sans modification

**And** aucune erreur n'est levee, le comportement est identique a avant la feature Config Layers

### AC3 — Merge par priorite (SQL CTE + DISTINCT ON)

**Given** un agent avec 3 layers attachees (priorites 999, 500, 200) contenant des items de meme type/cle
**When** `resolveConfigForRun()` est appele
**Then** la valeur de la layer a priorite 999 ecrase les autres pour la meme cle

**And** les items uniques (sans conflit) de toutes les layers sont tous inclus dans la config finale

### AC4 — Cache TTL 1 minute

**Given** `resolveConfigForRun()` appele pour la premiere fois pour un agentId
**When** il est appele a nouveau dans la minute suivante
**Then** le resultat provient du cache in-memory (zero requete DB supplementaire)

**Given** la config d'un agent est modifiee (nouvelle layer attachee)
**When** `resolveConfigForRun()` est appele apres expiration du cache (>1 min)
**Then** le cache est rafraichi avec les nouvelles donnees DB

**Given** une invalidation explicite du cache via `invalidateMergeCache(agentId)`
**When** `resolveConfigForRun()` est appele immediatement apres
**Then** une nouvelle requete DB est effectuee

### AC5 — Generation fichier .mcp.json

**Given** un agent avec des items `itemType = 'mcp_server'` dans ses layers
**When** `resolveConfigForRun()` est appele
**Then** un objet `.mcp.json` valide est genere avec la structure `{mcpServers: {[name]: {command, args, env}}}`

### AC6 — Generation settings.json

**Given** un agent avec des items `itemType = 'setting'`
**When** `resolveConfigForRun()` est appele
**Then** un objet `settings.json` est genere avec les cles/valeurs des settings actives

### AC7 — Generation des fichiers skills/

**Given** un agent avec des items `itemType = 'skill'`
**When** `resolveConfigForRun()` est appele
**Then** les fichiers de skill sont generes dans le repertoire `skills/` avec le contenu de `itemValue`

### AC8 — Layer company toujours appliquee

**Given** une layer de scope "company" avec `isEnforced = true` (priorite 999)
**When** le merge est calcule pour n'importe quel agent de la company
**Then** la layer company est toujours incluse dans le merge, meme si elle n'est pas explicitement attachee a l'agent

### AC9 — Items desactives exclus du merge

**Given** un item avec `isEnabled = false` dans une layer
**When** le merge est calcule
**Then** cet item est exclu du resultat final, comme s'il n'existait pas

---

## Deliverables

### D1 — Service `server/src/services/config-layer-runtime.ts`

Fonctions :
- `resolveConfigForRun(companyId, agentId)` — point d'entree unique, retourne `ResolvedConfig`
- `getMergeQuery(companyId, agentId)` — SQL CTE avec `DISTINCT ON (item_type, item_key) ORDER BY priority DESC`
- `generateMcpJson(items)` — construit l'objet `.mcp.json` depuis les items mcp_server
- `generateSettingsJson(items)` — construit `settings.json` depuis les items setting
- `generateSkillFiles(items)` — retourne un map `{filename: content}` pour les skills
- `invalidateMergeCache(agentId)` — force l'expiration du cache pour un agent
- `getMergeCache()` — acces au cache (pour tests et debug)

Types retournes :
```typescript
interface ResolvedConfig {
  mcpJson: McpJsonConfig;
  settingsJson: Record<string, unknown>;
  skillFiles: Record<string, string>;
  rawItems: ConfigLayerItem[];
  resolvedAt: Date;
  fromCache: boolean;
}
```

### D2 — Integration dans `server/src/adapters/heartbeat.ts`

Modification de `startRun()` (ou equivalent) :
- Ajouter la detection `if (agent.base_layer_id)` avant la construction de la config
- Appeler `resolveConfigForRun(companyId, agentId)` si base_layer_id present
- Injecter les fichiers generes via le mecanisme existant (docker exec ou local)
- Conserver le chemin legacy intact dans le `else`

### D3 — SQL CTE de merge

```sql
-- Merge CTE : recupere les items merges par priorite
WITH ranked_items AS (
  SELECT
    cli.*,
    cl.priority,
    ROW_NUMBER() OVER (
      PARTITION BY cli.item_type, cli.item_key
      ORDER BY cl.priority DESC
    ) as rn
  FROM config_layer_items cli
  JOIN config_layers cl ON cli.layer_id = cl.id
  JOIN (
    -- Layers directement attachees a l'agent
    SELECT layer_id FROM agent_config_layers WHERE agent_id = $agentId
    UNION
    -- Layer company (enforced) de la company
    SELECT id FROM config_layers
    WHERE company_id = $companyId AND is_enforced = true
  ) active_layers ON cl.id = active_layers.layer_id
  WHERE cl.company_id = $companyId
    AND cli.is_enabled = true
)
SELECT * FROM ranked_items WHERE rn = 1;
```

---

## Notes techniques

- **Cache implementation** : `Map<string, {config: ResolvedConfig, expiresAt: number}>`. TTL = `Date.now() + 60_000`. Cleanup periodique via `setInterval` toutes les 5 minutes (comme le pattern rate-limiting existant dans a2a-bus.ts).
- **Injection des fichiers** : via le mecanisme `docker exec` de `runChildProcess()`. Les fichiers sont passes comme contenu de variable d'env ou ecrits dans un volume partage selon la config du container.
- **Layer company auto-incluse** : pas besoin d'un attachement explicite dans `agent_config_layers`. La CTE SQL fait une UNION avec les layers `isEnforced=true` de la company.
- **`fromCache` flag** : utile pour les logs de debug et les tests. Permet de savoir si la config vient du cache ou d'un hit DB frais.
- **Invalidation proactive** : `invalidateMergeCache(agentId)` est appele par `config-layer.ts` a chaque mutation qui impacte un agent (attach, detach, update item). Garantit que le prochain run voit la config a jour sans attendre 1 minute.
- **Format .mcp.json** : conforme a la spec Claude Code MCP — `{mcpServers: {[serverName]: {command: string, args: string[], env?: Record<string,string>}}}`.
