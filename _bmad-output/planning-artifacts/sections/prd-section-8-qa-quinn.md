# PRD Section 8 — Scénarios de Test, Edge Cases & Sécurité

*Par Quinn le QA 🧪* | Task #7 | 2026-03-13

---

## 1. Scénarios de Test par FR (35 scénarios Given/When/Then)

### FR-MU : Multi-User et Auth (5 scénarios)
- **SC-MU-01** [P0] : Invitation d'un membre (happy path)
- **SC-MU-02** [P0] : Acceptation d'invitation
- **SC-MU-03** [P1] : Invitation expirée
- **SC-MU-04** [P0] : Désactivation du signup libre
- **SC-MU-05** [P1] : Sign-out et invalidation de session

### FR-RBAC : Roles et Permissions (5 scénarios)
- **SC-RBAC-01** [P0] : Attribution de rôle par admin
- **SC-RBAC-02** [P0] : Vérification permission sur route protégée (403)
- **SC-RBAC-03** [P1] : Presets de permissions par rôle
- **SC-RBAC-04** [P1] : Masquage navigation selon permissions (absent du DOM)
- **SC-RBAC-05** [P2] : Rôle composite avec héritage

### FR-ORCH : Orchestrateur Déterministe (5 scénarios)
- **SC-ORCH-01** [P0] : Exécution step-by-step (agent ne peut pas sauter)
- **SC-ORCH-02** [P0] : Drift detection et alerte (<15min)
- **SC-ORCH-03** [P0] : Réinjection post-compaction
- **SC-ORCH-04** [P1] : Kill+relance après compaction
- **SC-ORCH-05** [P0] : Validation humaine (human-in-the-loop)

### FR-OBS : Observabilité (4 scénarios)
- **SC-OBS-01** [P1] : Résumé LLM temps réel (<5s)
- **SC-OBS-02** [P0] : Audit log complet (qui/quoi/quand/workflow/étape)
- **SC-OBS-03** [P1] : Dashboards agrégés (jamais individuels — vérité #20)
- **SC-OBS-04** [P1] : Traçabilité des décisions

### FR-ONB : Onboarding (4 scénarios)
- **SC-ONB-01** [P0] : Onboarding CEO conversationnel
- **SC-ONB-02** [P0] : Cascade hiérarchique
- **SC-ONB-03** [P1] : Import Jira intelligent
- **SC-ONB-04** [P1] : Dual-mode configuration

### FR-A2A : Agent-to-Agent (3 scénarios)
- **SC-A2A-01** [P0] : Query inter-agents avec validation humaine
- **SC-A2A-02** [P2] : Génération de connecteur
- **SC-A2A-03** [P1] : Permissions granulaires inter-agents

### FR-DUAL : Dual-Speed (4 scénarios)
- **SC-DUAL-01** [P0] : Curseur d'automatisation personnel
- **SC-DUAL-02** [P0] : Plafond hiérarchique (CEO > Dev)
- **SC-DUAL-03** [P1] : Brainstorm comme point d'entrée
- **SC-DUAL-04** [P1] : Distinction mécanique vs jugement

### FR-CHAT : Chat Temps Réel (4 scénarios)
- **SC-CHAT-01** [P0] : Dialogue pendant exécution via WebSocket
- **SC-CHAT-02** [P1] : Reconnexion WebSocket (sync messages manqués)
- **SC-CHAT-03** [P1] : Chat read-only pour viewer
- **SC-CHAT-04** [P1] : Message après fin d'exécution (rejeté)

### FR-CONT : Containerisation (4 scénarios)
- **SC-CONT-01** [P0] : Container éphémère --rm avec profil
- **SC-CONT-02** [P0] : Credential proxy (injection sans exposition)
- **SC-CONT-03** [P0] : Isolation entre containers
- **SC-CONT-04** [P1] : Timeout avec reset sur output

---

## 2. Edge Cases Critiques (28 cas)

### FR-MU (6 edge cases)
- EC-MU-01 : Invitation expirée puis renvoi
- EC-MU-02 : User déjà membre ré-invité
- EC-MU-03 : Email invalide à l'invitation
- EC-MU-04 : Invitation pendant maintenance
- EC-MU-05 : 2 admins invitent le même email (race condition)
- EC-MU-06 : Suppression compte avec agents actifs

### FR-RBAC (5 edge cases)
- EC-RBAC-01 : Changement de rôle pendant session active
- EC-RBAC-02 : Dernier admin se rétrograde (bloqué)
- EC-RBAC-03 : Permissions conflictuelles (deny > allow)
- EC-RBAC-04 : Rôle supprimé avec membres assignés
- EC-RBAC-05 : Scope JSONB malformée (validation stricte)

### FR-ORCH (5 edge cases)
- EC-ORCH-01 : Compaction pendant étape critique (sauvegarde atomique)
- EC-ORCH-02 : Agent crash mid-workflow (heartbeat <30s)
- EC-ORCH-03 : Workflow modifié pendant exécution (version isolée)
- EC-ORCH-04 : Étape sans fichiers obligatoires (refus)
- EC-ORCH-05 : Boucle infinie dans workflow (détection cycle + watchdog)

### FR-CHAT (5 edge cases)
- EC-CHAT-01 : Message après fin d'exécution (rejeté avec code erreur)
- EC-CHAT-02 : Reconnexion avec messages en vol (buffer 30s)
- EC-CHAT-03 : Flood de messages (rate limit 10/min)
- EC-CHAT-04 : Message >100KB (troncature)
- EC-CHAT-05 : Caractères spéciaux/XSS (UTF-8 strict, sanitization)

### FR-CONT (6 edge cases)
- EC-CONT-01 : Container timeout (SIGTERM puis SIGKILL 10s)
- EC-CONT-02 : OOM kill (code 137, reprofile)
- EC-CONT-03 : Path traversal via mount allowlist (realpath + symlinks interdits)
- EC-CONT-04 : Credential proxy down (503, retry, suspend après 3 échecs)
- EC-CONT-05 : Docker daemon indisponible (mode dégradé)
- EC-CONT-06 : Épuisement ressources Docker (limite par company, file d'attente)

---

## 3. Security Testing Requirements (12 catégories)

### RBAC Bypass
- **ST-SEC-01** [P0] : Escalade horizontale (manipulation X-Company-Id, IDs URLs)
- **ST-SEC-02** [P0] : Escalade verticale (endpoints admin avec token viewer)
- **ST-SEC-03** [P0] : Contournement scope (injection SQL via JSONB)

### Container Security
- **ST-SEC-04** [P0] : Container escape (mount /etc/shadow, capabilities, --read-only)
- **ST-SEC-05** [P0] : Credential proxy tampering (accès externe, replay, headers)
- **ST-SEC-06** [P0] : Path traversal (paths relatifs, symlinks, encodage URL, null bytes)

### Input Validation
- **ST-SEC-07** [P1] : XSS via chat (script, SVG, event handlers, markdown)
- **ST-SEC-08** [P1] : CSRF (tokens, Origin/Referer, SameSite=Strict)
- **ST-SEC-09** [P0] : SQL injection via scope JSONB

### Auth & Session
- **ST-SEC-10** [P1] : Session hijacking (expiration, fixation, invalidation)
- **ST-SEC-11** [P1] : Brute force (rate limit login 5/min, invitations 20/h)

### Multi-Tenant
- **ST-SEC-12** [P0] : Isolation inter-company (RLS, API, containers, cache)

---

## 4. Stratégie de Régression (4 suites + 7 smoke tests)

### Suites par Phase
- **Phase 1 (Multi-User)** : Workflows mono-user, agents, WebSocket, secrets
- **Phase 2 (RBAC)** : Admin a toutes les permissions, routes fonctionnent, frontend
- **Phase 3 (Scoping)** : Sans scope = tout visible, agents non orphelins
- **Phase 4 (Enterprise)** : SSO + email+password, audit performance, rate limit

### Métriques de Couverture
| Couche | Objectif |
|--------|----------|
| RBAC (hasPermission, canUser) | >95% |
| ContainerManager | >90% |
| Credential proxy | >95% |
| Routes API (auth checks) | 100% |

### Smoke Tests Pré-Deploy (7 tests obligatoires)
1. Login/signup/sign-out
2. Création agent + lancement workflow
3. Chat WebSocket connecte/envoie/reçoit
4. RBAC : viewer ne peut PAS créer agent
5. Container : lancement/exécution/arrêt
6. Credential proxy : valide passe / invalide échoue
7. Aucune donnée cross-company visible

---

*35 scénarios, 28 edge cases, 12 catégories sécurité, 4 suites régression, 7 smoke tests.*
