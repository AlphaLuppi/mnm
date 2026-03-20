# CONT-S02 : Credential Proxy HTTP -- Injection secrets sans exposition aux containers

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | CONT-S02 |
| **Titre** | Credential Proxy HTTP -- serveur proxy interne pour resoudre et injecter les secrets dans les containers sans les exposer |
| **Epic** | Epic CONT -- Containerisation |
| **Sprint** | Sprint 6 (Batch 10) |
| **Effort** | L (8 SP, 5-7j) |
| **Priorite** | P0 -- Prerequis securite B2B (aucun secret ne doit transiter dans l'environnement container) |
| **Assignation** | Cofondateur (backend + securite) |
| **Bloque par** | CONT-S01 (ContainerManager Docker -- DONE), CONT-S05 (Tables container enrichies -- DONE) |
| **Debloque** | A2A-S01 (A2A Bus), CONT-S03 (Mount Allowlist -- dependance logique, .env shadowing renforce par le proxy) |
| **ADR** | ADR-004 (Containerisation Docker + Credential Proxy -- couche 3 sur 5) |
| **Type** | Backend (service + routes + integration ContainerManager + audit) |
| **FRs couverts** | REQ-CONT-02 (Credential proxy HTTP -- injection sans exposition), REQ-CONT-04 (Shadow .env -- deja fait dans CONT-S01, renforce ici) |

---

## Description

### Contexte -- Pourquoi cette story est critique

La securite des credentials est le probleme #1 en containerisation d'agents IA B2B. Aujourd'hui, CONT-S01 lance des containers Docker ephemeres avec `--rm --read-only` et un shadow `.env` vers `/dev/null`. C'est la couche 1 de defense (ADR-004). Mais les agents ont besoin de API keys (OpenAI, Anthropic, GitHub, etc.) pour fonctionner.

**Le probleme** : si on passe les API keys en variables d'environnement Docker, elles sont :
1. Visibles dans `docker inspect`
2. Lisibles par tout processus dans le container via `/proc/1/environ`
3. Potentiellement logguees ou exfiltrees par un agent compromis
4. Capturees dans des crash dumps

**La solution** : le pattern Credential Proxy (inspire de Nanoclaw -- ADR-004, couche 3). Le container ne recoit JAMAIS la vraie cle. A la place :
- Le container recoit un placeholder et une `BASE_URL` pointant vers le proxy (`http://credential-proxy:8090`)
- Quand l'agent fait un appel API, la requete passe par le proxy
- Le proxy intercepte la requete, resout le vrai secret via le `secretService` existant, injecte le header `Authorization` ou `x-api-key`, et forward la requete au vrai endpoint
- Les logs du container ne contiennent JAMAIS les vraies cles
- L'acces au proxy est controle par JWT agent + rules `credential_proxy_rules`

### Ce que cette story construit

1. **CredentialProxyServer** (`server/src/services/credential-proxy.ts`) -- serveur HTTP interne qui ecoute sur un port dynamique par container instance, intercepte les requetes API des agents, resout les secrets, et forward les requetes
2. **CredentialProxyManager** -- gestion du lifecycle des proxies : creation/destruction liee au lifecycle du container (start proxy quand container lance, stop quand container arrete)
3. **Integration ContainerManager** -- modification de `container-manager.ts` pour :
   - Verifier `credentialProxyEnabled` sur le profil
   - Demarrer un proxy quand le container est lance
   - Passer `CREDENTIAL_PROXY_URL` et les placeholder env vars au container
   - Enregistrer le `credentialProxyPort` dans `container_instances`
   - Arreter le proxy quand le container s'arrete
4. **Routes API** pour la gestion des `credential_proxy_rules` (CRUD)
5. **Service de gestion des rules** -- CRUD + validation + matching pattern
6. **Audit trail** -- emission d'audit events pour chaque acces secret via proxy (`credential.accessed`, `credential.denied`, `credential.error`)
7. **Types partages** -- dans `packages/shared/src/types/credential-proxy.ts`

### Ce que cette story ne fait PAS (scope)

- Pas de mount allowlist tamper-proof (CONT-S03)
- Pas d'isolation reseau Docker (CONT-S04 -- le proxy utilise le reseau Docker existant)
- Pas d'UI pour configurer les credential proxy rules (future story ou via API)
- Pas de support OAuth Bearer token exchange (P2 -- mode API-key seulement pour MVP)
- Pas de rate limiting specifique au proxy (utilise le rate limiting global existant)
- Pas de caching des secrets resolus (chaque requete resout le secret a la volee pour securite maximale)

---

## Etat Actuel du Code (Analyse)

### Fichiers existants impactes

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `server/src/services/container-manager.ts` | Lifecycle containers Docker | MODIFIE : integration credential proxy (start/stop proxy, env vars, port tracking) |
| `server/src/routes/containers.ts` | Routes API containers | MODIFIE : nouvelles routes pour credential_proxy_rules CRUD |
| `server/src/services/secrets.ts` | Resolution secrets (resolveSecretValue, resolveEnvBindings) | NON MODIFIE (utilise tel quel via import) |
| `server/src/services/index.ts` | Barrel exports services | MODIFIE : export credentialProxyService |
| `server/src/services/audit-emitter.ts` | Emission audit events | NON MODIFIE (utilise tel quel) |
| `server/src/agent-auth-jwt.ts` | JWT pour agents containerises | NON MODIFIE (utilise pour authentifier les requetes proxy) |
| `packages/db/src/schema/credential_proxy_rules.ts` | Schema table credential_proxy_rules (existant TECH-06) | NON MODIFIE (utilise tel quel) |
| `packages/db/src/schema/container_instances.ts` | Schema avec credentialProxyPort (existant CONT-S05) | NON MODIFIE (utilise tel quel) |
| `packages/db/src/schema/container_profiles.ts` | Schema avec credentialProxyEnabled (existant CONT-S05) | NON MODIFIE (utilise tel quel) |
| `packages/shared/src/types/container.ts` | Types container (ContainerLaunchOptions, etc.) | MODIFIE : ajout credentialProxyUrl dans ContainerLaunchResult |
| `packages/shared/src/types/index.ts` | Barrel exports types | MODIFIE : export types credential-proxy |
| `server/src/app.ts` | Montage Express routes | MODIFIE : montage routes credential-proxy-rules |

### Fichiers a creer

| Fichier | Role |
|---------|------|
| `server/src/services/credential-proxy.ts` | Service CredentialProxy : proxy HTTP, resolution secrets, forward, audit |
| `server/src/services/credential-proxy-rules.ts` | Service CRUD pour credential_proxy_rules |
| `server/src/routes/credential-proxy-rules.ts` | Routes REST pour gestion des rules |
| `packages/shared/src/types/credential-proxy.ts` | Types partages : CredentialProxyRule, CredentialProxyConfig, etc. |
| `packages/shared/src/validators/credential-proxy.ts` | Schemas Zod pour validation |

### Fichiers de reference (non modifies)

| Fichier | Role |
|---------|------|
| `server/src/secrets/provider-registry.ts` | Registry des providers de secrets (local_encrypted, aws, gcp, vault) |
| `server/src/services/access.ts` | hasPermission, requirePermission |
| `server/src/services/live-events.ts` | publishLiveEvent pour notifications temps reel |
| `server/src/errors.ts` | conflict(), forbidden(), notFound(), unprocessable() |

### Conventions du codebase (a respecter)

1. **Service pattern** : `credentialProxyService(db)` retourne un objet de fonctions -- pas de classes
2. **Error handling** : `throw conflict("message")`, `throw forbidden("message")`
3. **Drizzle queries** : `db.select().from().where(and(...))` avec `drizzle-orm` operators
4. **Audit** : `emitAudit({ req, db, companyId, action, targetType, targetId, metadata })`
5. **Zod validation** : schemas dans `packages/shared/src/validators/` ou inline dans routes
6. **Routes** : `requirePermission(db, "permission:key")` middleware sur chaque route
7. **Tests** : `data-testid` format `cont-s02-[element]`

---

## Specification Technique

### S1 : CredentialProxyServer -- Proxy HTTP interne

**Fichier** : `server/src/services/credential-proxy.ts`

Le credential proxy est un serveur HTTP Node.js natif (pas Express -- minimaliste pour performance et securite) qui ecoute sur un port dynamique par container instance.

#### Architecture du proxy

```
Container (agent)                     Host (MnM server)
+-------------------+                +----------------------------------+
| Agent process     |                | CredentialProxyServer            |
|                   |   HTTP         |   port: dynamique (8090-8190)    |
| ANTHROPIC_BASE_URL| ============> |   +--> Verify JWT (agent auth)   |
| =proxy:PORT       |               |   +--> Match secret pattern      |
|                   |               |   +--> Resolve secret via svc    |
| ANTHROPIC_API_KEY |               |   +--> Inject real API key       |
| =placeholder      |               |   +--> Forward to real endpoint  |
+-------------------+               |   +--> Emit audit event          |
                                    +----------------------------------+
```

#### Flux de requete detaille

1. L'agent dans le container fait une requete API (ex: `POST https://api.anthropic.com/v1/messages`)
2. Comme `ANTHROPIC_BASE_URL=http://host.docker.internal:{proxyPort}`, la requete arrive au proxy
3. Le proxy extrait le JWT agent du header `Authorization: Bearer {agent_jwt}` ou `x-mnm-agent-jwt`
4. Le proxy verifie le JWT via `verifyLocalAgentJwt(token)`
5. Le proxy extrait le `agentId` et `companyId` du JWT
6. Le proxy cherche les `credential_proxy_rules` actives pour cette company et ce pattern
7. Le proxy resout le secret via `secretService(db).resolveSecretValue(companyId, secretId, "latest")`
8. Le proxy injecte le vrai API key dans le header de la requete sortante (ex: `x-api-key: sk-ant-...`)
9. Le proxy supprime le header JWT MnM de la requete sortante
10. Le proxy forward la requete vers le vrai endpoint API
11. Le proxy emit un audit event `credential.accessed` (SANS le secret)
12. Le proxy retourne la reponse au container

#### Port dynamique

Chaque container instance recoit un port proxy unique dans la plage `8090-8190`. Le port est alloue dynamiquement et enregistre dans `container_instances.credentialProxyPort`.

```typescript
// cont-s02-svc-port-alloc
const MIN_PROXY_PORT = 8090;
const MAX_PROXY_PORT = 8190;
const PROXY_PORT_POOL_SIZE = MAX_PROXY_PORT - MIN_PROXY_PORT + 1;

async function allocateProxyPort(db: Db): Promise<number> {
  // Query les ports deja utilises par des containers actifs
  const usedPorts = await db.select({ port: containerInstances.credentialProxyPort })
    .from(containerInstances)
    .where(
      and(
        inArray(containerInstances.status, ["pending", "creating", "running"]),
        isNotNull(containerInstances.credentialProxyPort)
      )
    );
  const usedSet = new Set(usedPorts.map(p => p.port).filter(Boolean));
  for (let port = MIN_PROXY_PORT; port <= MAX_PROXY_PORT; port++) {
    if (!usedSet.has(port)) return port;
  }
  throw conflict("No available proxy ports — maximum concurrent proxied containers reached");
}
```

#### Serveur HTTP du proxy

```typescript
// cont-s02-svc-proxy-server
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

interface ProxyServerConfig {
  port: number;
  instanceId: string;
  agentId: string;
  companyId: string;
  secretMappings: SecretMapping[];  // Resolved from credential_proxy_rules
  db: Db;
}

interface SecretMapping {
  envKeyPlaceholder: string;  // e.g. "ANTHROPIC_API_KEY"
  secretId: string;           // UUID from company_secrets
  headerName: string;         // e.g. "x-api-key" or "Authorization"
  headerPrefix: string;       // e.g. "" for raw key, "Bearer " for OAuth
  targetBaseUrl: string;      // e.g. "https://api.anthropic.com"
}
```

#### Mode de fonctionnement : Forward Proxy

Le proxy fonctionne en mode "forward proxy" :
- Le container envoie la requete avec le path original (ex: `/v1/messages`)
- Le proxy lit le header `x-mnm-target-url` pour determiner le vrai endpoint de destination
- Ou bien le proxy utilise le `targetBaseUrl` de la rule matchee
- Le proxy forward la requete en substituant les credentials

#### Securite du proxy

| Controle | Implementation |
|----------|---------------|
| **Auth JWT** | Chaque requete DOIT contenir un JWT agent valide (verifie via `verifyLocalAgentJwt`) |
| **Scope company** | Le JWT contient `company_id` -- le proxy ne resout QUE les secrets de cette company |
| **Scope agent** | Le JWT contient `sub` (agentId) -- le proxy verifie que l'agent a le droit d'acceder au secret via les rules |
| **No logging secrets** | Le proxy ne logge JAMAIS la valeur du secret resolu. Seul le nom du secret et le resultat (success/denied) sont logges |
| **No env exposure** | Le container ne recoit QUE des placeholder values dans ses env vars |
| **Bind localhost** | Le proxy bind sur `0.0.0.0` pour etre accessible depuis le bridge Docker, mais est limite au reseau Docker interne |
| **Timeout** | Chaque requete proxy a un timeout de 30s |
| **Max body** | Les requetes sont limitees a 10MB |

#### Fonctions du service

| Fonction | Signature | Description |
|----------|-----------|-------------|
| `startProxy` | `(config: ProxyServerConfig) => Promise<ProxyInstance>` | Demarre un serveur HTTP proxy pour une instance container |
| `stopProxy` | `(instanceId: string) => Promise<void>` | Arrete et nettoie le proxy pour une instance |
| `handleProxyRequest` | `(req, res, config) => Promise<void>` | Traite une requete proxy : auth, resolve, forward, audit |
| `resolveSecretForProxy` | `(companyId, secretId) => Promise<string>` | Resout un secret via secretService (sans caching) |
| `matchRule` | `(rules, envKey) => SecretMapping | null` | Trouve la rule applicable pour un env key donne |
| `getActiveProxies` | `() => Map<string, ProxyInstance>` | Retourne les proxies actifs (pour monitoring/cleanup) |
| `cleanupAllProxies` | `() => Promise<void>` | Arrete tous les proxies (appele au shutdown du serveur) |

#### data-testid du service

| data-testid | Element | Description |
|-------------|---------|-------------|
| `cont-s02-svc-port-alloc` | Function | Allocation de port dynamique |
| `cont-s02-svc-proxy-server` | Function | Creation serveur HTTP proxy |
| `cont-s02-svc-handle-request` | Function | Traitement requete proxy |
| `cont-s02-svc-resolve-secret` | Function | Resolution secret pour proxy |
| `cont-s02-svc-match-rule` | Function | Matching rule pour env key |
| `cont-s02-svc-start-proxy` | Function | Demarrage proxy pour instance |
| `cont-s02-svc-stop-proxy` | Function | Arret proxy pour instance |
| `cont-s02-svc-cleanup-all` | Function | Cleanup global des proxies |
| `cont-s02-svc-jwt-verify` | Block | Verification JWT dans le proxy |
| `cont-s02-svc-header-inject` | Block | Injection du header avec le vrai secret |
| `cont-s02-svc-forward-request` | Block | Forward de la requete au vrai endpoint |
| `cont-s02-svc-audit-emit` | Block | Emission audit event apres resolution |

---

### S2 : Service CRUD credential_proxy_rules

**Fichier** : `server/src/services/credential-proxy-rules.ts`

Service pour gerer les rules qui definissent quels secrets sont accessibles via le proxy et par quels agents.

#### Schema de la table (existant TECH-06)

```
credential_proxy_rules:
  id              UUID PK
  companyId       UUID FK -> companies
  name            TEXT NOT NULL (ex: "Anthropic API Key")
  secretPattern   TEXT NOT NULL (ex: "ANTHROPIC_*" ou nom exact "OPENAI_API_KEY")
  allowedAgentRoles  JSONB string[] (ex: ["*"] ou ["developer", "analyst"])
  proxyEndpoint   TEXT DEFAULT "http://credential-proxy:8090"
  enabled         BOOLEAN DEFAULT true
  createdByUserId TEXT
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP
```

#### Fonctions du service

| Fonction | Signature | Description |
|----------|-----------|-------------|
| `listRules` | `(companyId: string) => Promise<CredentialProxyRule[]>` | Liste les rules d'une company |
| `getRuleById` | `(companyId: string, ruleId: string) => Promise<CredentialProxyRule>` | Get rule par ID |
| `createRule` | `(companyId: string, input: CreateRuleInput, actorId: string) => Promise<CredentialProxyRule>` | Cree une nouvelle rule |
| `updateRule` | `(companyId: string, ruleId: string, input: UpdateRuleInput) => Promise<CredentialProxyRule>` | Met a jour une rule |
| `deleteRule` | `(companyId: string, ruleId: string) => Promise<CredentialProxyRule>` | Supprime une rule |
| `findMatchingRules` | `(companyId: string, secretName: string) => Promise<CredentialProxyRule[]>` | Trouve les rules actives matchant un nom de secret |
| `resolveRulesForAgent` | `(companyId: string, agentId: string) => Promise<SecretMapping[]>` | Resout toutes les rules applicables a un agent (pour construire la config du proxy) |

#### Pattern matching des secrets

Le champ `secretPattern` supporte :
- **Nom exact** : `OPENAI_API_KEY` -- match uniquement ce secret
- **Wildcard suffix** : `ANTHROPIC_*` -- match tous les secrets commencant par `ANTHROPIC_`
- **Wildcard** : `*` -- match tous les secrets (a utiliser avec precaution)

#### data-testid du service CRUD

| data-testid | Element | Description |
|-------------|---------|-------------|
| `cont-s02-rules-list` | Function | Liste des rules |
| `cont-s02-rules-get` | Function | Get rule par ID |
| `cont-s02-rules-create` | Function | Creation rule |
| `cont-s02-rules-update` | Function | Mise a jour rule |
| `cont-s02-rules-delete` | Function | Suppression rule |
| `cont-s02-rules-match` | Function | Pattern matching |
| `cont-s02-rules-resolve` | Function | Resolution rules pour un agent |

---

### S3 : Integration ContainerManager

**Fichier** : `server/src/services/container-manager.ts`

Modifications pour integrer le credential proxy dans le lifecycle du container.

#### Modification de `launchContainer()`

Apres l'etape 7 (build container options) et avant l'etape 8 (create Docker container), ajouter :

```typescript
// cont-s02-cm-proxy-check
// 7b. Check if credential proxy is enabled for this profile
if (profile.credentialProxyEnabled) {
  // 7c. Allocate proxy port
  const proxyPort = await allocateProxyPort(db);

  // 7d. Resolve credential proxy rules for this agent
  const secretMappings = await credentialProxyRulesService.resolveRulesForAgent(
    companyId, agentId
  );

  // 7e. Start proxy server
  const proxyInstance = await credentialProxyService.startProxy({
    port: proxyPort,
    instanceId: instance.id,
    agentId,
    companyId,
    secretMappings,
    db,
  });

  // 7f. Add proxy env vars to container
  // Replace real API keys with placeholders + proxy URL
  for (const mapping of secretMappings) {
    containerEnv.push(`${mapping.envKeyPlaceholder}=mnm-proxy-placeholder`);
  }
  containerEnv.push(`MNM_CREDENTIAL_PROXY_URL=http://host.docker.internal:${proxyPort}`);
  containerEnv.push(`MNM_CREDENTIAL_PROXY_PORT=${proxyPort}`);

  // 7g. Update instance with proxy port
  await db.update(containerInstances)
    .set({ credentialProxyPort: proxyPort, updatedAt: new Date() })
    .where(eq(containerInstances.id, instance.id));
}
```

#### Modification de `stopContainer()`

Apres l'arret du container Docker, ajouter :

```typescript
// cont-s02-cm-proxy-stop
// Stop credential proxy if running
await credentialProxyService.stopProxy(instanceId);
```

#### Modification de `buildDockerCreateOptions()`

Ajouter le support pour les env vars proxy :

```typescript
// cont-s02-cm-build-opts
// Si credentialProxyEnabled, les env vars de type secret sont remplacees par des placeholders
// et MNM_CREDENTIAL_PROXY_URL est ajoutee
```

#### Modification de `cleanupStaleContainers()`

Ajouter le cleanup des proxies orphelins :

```typescript
// cont-s02-cm-cleanup-proxies
// Cleanup any orphan proxy servers
await credentialProxyService.cleanupAllProxies();
```

#### data-testid du ContainerManager modifie

| data-testid | Element | Description |
|-------------|---------|-------------|
| `cont-s02-cm-proxy-check` | Block | Verification si proxy active sur le profil |
| `cont-s02-cm-proxy-start` | Block | Demarrage du proxy dans launchContainer |
| `cont-s02-cm-proxy-env` | Block | Injection env vars proxy dans container |
| `cont-s02-cm-proxy-stop` | Block | Arret du proxy dans stopContainer |
| `cont-s02-cm-cleanup-proxies` | Block | Cleanup proxies dans cleanupStaleContainers |
| `cont-s02-cm-proxy-port-save` | Block | Sauvegarde port proxy dans container_instances |

---

### S4 : Routes API credential_proxy_rules

**Fichier** : `server/src/routes/credential-proxy-rules.ts`

Routes REST pour la gestion des rules du credential proxy.

#### Endpoints

| Methode | Path | Permission | Description |
|---------|------|------------|-------------|
| GET | `/api/companies/:companyId/credential-proxy-rules` | `company:manage_settings` | Lister les rules |
| GET | `/api/companies/:companyId/credential-proxy-rules/:ruleId` | `company:manage_settings` | Get rule par ID |
| POST | `/api/companies/:companyId/credential-proxy-rules` | `company:manage_settings` | Creer une rule |
| PUT | `/api/companies/:companyId/credential-proxy-rules/:ruleId` | `company:manage_settings` | Modifier une rule |
| DELETE | `/api/companies/:companyId/credential-proxy-rules/:ruleId` | `company:manage_settings` | Supprimer une rule |
| POST | `/api/companies/:companyId/credential-proxy-rules/:ruleId/test` | `company:manage_settings` | Tester une rule (dry-run resolution) |

#### Validation Zod

```typescript
// cont-s02-validator-create-rule
const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  secretPattern: z.string().min(1).max(200),
  allowedAgentRoles: z.array(z.string()).min(1).default(["*"]),
  proxyEndpoint: z.string().url().optional(),
  enabled: z.boolean().optional().default(true),
});

// cont-s02-validator-update-rule
const updateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  secretPattern: z.string().min(1).max(200).optional(),
  allowedAgentRoles: z.array(z.string()).min(1).optional(),
  proxyEndpoint: z.string().url().optional(),
  enabled: z.boolean().optional(),
});

// cont-s02-validator-test-rule
const testRuleSchema = z.object({
  secretName: z.string().min(1),
  agentId: z.string().uuid().optional(),
});
```

#### Audit events emis

| Action | Quand | Metadata |
|--------|-------|----------|
| `credential_proxy_rule.created` | POST create | `{ name, secretPattern, allowedAgentRoles }` |
| `credential_proxy_rule.updated` | PUT update | `{ ruleId, changes: [...keys] }` |
| `credential_proxy_rule.deleted` | DELETE | `{ ruleId, name }` |
| `credential_proxy_rule.tested` | POST test | `{ ruleId, secretName, matched: boolean }` |

#### data-testid des routes

| data-testid | Element | Description |
|-------------|---------|-------------|
| `cont-s02-route-list-rules` | Route | GET list rules |
| `cont-s02-route-get-rule` | Route | GET rule by ID |
| `cont-s02-route-create-rule` | Route | POST create rule |
| `cont-s02-route-update-rule` | Route | PUT update rule |
| `cont-s02-route-delete-rule` | Route | DELETE rule |
| `cont-s02-route-test-rule` | Route | POST test rule |

---

### S5 : Types partages

**Fichier** : `packages/shared/src/types/credential-proxy.ts`

```typescript
// cont-s02-type-rule
export interface CredentialProxyRule {
  id: string;
  companyId: string;
  name: string;
  secretPattern: string;
  allowedAgentRoles: string[];
  proxyEndpoint: string;
  enabled: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

// cont-s02-type-config
export interface CredentialProxyConfig {
  enabled: boolean;
  port: number;
  instanceId: string;
  agentId: string;
  companyId: string;
  secretMappings: CredentialProxySecretMapping[];
}

// cont-s02-type-mapping
export interface CredentialProxySecretMapping {
  envKeyPlaceholder: string;   // "ANTHROPIC_API_KEY"
  secretId: string;            // UUID
  secretName: string;          // "anthropic-api-key"
  headerName: string;          // "x-api-key"
  headerPrefix: string;        // "" or "Bearer "
  targetBaseUrl: string;       // "https://api.anthropic.com"
}

// cont-s02-type-proxy-status
export interface CredentialProxyStatus {
  instanceId: string;
  port: number;
  active: boolean;
  requestCount: number;
  lastRequestAt: string | null;
  secretsResolved: number;
  secretsDenied: number;
}

// cont-s02-type-access-event
export interface CredentialProxyAccessEvent {
  instanceId: string;
  agentId: string;
  companyId: string;
  secretName: string;
  action: "accessed" | "denied" | "error";
  reason?: string;
  timestamp: string;
}

// cont-s02-type-create-input
export interface CreateCredentialProxyRuleInput {
  name: string;
  secretPattern: string;
  allowedAgentRoles?: string[];
  proxyEndpoint?: string;
  enabled?: boolean;
}

// cont-s02-type-update-input
export interface UpdateCredentialProxyRuleInput {
  name?: string;
  secretPattern?: string;
  allowedAgentRoles?: string[];
  proxyEndpoint?: string;
  enabled?: boolean;
}

// cont-s02-type-test-result
export interface CredentialProxyTestResult {
  matched: boolean;
  rule: CredentialProxyRule | null;
  secretFound: boolean;
  secretName: string;
  reason?: string;
}
```

#### Modification de `ContainerLaunchResult`

Ajouter dans `packages/shared/src/types/container.ts` :

```typescript
// cont-s02-type-launch-result-ext
export interface ContainerLaunchResult {
  // ... champs existants ...
  credentialProxyPort: number | null;   // Port du proxy si active
  credentialProxyUrl: string | null;    // URL complete du proxy
}
```

#### data-testid des types

| data-testid | Element | Description |
|-------------|---------|-------------|
| `cont-s02-type-rule` | Type | CredentialProxyRule interface |
| `cont-s02-type-config` | Type | CredentialProxyConfig interface |
| `cont-s02-type-mapping` | Type | CredentialProxySecretMapping interface |
| `cont-s02-type-proxy-status` | Type | CredentialProxyStatus interface |
| `cont-s02-type-access-event` | Type | CredentialProxyAccessEvent interface |
| `cont-s02-type-create-input` | Type | CreateCredentialProxyRuleInput interface |
| `cont-s02-type-update-input` | Type | UpdateCredentialProxyRuleInput interface |
| `cont-s02-type-test-result` | Type | CredentialProxyTestResult interface |
| `cont-s02-type-launch-result-ext` | Type | ContainerLaunchResult extension |

---

### S6 : Audit events

Le credential proxy emet des audit events specifiques pour la tracabilite securite.

#### Events du proxy (temps reel, a chaque requete)

| Action | Severity | Quand | Metadata |
|--------|----------|-------|----------|
| `credential.accessed` | `info` | Secret resolu et injecte avec succes | `{ secretName, agentId, instanceId, targetUrl }` (SANS la valeur du secret) |
| `credential.denied` | `warning` | Agent tente d'acceder a un secret non autorise | `{ secretName, agentId, instanceId, reason }` |
| `credential.error` | `error` | Erreur lors de la resolution du secret | `{ secretName, agentId, instanceId, error }` |
| `credential.proxy_started` | `info` | Proxy demarre pour une instance | `{ instanceId, port, agentId, rulesCount }` |
| `credential.proxy_stopped` | `info` | Proxy arrete pour une instance | `{ instanceId, port }` |

#### Events des rules CRUD (via routes)

| Action | Severity | Metadata |
|--------|----------|----------|
| `credential_proxy_rule.created` | `info` | `{ name, secretPattern, allowedAgentRoles }` |
| `credential_proxy_rule.updated` | `info` | `{ ruleId, changes }` |
| `credential_proxy_rule.deleted` | `warning` | `{ ruleId, name }` |

#### data-testid des audits

| data-testid | Element | Description |
|-------------|---------|-------------|
| `cont-s02-audit-accessed` | Audit | Secret accede avec succes |
| `cont-s02-audit-denied` | Audit | Acces secret refuse |
| `cont-s02-audit-error` | Audit | Erreur resolution secret |
| `cont-s02-audit-proxy-started` | Audit | Proxy demarre |
| `cont-s02-audit-proxy-stopped` | Audit | Proxy arrete |
| `cont-s02-audit-rule-created` | Audit | Rule creee |
| `cont-s02-audit-rule-updated` | Audit | Rule mise a jour |
| `cont-s02-audit-rule-deleted` | Audit | Rule supprimee |

---

### S7 : Validators Zod

**Fichier** : `packages/shared/src/validators/credential-proxy.ts`

```typescript
import { z } from "zod";

// cont-s02-validator-create-rule
export const createCredentialProxyRuleSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  secretPattern: z.string().min(1).max(200).trim()
    .refine(
      (v) => /^[A-Za-z0-9_*-]+$/.test(v),
      "Secret pattern must contain only alphanumeric, underscore, hyphen, or wildcard (*)"
    ),
  allowedAgentRoles: z.array(z.string().min(1).max(50)).min(1).default(["*"]),
  proxyEndpoint: z.string().url().max(500).optional(),
  enabled: z.boolean().optional().default(true),
});

// cont-s02-validator-update-rule
export const updateCredentialProxyRuleSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  secretPattern: z.string().min(1).max(200).trim()
    .refine(
      (v) => /^[A-Za-z0-9_*-]+$/.test(v),
      "Secret pattern must contain only alphanumeric, underscore, hyphen, or wildcard (*)"
    )
    .optional(),
  allowedAgentRoles: z.array(z.string().min(1).max(50)).min(1).optional(),
  proxyEndpoint: z.string().url().max(500).optional(),
  enabled: z.boolean().optional(),
});

// cont-s02-validator-test-rule
export const testCredentialProxyRuleSchema = z.object({
  secretName: z.string().min(1).max(200).trim(),
  agentId: z.string().uuid().optional(),
});
```

#### data-testid des validators

| data-testid | Element | Description |
|-------------|---------|-------------|
| `cont-s02-validator-create-rule` | Validator | Schema creation rule |
| `cont-s02-validator-update-rule` | Validator | Schema update rule |
| `cont-s02-validator-test-rule` | Validator | Schema test rule |

---

## Acceptance Criteria

### AC1 : Resolution et injection de secrets via proxy (Happy Path)

**Given** un container avec `credentialProxyEnabled=true` sur son profil et une rule `ANTHROPIC_*` pointant vers le secret `anthropic-api-key`
**When** l'agent dans le container fait une requete HTTP vers `http://host.docker.internal:{proxyPort}/v1/messages` avec header `x-mnm-agent-jwt: {valid_jwt}`
**Then** le proxy resout le secret, injecte `x-api-key: sk-ant-xxxxx` dans le header, forward vers `https://api.anthropic.com/v1/messages`, et retourne la reponse au container

### AC2 : Aucune cle dans les logs

**Given** le credential proxy en fonctionnement
**When** un secret est resolu et injecte
**Then** la valeur du secret n'apparait dans AUCUN log (ni serveur, ni container, ni audit event metadata)

### AC3 : Acces refuse sans JWT valide

**Given** une requete vers le credential proxy
**When** le header `x-mnm-agent-jwt` est absent ou contient un JWT invalide/expire
**Then** le proxy retourne `401 Unauthorized` et emet un audit `credential.denied` avec `reason: "invalid_jwt"`

### AC4 : Acces refuse si pas de rule matchante

**Given** un agent avec un JWT valide
**When** il demande un secret pour lequel aucune `credential_proxy_rule` active ne matche
**Then** le proxy retourne `403 Forbidden` et emet un audit `credential.denied` avec `reason: "no_matching_rule"`

### AC5 : Acces refuse si agent pas dans allowedAgentRoles

**Given** une rule avec `allowedAgentRoles: ["developer"]` et un agent qui n'a pas ce role
**When** l'agent tente d'acceder au secret
**Then** le proxy retourne `403 Forbidden` et emet un audit `credential.denied` avec `reason: "role_not_allowed"`

### AC6 : Proxy demarre/arrete avec le container

**Given** un container avec `credentialProxyEnabled=true`
**When** le container est lance via `launchContainer()`
**Then** un proxy HTTP est demarre sur un port dynamique et `credentialProxyPort` est enregistre dans `container_instances`
**And When** le container est arrete via `stopContainer()`
**Then** le proxy est arrete et le port est libere

### AC7 : Pas de proxy si desactive

**Given** un container avec `credentialProxyEnabled=false` (ou absent) sur son profil
**When** le container est lance
**Then** aucun proxy n'est demarre et `credentialProxyPort` reste `null`

### AC8 : CRUD credential_proxy_rules

**Given** un Admin connecte
**When** il appelle POST `/api/companies/:companyId/credential-proxy-rules` avec un body valide
**Then** une rule est creee et un audit `credential_proxy_rule.created` est emis
**And** la rule est visible dans GET `/api/companies/:companyId/credential-proxy-rules`
**And** la rule peut etre modifiee via PUT et supprimee via DELETE

### AC9 : Test dry-run d'une rule

**Given** une rule creee avec `secretPattern: "OPENAI_*"`
**When** on appelle POST `.../credential-proxy-rules/:ruleId/test` avec `{ secretName: "OPENAI_API_KEY" }`
**Then** le resultat indique `{ matched: true, secretFound: true/false }`

### AC10 : Port dynamique unique par instance

**Given** 3 containers avec credential proxy actif lances en parallele
**When** les ports sont alloues
**Then** chaque container recoit un port unique dans la plage 8090-8190

### AC11 : Acces bloque depuis l'exterieur du reseau Docker

**Given** le credential proxy actif sur le port 8095
**When** un client HTTP externe (hors Docker bridge) tente d'acceder au port 8095
**Then** la requete est refusee (bind sur interface Docker bridge uniquement ou verification du header JWT)

### AC12 : Cleanup des proxies au demarrage serveur

**Given** le serveur MnM qui redemarre
**When** `cleanupStaleContainers()` est appele
**Then** tous les proxies orphelins sont arretes et les ports sont liberes

### AC13 : Audit trail complet

**Given** un agent qui utilise le credential proxy pendant une session
**When** la session se termine
**Then** l'audit trail contient : `credential.proxy_started`, N x `credential.accessed` et/ou `credential.denied`, `credential.proxy_stopped`

### AC14 : Secret non trouve

**Given** une rule matchante mais le secret reference n'existe pas dans `company_secrets`
**When** l'agent tente d'acceder au secret
**Then** le proxy retourne `404 Not Found` et emet un audit `credential.error` avec `reason: "secret_not_found"`

### AC15 : Proxy resilient aux erreurs de forward

**Given** le credential proxy qui forward une requete vers un endpoint externe
**When** l'endpoint externe retourne une erreur (5xx, timeout)
**Then** le proxy retourne l'erreur telle quelle au container sans crash

---

## Mapping data-testid complet

### Service credential-proxy.ts

| data-testid | Type | Description |
|-------------|------|-------------|
| `cont-s02-svc-port-alloc` | Function | Allocation port dynamique |
| `cont-s02-svc-proxy-server` | Function | Creation serveur HTTP proxy |
| `cont-s02-svc-handle-request` | Function | Traitement requete proxy |
| `cont-s02-svc-resolve-secret` | Function | Resolution secret |
| `cont-s02-svc-match-rule` | Function | Pattern matching rule |
| `cont-s02-svc-start-proxy` | Function | Demarrage proxy |
| `cont-s02-svc-stop-proxy` | Function | Arret proxy |
| `cont-s02-svc-cleanup-all` | Function | Cleanup global |
| `cont-s02-svc-jwt-verify` | Block | Verification JWT |
| `cont-s02-svc-header-inject` | Block | Injection header |
| `cont-s02-svc-forward-request` | Block | Forward requete |
| `cont-s02-svc-audit-emit` | Block | Emission audit |

### Service credential-proxy-rules.ts

| data-testid | Type | Description |
|-------------|------|-------------|
| `cont-s02-rules-list` | Function | List rules |
| `cont-s02-rules-get` | Function | Get rule |
| `cont-s02-rules-create` | Function | Create rule |
| `cont-s02-rules-update` | Function | Update rule |
| `cont-s02-rules-delete` | Function | Delete rule |
| `cont-s02-rules-match` | Function | Match pattern |
| `cont-s02-rules-resolve` | Function | Resolve for agent |

### ContainerManager modifications

| data-testid | Type | Description |
|-------------|------|-------------|
| `cont-s02-cm-proxy-check` | Block | Check proxy enabled |
| `cont-s02-cm-proxy-start` | Block | Start proxy in launch |
| `cont-s02-cm-proxy-env` | Block | Inject proxy env |
| `cont-s02-cm-proxy-stop` | Block | Stop proxy in stop |
| `cont-s02-cm-cleanup-proxies` | Block | Cleanup in startup |
| `cont-s02-cm-proxy-port-save` | Block | Save port in DB |

### Routes credential-proxy-rules.ts

| data-testid | Type | Description |
|-------------|------|-------------|
| `cont-s02-route-list-rules` | Route | GET list |
| `cont-s02-route-get-rule` | Route | GET by ID |
| `cont-s02-route-create-rule` | Route | POST create |
| `cont-s02-route-update-rule` | Route | PUT update |
| `cont-s02-route-delete-rule` | Route | DELETE |
| `cont-s02-route-test-rule` | Route | POST test |

### Types credential-proxy.ts

| data-testid | Type | Description |
|-------------|------|-------------|
| `cont-s02-type-rule` | Type | CredentialProxyRule |
| `cont-s02-type-config` | Type | CredentialProxyConfig |
| `cont-s02-type-mapping` | Type | CredentialProxySecretMapping |
| `cont-s02-type-proxy-status` | Type | CredentialProxyStatus |
| `cont-s02-type-access-event` | Type | CredentialProxyAccessEvent |
| `cont-s02-type-create-input` | Type | CreateCredentialProxyRuleInput |
| `cont-s02-type-update-input` | Type | UpdateCredentialProxyRuleInput |
| `cont-s02-type-test-result` | Type | CredentialProxyTestResult |
| `cont-s02-type-launch-result-ext` | Type | ContainerLaunchResult ext |

### Validators

| data-testid | Type | Description |
|-------------|------|-------------|
| `cont-s02-validator-create-rule` | Validator | Create rule schema |
| `cont-s02-validator-update-rule` | Validator | Update rule schema |
| `cont-s02-validator-test-rule` | Validator | Test rule schema |

### Audit events

| data-testid | Type | Description |
|-------------|------|-------------|
| `cont-s02-audit-accessed` | Audit | credential.accessed |
| `cont-s02-audit-denied` | Audit | credential.denied |
| `cont-s02-audit-error` | Audit | credential.error |
| `cont-s02-audit-proxy-started` | Audit | credential.proxy_started |
| `cont-s02-audit-proxy-stopped` | Audit | credential.proxy_stopped |
| `cont-s02-audit-rule-created` | Audit | rule.created |
| `cont-s02-audit-rule-updated` | Audit | rule.updated |
| `cont-s02-audit-rule-deleted` | Audit | rule.deleted |

**Total data-testid** : 53

---

## Plan de test (QA Agent)

### Tests unitaires (dans les E2E file-content based)

| # | Test | Cible | AC |
|---|------|-------|----|
| T01 | `credential-proxy.ts` existe et exporte `credentialProxyService` | Service | - |
| T02 | `credentialProxyService(db)` retourne les fonctions attendues (startProxy, stopProxy, handleProxyRequest, ...) | Service | - |
| T03 | `allocateProxyPort()` retourne un port dans la plage 8090-8190 | Service | AC10 |
| T04 | `allocateProxyPort()` exclut les ports deja utilises par des containers actifs | Service | AC10 |
| T05 | `allocateProxyPort()` throw conflict si tous les ports sont pris | Service | AC10 |
| T06 | `handleProxyRequest()` verifie le JWT et rejette si invalide | Service | AC3 |
| T07 | `handleProxyRequest()` verifie le JWT et rejette si expire | Service | AC3 |
| T08 | `handleProxyRequest()` matche la rule pour le secret demande | Service | AC1 |
| T09 | `handleProxyRequest()` rejette si aucune rule ne matche | Service | AC4 |
| T10 | `handleProxyRequest()` rejette si le role agent n'est pas dans allowedAgentRoles | Service | AC5 |
| T11 | `handleProxyRequest()` resout le secret et injecte le header | Service | AC1 |
| T12 | `handleProxyRequest()` n'expose pas la valeur du secret dans les logs | Service | AC2 |
| T13 | `handleProxyRequest()` emet un audit `credential.accessed` | Service | AC13 |
| T14 | `handleProxyRequest()` emet un audit `credential.denied` si refuse | Service | AC13 |
| T15 | `handleProxyRequest()` retourne 404 si le secret n'existe pas | Service | AC14 |
| T16 | `startProxy()` cree un serveur HTTP et retourne le port | Service | AC6 |
| T17 | `stopProxy()` arrete le serveur et libere le port | Service | AC6 |
| T18 | `cleanupAllProxies()` arrete tous les proxies actifs | Service | AC12 |
| T19 | `credential-proxy-rules.ts` existe et exporte `credentialProxyRulesService` | Rules Service | - |
| T20 | `listRules()` retourne les rules d'une company | Rules Service | AC8 |
| T21 | `createRule()` cree une rule avec validation | Rules Service | AC8 |
| T22 | `updateRule()` modifie une rule existante | Rules Service | AC8 |
| T23 | `deleteRule()` supprime une rule | Rules Service | AC8 |
| T24 | `findMatchingRules()` matche un pattern exact | Rules Service | AC1 |
| T25 | `findMatchingRules()` matche un pattern wildcard suffix | Rules Service | AC1 |
| T26 | `findMatchingRules()` matche un pattern wildcard `*` | Rules Service | AC1 |
| T27 | `findMatchingRules()` ne matche pas un pattern non applicable | Rules Service | AC4 |
| T28 | `resolveRulesForAgent()` retourne les SecretMappings pour un agent | Rules Service | AC1 |
| T29 | Route GET `/credential-proxy-rules` retourne 200 avec la liste | Routes | AC8 |
| T30 | Route POST `/credential-proxy-rules` cree une rule et retourne 201 | Routes | AC8 |
| T31 | Route PUT `/credential-proxy-rules/:id` modifie une rule | Routes | AC8 |
| T32 | Route DELETE `/credential-proxy-rules/:id` supprime une rule | Routes | AC8 |
| T33 | Route POST `/credential-proxy-rules/:id/test` retourne le resultat du test | Routes | AC9 |
| T34 | Routes protegees par `requirePermission(db, "company:manage_settings")` | Routes | AC8 |
| T35 | Route POST create emet audit `credential_proxy_rule.created` | Routes | AC8 |
| T36 | Route DELETE emet audit `credential_proxy_rule.deleted` | Routes | AC8 |
| T37 | ContainerManager `launchContainer()` demarre le proxy si `credentialProxyEnabled` | CM | AC6 |
| T38 | ContainerManager `launchContainer()` NE demarre PAS le proxy si `credentialProxyEnabled=false` | CM | AC7 |
| T39 | ContainerManager `launchContainer()` enregistre `credentialProxyPort` dans la DB | CM | AC6 |
| T40 | ContainerManager `launchContainer()` injecte `MNM_CREDENTIAL_PROXY_URL` dans les env vars | CM | AC1 |
| T41 | ContainerManager `stopContainer()` arrete le proxy | CM | AC6 |
| T42 | ContainerManager `cleanupStaleContainers()` cleanup les proxies orphelins | CM | AC12 |
| T43 | Types `CredentialProxyRule` exporte dans shared/types | Types | - |
| T44 | Types `CredentialProxyConfig` exporte dans shared/types | Types | - |
| T45 | Types `CredentialProxySecretMapping` exporte dans shared/types | Types | - |
| T46 | Types `CredentialProxyStatus` exporte dans shared/types | Types | - |
| T47 | Types `CredentialProxyAccessEvent` exporte dans shared/types | Types | - |
| T48 | Types `CredentialProxyTestResult` exporte dans shared/types | Types | - |
| T49 | `ContainerLaunchResult` inclut `credentialProxyPort` et `credentialProxyUrl` | Types | AC6 |
| T50 | Validators Zod `createCredentialProxyRuleSchema` valide le pattern | Validators | - |
| T51 | Validators Zod `createCredentialProxyRuleSchema` rejette pattern invalide | Validators | - |
| T52 | Validators Zod `updateCredentialProxyRuleSchema` accepte mise a jour partielle | Validators | - |
| T53 | Validators Zod `testCredentialProxyRuleSchema` valide le secretName | Validators | - |
| T54 | `handleProxyRequest()` forward la reponse de l'endpoint externe au container | Service | AC15 |
| T55 | `handleProxyRequest()` retourne les erreurs de l'endpoint externe sans crash | Service | AC15 |
| T56 | `handleProxyRequest()` supprime le header `x-mnm-agent-jwt` avant le forward | Service | AC2 |
| T57 | Audit `credential.proxy_started` emis au demarrage du proxy | Audit | AC13 |
| T58 | Audit `credential.proxy_stopped` emis a l'arret du proxy | Audit | AC13 |
| T59 | Le service est exporte dans `server/src/services/index.ts` | Barrel | - |
| T60 | Les routes sont montees dans `server/src/app.ts` | Routes | - |
| T61 | `credential-proxy-rules.ts` routes montees dans app.ts | Routes | - |
| T62 | Port proxy libere quand container echoue au demarrage | Service | AC6 |
| T63 | Proxy ne demarre pas si aucune rule n'existe pour l'agent | Service | AC7 |

**Total tests** : 63

---

## Deliverables

| # | Fichier | Action | data-testid count |
|---|---------|--------|-------------------|
| D1 | `server/src/services/credential-proxy.ts` | CREER | 12 |
| D2 | `server/src/services/credential-proxy-rules.ts` | CREER | 7 |
| D3 | `server/src/routes/credential-proxy-rules.ts` | CREER | 6 |
| D4 | `packages/shared/src/types/credential-proxy.ts` | CREER | 9 |
| D5 | `packages/shared/src/validators/credential-proxy.ts` | CREER | 3 |
| D6 | `server/src/services/container-manager.ts` | MODIFIER | 6 |
| D7 | `packages/shared/src/types/container.ts` | MODIFIER | 0 (modif inline) |
| D8 | `server/src/services/index.ts` | MODIFIER | 0 (export) |
| D9 | `packages/shared/src/types/index.ts` | MODIFIER | 0 (export) |
| D10 | `server/src/app.ts` | MODIFIER | 0 (montage routes) |
| **Total** | | **5 CREER + 5 MODIFIER** | **43 + 8 audit = 53** |

---

## Risques et mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| Port exhaustion (>100 containers proxies simultanes) | Faible | Moyen | Pool de 101 ports (8090-8190) -- largement suffisant pour MVP. Alerte quand >80% utilises |
| Performance du proxy HTTP natif | Faible | Faible | Node.js HTTP natif est suffisant (<1ms overhead). Pas de serialisation/deserialisation du body |
| Fuite de secrets dans les erreurs | Moyen | Critique | Sanitization systematique : jamais de valeur secret dans les messages d'erreur. Only secret name |
| Race condition allocation port | Faible | Moyen | Transaction DB pour l'allocation de port. Re-essai si conflit |
| Proxy orphelin apres crash serveur | Moyen | Faible | Cleanup au demarrage via `cleanupAllProxies()` + `cleanupStaleContainers()` |

---

## Diagramme de sequence

```
Admin                API               CredentialProxyRulesService    DB
  |                   |                          |                    |
  |-- POST rule ----->|                          |                    |
  |                   |-- createRule() --------->|                    |
  |                   |                          |-- INSERT rule ---->|
  |                   |                          |<-- rule created ---|
  |                   |<-- 201 Created ---------|                    |
  |<-- rule ----------|                          |                    |

Admin/Agent          API               ContainerManager    CredentialProxy    SecretService
  |                   |                      |                   |                |
  |-- POST launch --->|                      |                   |                |
  |                   |-- launchContainer()-->|                   |                |
  |                   |                      |-- check profile-->|                |
  |                   |                      |   proxy enabled   |                |
  |                   |                      |-- allocatePort()  |                |
  |                   |                      |-- startProxy() -->|                |
  |                   |                      |                   |-- start HTTP   |
  |                   |                      |                   |   server       |
  |                   |                      |<-- proxy started -|                |
  |                   |                      |-- create Docker   |                |
  |                   |                      |   with proxy env  |                |
  |                   |<-- 201 + proxyPort --|                   |                |

Agent (in container)                  CredentialProxy           SecretService
  |                                        |                        |
  |-- API call to proxy URL ------------>  |                        |
  |   (x-mnm-agent-jwt: ...)              |                        |
  |                                        |-- verify JWT           |
  |                                        |-- match rule           |
  |                                        |-- resolveSecretValue-->|
  |                                        |                        |-- decrypt
  |                                        |<-- secret value -------|
  |                                        |-- inject header        |
  |                                        |-- forward to real API  |
  |                                        |<-- API response -------|
  |<-- API response ----------------------|                        |
  |                                        |-- emitAudit()          |
```
