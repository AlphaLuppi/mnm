# Architecture Section 7 — Compliance & Contraintes Business

*Par Mary l'Analyste* | Task #7 | 2026-03-14

> **Source** : PRD B2B v1.0 (Section 9 — 13 requirements réglementaires), PRD Section 3 (Domain Analysis & Regulatory Requirements)
> **Scope** : RGPD, Audit Trail, Data Residency, AI Act, Contraintes Business sur l'Architecture

---

## 1. Architecture RGPD — Implementation Technique

L'architecture RGPD de MnM doit garantir la conformité dès la conception (Privacy by Design, Article 25) tout en maintenant les performances et la cohérence du système d'orchestration d'agents IA. Chaque requirement réglementaire identifié dans le PRD est traduit ci-dessous en architecture technique concrète.

### 1.1 REQ-REG-02 — Droit à l'Effacement (Article 17)

#### Cartographie des données utilisateur

Un utilisateur dans MnM génère des données dans **7 domaines** distincts qui doivent tous être couverts par le mécanisme d'effacement :

| Domaine | Tables concernées | Type de données | Stratégie |
|---------|------------------|-----------------|-----------|
| **Identité** | `user`, `account`, `session`, `verification` | Email, nom, hash mot de passe, tokens | Suppression complète |
| **Membership** | `company_memberships`, `instance_user_roles`, `principal_permission_grants` | Rôles, permissions, scope | Suppression complète |
| **Activité agents** | `agents` (créés par user), `agent_task_sessions`, `agent_runtime_state` | Configs, sessions, état runtime | Suppression si agent personnel, anonymisation si agent partagé |
| **Communication** | `chat_messages`, `chat_channels` | Messages de dialogue humain-agent | Anonymisation (remplacer userId par `DELETED_USER_<hash>`) |
| **Audit** | `audit_events`, `activity_log` | Traces d'actions | Anonymisation obligatoire (l'audit doit rester pour la conformité) |
| **Contenu projet** | `issues`, `issue_comments`, `issue_attachments` | Stories, commentaires, fichiers | Anonymisation de l'auteur, contenu conservé |
| **Savoir tacite** | Contextes d'agents, résultats intermédiaires dans `stage_instances` | Connaissances capturées | Anonymisation si lié à un user spécifique |

#### Architecture du service d'effacement

```
UserDeletionService
├── discover(userId)         → Inventaire complet des données dans les 7 domaines
├── preview(userId)          → Rapport prévisuel : ce qui sera supprimé vs anonymisé
├── execute(userId)          → Transaction distribuée d'effacement/anonymisation
├── verify(userId)           → Vérification post-suppression (scan exhaustif)
└── audit(userId, requestId) → Trace de la demande d'effacement dans l'audit log
```

**Règles d'implémentation :**

1. **Transaction atomique** : L'effacement s'exécute dans une transaction PostgreSQL. Si une étape échoue, tout est rollbacké. Aucun état intermédiaire n'est acceptable.

2. **Anonymisation vs suppression** : Les données d'audit et les contenus partagés (issues, commentaires) sont ANONYMISÉS (remplacement du userId par un identifiant pseudonymisé irréversible `DELETED_USER_<SHA256(userId + salt)>`), pas supprimés. Cela préserve l'intégrité de l'audit trail tout en respectant le droit à l'effacement.

3. **Délai 30 jours** : La demande est enregistrée immédiatement dans `audit_events` avec un statut `PENDING`. Un job planifié (cron) exécute l'effacement. Le délai de 30 jours inclut une période de grâce de 7 jours pendant laquelle l'utilisateur peut annuler sa demande.

4. **Vérification post-suppression** : Après exécution, le service lance un scan exhaustif sur toutes les tables pour confirmer qu'aucune référence directe au userId ne subsiste. Le résultat du scan est loggé dans l'audit.

5. **Agents en cours d'exécution** : Si l'utilisateur a des agents actifs au moment de la demande d'effacement, ceux-ci sont arrêtés proprement (kill+cleanup) avant l'effacement. Les résultats intermédiaires sont anonymisés et conservés uniquement si nécessaires au workflow en cours.

#### Table de suivi des demandes d'effacement

```sql
CREATE TABLE deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId TEXT NOT NULL REFERENCES "user"(id),
    companyId UUID NOT NULL REFERENCES companies(id),
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'GRACE_PERIOD', 'EXECUTING', 'COMPLETED', 'CANCELLED', 'FAILED')),
    requestedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    graceDeadline TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    executedAt TIMESTAMPTZ,
    verifiedAt TIMESTAMPTZ,
    deletionReport JSONB, -- détail par domaine : nombre de lignes supprimées/anonymisées
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.2 REQ-REG-03 — Portabilité des Données (Article 20)

#### Périmètre de l'export

L'utilisateur peut exporter TOUTES ses données personnelles dans un format structuré et lisible par machine. L'export couvre :

| Catégorie | Données exportées | Format |
|-----------|------------------|--------|
| **Profil** | Nom, email, date de création, rôles | JSON |
| **Agents** | Configurations, rôles, historique d'exécution | JSON |
| **Messages** | Conversations chat avec agents | JSON/CSV |
| **Issues** | Stories créées/modifiées, commentaires | JSON/CSV |
| **Activité** | Log d'actions personnelles | CSV |
| **Consentements** | Historique des choix de consentement | JSON |

#### Architecture du service d'export

```
DataPortabilityService
├── buildManifest(userId)    → Liste de toutes les catégories exportables
├── export(userId, format)   → Génère l'archive (ZIP contenant JSON/CSV)
├── stream(userId, format)   → Export streaming pour gros volumes
└── notify(userId, downloadUrl) → Notification quand l'export est prêt
```

**API dédiée** : `POST /api/v1/users/:userId/data-export` avec authentification renforcée (re-saisie mot de passe ou 2FA). L'export est généré de manière asynchrone. L'utilisateur reçoit une notification avec un lien de téléchargement temporaire (expiration 24h, single-use).

**Délai** : L'export doit être disponible dans un délai de 72h maximum (cible : <1h pour les comptes standards, <24h pour les comptes avec historique volumineux).

### 1.3 REQ-REG-04 — Consentement Granulaire

#### Modèle de consentement

Le consentement dans MnM est granulaire : l'utilisateur consent séparément à chaque type de traitement IA. Le retrait d'un consentement spécifique désactive uniquement le traitement concerné, pas l'ensemble de la plateforme.

```sql
CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId TEXT NOT NULL REFERENCES "user"(id),
    companyId UUID NOT NULL REFERENCES companies(id),
    consentType TEXT NOT NULL CHECK (consentType IN (
        'AI_PROCESSING',        -- Traitement par agents IA
        'A2A_COMMUNICATION',    -- Communication inter-agents
        'TACIT_KNOWLEDGE',      -- Capture du savoir tacite
        'ANALYTICS_AGGREGATED', -- Métriques agrégées (Vérité #20)
        'LLM_EXTERNAL',         -- Envoi de données vers un LLM externe (cloud)
        'ONBOARDING_ORAL'       -- Mode oral (transcription voix)
    )),
    granted BOOLEAN NOT NULL,
    grantedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revokedAt TIMESTAMPTZ,
    ipAddress INET,
    userAgent TEXT,
    version INTEGER NOT NULL DEFAULT 1, -- version de la politique de consentement
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_consents_user ON user_consents(userId, companyId, consentType);
```

#### Mécanisme de retrait

Le retrait du consentement est effectif immédiatement :

1. `AI_PROCESSING` retiré : Les agents de l'utilisateur sont suspendus. Les workflows en cours sont mis en pause avec notification au manager.
2. `A2A_COMMUNICATION` retiré : Les requêtes inter-agents impliquant cet utilisateur sont bloquées (403).
3. `TACIT_KNOWLEDGE` retiré : Le savoir tacite déjà capturé reste (base légale : intérêt légitime de l'entreprise), mais aucune nouvelle capture n'est effectuée pour cet utilisateur.
4. `LLM_EXTERNAL` retiré : Les agents de l'utilisateur basculent sur le LLM on-premise/EU. Si aucun n'est configuré, les agents sont suspendus.

#### UI de gestion du consentement

Page accessible depuis le profil utilisateur. Pour chaque type de consentement :
- Description claire en langage non-technique de ce que le traitement implique
- Toggle on/off avec confirmation modale pour le retrait
- Historique des changements (date, action)
- Lien vers la politique de confidentialité correspondante

### 1.4 REQ-REG-05 — Privacy by Design

#### Chiffrement

| Couche | Mécanisme | Détail |
|--------|-----------|--------|
| **In transit** | TLS 1.3 | Obligatoire sur toutes les connexions HTTP et WebSocket. HSTS activé. |
| **At rest** | AES-256 | PostgreSQL avec chiffrement transparent du tablespace (pgcrypto ou chiffrement disque). Les secrets agents sont déjà chiffrés via les 4 providers (local, AWS, GCP, Vault). |
| **Credentials** | Credential proxy | Les clés API ne sont jamais stockées en clair dans les containers. Le proxy HTTP injecte les credentials à la volée sans les exposer aux agents (REQ-CONT-02). |

#### Pseudonymisation des données agrégées

Les dashboards management (REQ-OBS-03) affichent exclusivement des métriques agrégées. L'architecture EMPÊCHE techniquement l'accès aux données individuelles dans les vues agrégées :

```
AggregationService
├── computeMetrics(companyId, period) → Métriques agrégées par équipe/projet
│   ├── Minimum 5 contributeurs par agrégation (k-anonymity, k=5)
│   ├── Si <5 contributeurs → afficher "Données insuffisantes"
│   └── JAMAIS de drill-down vers l'individuel
├── pseudonymize(dataset)             → Remplacement des identifiants par des pseudonymes
└── validateKAnonymity(dataset, k=5)  → Vérification pré-affichage
```

#### Collecte minimale

- Seules les données strictement nécessaires au fonctionnement de chaque feature sont collectées
- Les logs de debug sont purgés après 30 jours
- Les sessions expirées sont supprimées après 90 jours
- Les containers éphémères sont détruits immédiatement après usage (`--rm`) — aucune persistance de données dans le container

---

## 2. Architecture Audit Trail

L'audit trail est le pilier central de la conformité enterprise de MnM. Il doit être immutable, performant, et exploitable.

### 2.1 REQ-AUDIT-01 — Table audit_events Immutable

#### Structure de la table

```sql
CREATE TABLE audit_events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    companyId UUID NOT NULL,
    actorType TEXT NOT NULL CHECK (actorType IN ('USER', 'AGENT', 'SYSTEM')),
    actorId TEXT NOT NULL,           -- userId ou agentId
    action TEXT NOT NULL,            -- ex: 'WORKFLOW_STARTED', 'ISSUE_UPDATED', 'AGENT_KILLED'
    category TEXT NOT NULL CHECK (category IN (
        'AUTH', 'RBAC', 'WORKFLOW', 'AGENT', 'A2A', 'AUDIT',
        'DATA', 'CONSENT', 'IMPORT', 'CONTAINER', 'SYSTEM'
    )),
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL')),
    resourceType TEXT,               -- 'issue', 'agent', 'workflow_instance', etc.
    resourceId TEXT,                 -- ID de la ressource affectée
    workflowInstanceId UUID,         -- si action dans un workflow
    stageInstanceId UUID,            -- si action dans une étape spécifique
    details JSONB NOT NULL DEFAULT '{}',  -- payload libre (avant/après, paramètres)
    ipAddress INET,
    userAgent TEXT,
    previousHash TEXT,               -- hash de l'événement précédent (chaîne)
    eventHash TEXT NOT NULL,          -- SHA-256 de cet événement
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id, createdAt)      -- clé composite pour le partitionnement
) PARTITION BY RANGE (createdAt);
```

#### Partitionnement mensuel

```sql
-- Création automatique des partitions (job cron mensuel)
CREATE TABLE audit_events_2026_03 PARTITION OF audit_events
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE audit_events_2026_04 PARTITION OF audit_events
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- Index sur les colonnes les plus fréquemment filtrées
CREATE INDEX idx_audit_company_date ON audit_events (companyId, createdAt DESC);
CREATE INDEX idx_audit_actor ON audit_events (actorId, createdAt DESC);
CREATE INDEX idx_audit_action ON audit_events (action, createdAt DESC);
CREATE INDEX idx_audit_category ON audit_events (category, createdAt DESC);
CREATE INDEX idx_audit_severity ON audit_events (severity) WHERE severity IN ('WARN', 'ERROR', 'CRITICAL');
CREATE INDEX idx_audit_workflow ON audit_events (workflowInstanceId) WHERE workflowInstanceId IS NOT NULL;
CREATE INDEX idx_audit_resource ON audit_events (resourceType, resourceId);
```

#### Immutabilité — TRIGGER deny UPDATE/DELETE

```sql
-- Empêcher toute modification ou suppression
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Les événements d''audit sont immutables. UPDATE et DELETE sont interdits sur audit_events.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
    BEFORE UPDATE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();

CREATE TRIGGER trg_audit_no_delete
    BEFORE DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();
```

**Note critique** : Le superuser PostgreSQL peut contourner les triggers. En production, le rôle applicatif (`mnm_app`) ne doit JAMAIS être superuser. Un rôle séparé `mnm_audit_admin` est créé pour les opérations de maintenance exceptionnelles (purge après rétention de 3 ans), avec double approbation requise.

#### Rétention 3 ans minimum

- Les partitions de plus de 3 ans sont archivées vers un stockage froid (S3/GCS/stockage on-premise) avant suppression de la partition active
- Un job cron mensuel vérifie les partitions éligibles à l'archivage
- L'archive est chiffrée (AES-256) et signée (HMAC-SHA256) pour garantir l'intégrité
- Les archives restent consultables via une API dédiée (`GET /api/v1/audit/archive`) avec latence acceptable (<5s)

### 2.2 REQ-AUDIT-02 — Non-Répudiation par Hash Chain

#### Mécanisme de chaînage cryptographique

Chaque événement d'audit est lié au précédent par un hash SHA-256, formant une chaîne immutable. Toute modification d'un événement passé brise la chaîne et est détectable.

```
AuditHashChainService
├── computeHash(event)      → SHA-256(companyId + actorId + action + details + previousHash + createdAt)
├── getLastHash(companyId)  → Récupère le hash du dernier événement de la company
├── verify(companyId, from, to) → Vérifie l'intégrité de la chaîne sur une période
└── alert(companyId, brokenAt) → Alerte si chaîne brisée
```

**Algorithme de hash** :

```
eventHash = SHA-256(
    companyId + '|' +
    actorType + '|' +
    actorId + '|' +
    action + '|' +
    JSON.stringify(details) + '|' +
    previousHash + '|' +
    createdAt.toISOString()
)
```

**Initialisation** : Le premier événement d'une company utilise `previousHash = SHA-256('GENESIS_' + companyId)`.

**Vérification** : Un job quotidien vérifie l'intégrité de la chaîne des dernières 24h pour chaque company. Un job hebdomadaire vérifie la chaîne complète. Toute rupture déclenche une alerte CRITICAL.

**Concurrence** : Pour éviter les conflits de hash en cas d'événements simultanés, un lock advisory PostgreSQL par company est utilisé lors de l'insertion. Cela sérialise les insertions par company sans impacter les autres tenants.

```sql
-- Lock advisory par company pour sérialiser les insertions
SELECT pg_advisory_xact_lock(hashtext(companyId::text));
```

### 2.3 REQ-AUDIT-03 — Interface Read-Only de Consultation

#### API de consultation

```
GET /api/v1/audit/events
    ?companyId=<uuid>
    &actorId=<text>          -- filtre par acteur
    &actorType=USER|AGENT|SYSTEM
    &action=<text>           -- filtre par action
    &category=<text>         -- AUTH, RBAC, WORKFLOW, etc.
    &severity=WARN,ERROR,CRITICAL  -- filtre multi-valeurs
    &resourceType=<text>     -- issue, agent, workflow_instance
    &resourceId=<text>
    &workflowInstanceId=<uuid>
    &from=<iso-datetime>     -- période début
    &to=<iso-datetime>       -- période fin
    &page=<int>              -- pagination
    &limit=<int>             -- max 100
    &sort=createdAt:desc     -- tri
```

**Permissions requises** : Seuls les utilisateurs avec le rôle `ADMIN` ou la permission `AUDIT_READ` peuvent consulter l'audit log. Les `MANAGER` voient uniquement les événements de leur scope (projets assignés). Les `CONTRIBUTOR` et `VIEWER` n'ont aucun accès à l'audit log.

#### Export

- `GET /api/v1/audit/export?format=csv|json` avec les mêmes filtres
- Export asynchrone pour les gros volumes (>10 000 événements) : le serveur génère le fichier et notifie l'utilisateur quand il est prêt
- Les exports sont eux-mêmes loggés dans l'audit (action `AUDIT_EXPORTED`)

#### Performance

- Le partitionnement mensuel permet de limiter les scans aux partitions pertinentes
- Les index composites couvrent les patterns de requête les plus fréquents
- Pagination obligatoire (max 100 résultats par page)
- Cache de 30s sur les requêtes identiques (invalidé sur nouvel événement)

---

## 3. Data Residency

### 3.1 REQ-RESID-01 — On-Premise Complet & Choix Région SaaS

#### Architecture de déploiement

MnM supporte trois modes de déploiement, chacun avec des garanties de résidence des données :

| Mode | Résidence données | Cible |
|------|------------------|-------|
| **On-Premise** | 100% chez le client, zero data exfiltration | Secteurs réglementés (banque, santé, défense) |
| **SaaS EU** | Hébergé en EU (France/Allemagne), données dans la région choisie | Entreprises EU standard |
| **SaaS Multi-Région** | Choix de la région par le client (EU, US, APAC) | Entreprises internationales |

#### Zero Data Exfiltration (On-Premise)

En mode on-premise, l'architecture garantit qu'AUCUNE donnée ne quitte l'infrastructure du client :

1. **Pas de télémétrie** : Toutes les métriques d'usage sont désactivées. Pas de phone-home, pas de check de licence vers un serveur externe.
2. **LLM local** : Le provider LLM est configuré pour utiliser un modèle hébergé localement (Ollama, vLLM, ou API compatible OpenAI locale).
3. **Mises à jour offline** : Les mises à jour sont distribuées sous forme de packages signés (air-gapped deployment).
4. **DNS/NTP seuls** : Les seules connexions réseau sortantes autorisées sont DNS et NTP.
5. **Audit de conformité** : Un rapport de conformité réseau est générable à la demande, listant toutes les connexions sortantes tentées (et bloquées).

#### Configuration par Company

```sql
-- Extension de la table companies pour la résidence
ALTER TABLE companies ADD COLUMN dataRegion TEXT DEFAULT 'EU_WEST'
    CHECK (dataRegion IN ('EU_WEST', 'EU_CENTRAL', 'US_EAST', 'US_WEST', 'APAC', 'ON_PREMISE'));
ALTER TABLE companies ADD COLUMN llmProvider TEXT DEFAULT 'OPENAI'
    CHECK (llmProvider IN ('OPENAI', 'ANTHROPIC', 'AZURE_OPENAI', 'OLLAMA', 'VLLM', 'CUSTOM'));
ALTER TABLE companies ADD COLUMN llmEndpoint TEXT; -- URL du endpoint LLM (pour custom/on-premise)
ALTER TABLE companies ADD COLUMN llmRegion TEXT;   -- Région du LLM (pour cloud providers)
```

### 3.2 REQ-RESID-02 — Support LLM EU/On-Premise

#### Abstraction du provider LLM

L'architecture existante de MnM utilise déjà un adapter pattern avec 8 types d'adapters. L'abstraction du provider LLM s'inscrit naturellement dans ce pattern :

```
LLMProviderAbstraction
├── LLMProvider (interface)
│   ├── chat(messages, options) → CompletionResponse
│   ├── stream(messages, options) → AsyncIterable<Chunk>
│   └── healthCheck() → ProviderStatus
├── OpenAIProvider (implements LLMProvider)
├── AnthropicProvider (implements LLMProvider)
├── AzureOpenAIProvider (implements LLMProvider)
├── OllamaProvider (implements LLMProvider) -- on-premise
├── VLLMProvider (implements LLMProvider)   -- on-premise
└── CustomProvider (implements LLMProvider) -- endpoint configurable
```

#### Routing par Company

Quand un agent est lancé, le système résout le provider LLM à utiliser selon la configuration de la company :

```
resolveProvider(companyId) {
    company = getCompany(companyId)

    // Vérifier le consentement LLM_EXTERNAL si provider cloud
    if (company.llmProvider in ['OPENAI', 'ANTHROPIC', 'AZURE_OPENAI']) {
        if (!hasConsent(agent.userId, 'LLM_EXTERNAL')) {
            // Fallback vers on-premise ou erreur
            return fallbackToOnPremise(company) || throw ConsentRequired
        }
    }

    // Vérifier la cohérence résidence/provider
    if (company.dataRegion === 'ON_PREMISE' && isCloudProvider(company.llmProvider)) {
        throw DataResidencyViolation('On-premise company cannot use cloud LLM provider')
    }

    return createProvider(company.llmProvider, {
        endpoint: company.llmEndpoint,
        region: company.llmRegion
    })
}
```

**Contrainte architecturale** : En mode `ON_PREMISE`, le système REFUSE de démarrer si le `llmProvider` est configuré sur un provider cloud. Ce contrôle est effectué au boot et à chaque changement de configuration.

---

## 4. AI Act Compliance

### 4.1 REQ-IA-01 — Pas de Décision Exclusivement Automatique

#### Le curseur d'automatisation comme garantie architecturale

L'architecture du curseur d'automatisation (REQ-DUAL-01 à 04) garantit structurellement la conformité avec l'Article 22 du RGPD et l'AI Act :

```
Positions du curseur :
├── MANUEL    → L'humain fait tout, l'agent observe et suggère
├── ASSISTE   → L'agent propose, l'humain valide avant exécution
└── AUTOMATIQUE → L'agent exécute, l'humain est notifié et peut intervenir
```

**Garantie architecturale** : Même en mode AUTOMATIQUE, le human-in-the-loop n'est jamais supprimé. L'humain :
1. Est NOTIFIE de chaque action (temps réel via WebSocket)
2. Peut INTERROMPRE à tout moment (commande "Stop" → arrêt immédiat + rollback)
3. Peut CONTESTER toute décision post-facto (interface de review avec explication)
4. Conserve le CONTROLE via le curseur (peut réduire le niveau d'automatisation à tout moment)

**Plafond hiérarchique** : Le CEO/CTO peut imposer un plafond qui empêche tout utilisateur de passer en mode AUTOMATIQUE pour certaines catégories de tâches. Ce plafond est un invariant de l'architecture (INV-05).

#### Explicabilité des décisions

Pour chaque action d'un agent, MnM fournit trois niveaux d'explicabilité :

| Niveau | Contenu | Audience |
|--------|---------|----------|
| **Résumé LLM** | Explication en langage naturel de ce que l'agent a fait et pourquoi | Tous les utilisateurs |
| **Audit trail** | Trace technique complète : prompt envoyé, réponse LLM, action exécutée, résultat | Admin, CTO |
| **Replay** | Capacité à rejouer exactement les mêmes conditions pour reproduire le comportement | Debug, investigation |

### 4.2 REQ-IA-02 — Classification des Agents par Niveau de Risque

#### Table de classification

L'AI Act européen (entré en vigueur en 2024) impose une classification des systèmes IA par niveau de risque. MnM classe ses agents selon cette taxonomie :

```sql
CREATE TABLE agent_risk_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companyId UUID NOT NULL REFERENCES companies(id),
    agentRole TEXT NOT NULL, -- rôle de l'agent (ex: 'code_executor', 'brainstorm', 'reporting')
    riskLevel TEXT NOT NULL CHECK (riskLevel IN (
        'MINIMAL',     -- Agent de reporting, résumé (lecture seule)
        'LIMITED',     -- Agent de brainstorm, suggestion (pas d'exécution)
        'HIGH',        -- Agent d'exécution de code, modification de données
        'UNACCEPTABLE' -- Jamais utilisé dans MnM (scoring social, surveillance, etc.)
    )),
    obligations JSONB NOT NULL DEFAULT '{}',
    -- Obligations proportionnelles au niveau de risque :
    -- MINIMAL: log basique
    -- LIMITED: log + explicabilité
    -- HIGH: log + explicabilité + validation humaine obligatoire + audit renforcé
    maxAutomationLevel TEXT NOT NULL DEFAULT 'MANUAL' CHECK (maxAutomationLevel IN ('MANUAL', 'ASSISTED', 'AUTOMATIC')),
    requiresHumanValidation BOOLEAN NOT NULL DEFAULT true,
    requiresExplainability BOOLEAN NOT NULL DEFAULT true,
    requiresAuditReinforced BOOLEAN NOT NULL DEFAULT false,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Mapping des types d'agents MnM vers les niveaux de risque

| Type d'agent | Niveau de risque | Justification | Obligations |
|-------------|-----------------|---------------|-------------|
| Agent de reporting | MINIMAL | Lecture seule, agrégation | Log basique |
| Agent de brainstorm | LIMITED | Suggestions sans exécution | Log + explicabilité |
| Agent d'onboarding | LIMITED | Guide conversationnel, pas de mutation | Log + explicabilité |
| Agent connecteur | LIMITED | Interactions systèmes externes (lecture) | Log + explicabilité |
| Agent inter-rôle (A2A) | HIGH | Proxy entre agents, potentiel d'action transverse | Log + explicabilité + validation humaine + audit renforcé |
| Agent d'exécution | HIGH | Modification de code, données, infrastructure | Log + explicabilité + validation humaine + audit renforcé |

**Règle architecturale** : Un agent classé HIGH ne peut JAMAIS fonctionner en mode AUTOMATIQUE sans que la company ait explicitement configuré et accepté ce niveau. Par défaut, les agents HIGH sont en mode ASSISTE maximum.

#### Obligations proportionnelles

```
RiskComplianceEnforcer
├── classify(agent)           → Détermine le niveau de risque basé sur le rôle et les capacités
├── enforce(agent, action)    → Vérifie que l'action respecte les obligations du niveau
│   ├── MINIMAL  → logAction()
│   ├── LIMITED  → logAction() + generateExplanation()
│   └── HIGH     → logAction() + generateExplanation() + requireHumanApproval() + auditReinforced()
└── report(companyId)         → Rapport de conformité AI Act par company
```

---

## 5. Contraintes Business sur l'Architecture

### 5.1 Métriques Agrégées Uniquement (Vérité #20)

> *"Les dashboard management ne montrent JAMAIS de données individuelles. Pas de flicage."*

Cette vérité fondatrice des cofondateurs impose une contrainte architecturale forte : le système doit EMPÊCHER techniquement le drill-down individuel, pas simplement le masquer dans l'UI.

#### Architecture d'empêchement

1. **Service d'agrégation dédié** : Les dashboards management passent par un `AggregationService` qui ne retourne JAMAIS de données brutes individuelles. Il n'existe aucune API de dashboard qui accepte un `userId` en paramètre de filtre.

2. **K-anonymity (k=5)** : Toute agrégation portant sur moins de 5 contributeurs distincts est remplacée par "Données insuffisantes". Cela empêche la déduction par élimination.

3. **Separation of concerns dans les APIs** :
   - `/api/v1/dashboard/team/*` — Métriques agrégées par équipe/projet. Jamais de userId dans la réponse.
   - `/api/v1/dashboard/personal/*` — Métriques personnelles visibles uniquement par l'utilisateur lui-même.
   - Il n'existe PAS de `/api/v1/dashboard/user/:userId` pour les managers.

4. **PostgreSQL Views** : Les vues matérialisées pour les dashboards management sont construites avec `GROUP BY` obligatoire sur `projectId` ou `teamId`. Aucune vue ne permet un `GROUP BY userId` accessible aux managers.

```sql
-- Vue matérialisée pour le dashboard management (exemple)
CREATE MATERIALIZED VIEW mv_team_productivity AS
SELECT
    wi.companyId,
    p.id AS projectId,
    p.name AS projectName,
    DATE_TRUNC('week', wi.completedAt) AS week,
    COUNT(DISTINCT wi.id) AS workflowsCompleted,
    AVG(EXTRACT(EPOCH FROM (wi.completedAt - wi.startedAt))) AS avgDurationSeconds,
    COUNT(DISTINCT CASE WHEN drift.id IS NOT NULL THEN wi.id END) AS workflowsWithDrift
FROM workflow_instances wi
JOIN projects p ON wi.projectId = p.id
LEFT JOIN audit_events drift ON drift.workflowInstanceId = wi.id AND drift.action = 'DRIFT_DETECTED'
WHERE wi.status = 'COMPLETED'
GROUP BY wi.companyId, p.id, p.name, DATE_TRUNC('week', wi.completedAt)
HAVING COUNT(DISTINCT wi.assigneeId) >= 5;  -- k-anonymity
```

### 5.2 Elevation, pas Remplacement

> *"L'automatisation est présentée comme une élévation du rôle (de producteur à validateur), jamais comme un remplacement."*

#### Contrainte sur le curseur d'automatisation

L'architecture du curseur rend le remplacement structurellement impossible :

1. **Pas de position "Full Auto sans humain"** : Le curseur a 3 positions (Manuel, Assisté, Automatique), mais même en AUTOMATIQUE, l'humain reste dans la boucle (notifié, peut intervenir, peut contester). Il n'existe PAS de position "Autonomous" où l'humain serait exclu.

2. **Rôle minimum requis** : Pour qu'un workflow s'exécute, il DOIT y avoir un `assigneeUserId` humain associé. Un agent ne peut pas exécuter un workflow sans propriétaire humain. Si le propriétaire humain est supprimé (départ), le workflow est suspendu jusqu'à réassignation.

3. **Metrics de valeur** : Le dashboard personnel montre la VALEUR AJOUTEE par l'automatisation (temps économisé, qualité améliorée), pas la quantité de travail remplacée. Le vocabulaire dans l'UI utilise systématiquement "assisté par", "augmenté par", jamais "remplacé par".

### 5.3 Open Source Compatible — Separation Core OSS / Features Enterprise

#### Architecture de séparation

La séparation entre le core open source et les features enterprise est architecturale, pas juste un toggle :

```
mnm/
├── packages/
│   ├── core/              -- OSS : orchestrateur, workflows, observabilité basique
│   │   ├── workflow-engine/
│   │   ├── agent-runtime/
│   │   ├── basic-audit/    -- activity_log (audit basique)
│   │   └── permissions/    -- RBAC basique (admin/member)
│   ├── enterprise/        -- Licence enterprise uniquement
│   │   ├── audit-chain/    -- Hash chain, rétention 3 ans, export
│   │   ├── sso/           -- SAML/OIDC
│   │   ├── compliance/    -- RGPD (effacement, portabilité, consentement)
│   │   ├── data-residency/ -- Multi-région, on-premise config
│   │   ├── advanced-rbac/  -- Scoping projet, 15 permission keys
│   │   └── ai-act/        -- Classification risque, rapport conformité
│   └── shared/            -- Types partagés, utilitaires
```

**Règle de dépendance** : `core` ne dépend JAMAIS de `enterprise`. `enterprise` dépend de `core` et étend ses interfaces via des plugins/hooks. Le core fonctionne de manière autonome sans le package enterprise.

**Feature detection** : Au runtime, le système détecte la présence du package `enterprise` et active les features correspondantes. Sans le package, le système fonctionne en mode OSS avec des fallbacks gracieux :
- Pas de hash chain → audit basique sans chaînage
- Pas de SSO → auth email/password uniquement
- Pas de compliance → pas de gestion de consentement granulaire
- Pas de data residency → déploiement single-region par défaut

---

## Synthèse — Matrice de Traçabilité Compliance

| Requirement PRD | Section Architecture | Priorité | Statut |
|----------------|---------------------|----------|--------|
| REQ-REG-02 (Effacement) | 1.1 — UserDeletionService | P1 | Architecturé |
| REQ-REG-03 (Portabilité) | 1.2 — DataPortabilityService | P2 | Architecturé |
| REQ-REG-04 (Consentement) | 1.3 — user_consents + mécanisme retrait | P1 | Architecturé |
| REQ-REG-05 (Privacy by Design) | 1.4 — Chiffrement, pseudonymisation, collecte minimale | P1 | Architecturé |
| REQ-AUDIT-01 (Log immutable) | 2.1 — audit_events partitionnée + TRIGGER deny | P1 | Architecturé |
| REQ-AUDIT-02 (Hash chain) | 2.2 — SHA-256 chaînage + vérification | P2 | Architecturé |
| REQ-AUDIT-03 (Interface read-only) | 2.3 — API consultation + export | P1 | Architecturé |
| REQ-RESID-01 (On-premise + région) | 3.1 — 3 modes déploiement, zero exfiltration | P1 | Architecturé |
| REQ-RESID-02 (LLM EU/on-premise) | 3.2 — Abstraction provider, routing par company | P2 | Architecturé |
| REQ-IA-01 (Pas de décision auto) | 4.1 — Curseur + human-in-the-loop | P1 | Architecturé |
| REQ-IA-02 (Classification risque) | 4.2 — agent_risk_classifications + obligations | P2 | Architecturé |
| C-01 (Métriques agrégées) | 5.1 — AggregationService + k-anonymity | P1 | Architecturé |
| C-02 (Élévation, pas remplacement) | 5.2 — Contrainte curseur + assigneeUserId requis | P0 | Architecturé |

---

*~2400 mots — Architecture compliance complète : RGPD (4 requirements), Audit Trail (3 requirements), Data Residency (2 requirements), AI Act (2 requirements), Contraintes Business (3 contraintes).*
