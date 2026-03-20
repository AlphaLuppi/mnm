# MnM B2B — Features restantes

**Date :** 16 mars 2026
**Contexte :** 69/69 stories implementees. Ce document liste ce qui manque pour atteindre la vision complete.

---

## Priorite 1 — Bloquant pour demo CBA / premier client

### 1. Validation d'integration end-to-end
**Quoi :** Les 69 stories sont codees individuellement. Il faut verifier que tout fonctionne ensemble sur une vraie instance.
**Pourquoi :** 194k lignes de code ajoutees par pipeline automatise. Des bugs d'integration sont quasi-certains.
**Actions :**
- [ ] Deploy sur une instance de test complete (Docker Compose prod)
- [ ] Run des 70 tests Playwright sur l'instance reelle
- [ ] Fix des bugs d'integration decouverts
- [ ] Smoke test manuel des 8 scenarios demo CBA

### 2. Import Jira intelligent
**Quoi :** ONB-S03 fait un import basique (API Jira -> tables MnM). Il manque le mapping semantique.
**Pourquoi :** Verite #43 — "L'import/mapping initial est le moment critique d'adoption B2B". Si c'est pas fluide, c'est mort.
**Actions :**
- [ ] Mapping intelligent des workflows Jira -> workflows MnM
- [ ] Detection auto des roles depuis les permissions Jira
- [ ] Preview avant import (dry-run)
- [ ] Gestion des conflits et doublons
- [ ] Support Linear et ClickUp (au minimum Linear)

### 3. Experience "conduire l'agent" en live
**Quoi :** CHAT-S03/S04 permettent de parler a un agent. Mais l'UX de "pilotage en temps reel" n'est pas fluide.
**Pourquoi :** Verite #38 — L'agent doit etre "conduisible", pas juste "lancable". C'est l'experience qui vend MnM aux devs.
**Actions :**
- [ ] Split view code + chat avec scroll synchro
- [ ] Boutons d'action rapide : pause, stop, redirect, inject context
- [ ] Indicateur visuel de ce que l'agent fait en ce moment (fichier en cours, tool call)
- [ ] Historique navigable des actions de l'agent

---

## Priorite 2 — Differenciateurs enterprise (vente CTO/DSI)

### 4. Distributed tracing (style Langfuse)
**Quoi :** OBS-S03 fait du resume LLM. Il manque le vrai tracing distribue sur toute la chaine.
**Pourquoi :** Verite #39 — L'observabilite simplifiee est un prerequis de confiance. Le CTO veut voir la trace complete d'une execution.
**Actions :**
- [ ] Integration OpenTelemetry ou Langfuse
- [ ] Trace viewer UI (timeline des appels, durees, couts)
- [ ] Correlation trace <-> audit event <-> drift report
- [ ] Alertes configurables (seuils de cout, duree, erreurs)

### 5. Drift auto-remediation
**Quoi :** Le drift est detecte (DRIFT-S02) et affiche (DRIFT-S03). Mais la remediation est manuelle.
**Pourquoi :** Verite #54 — "Votre agent a devie du workflow a l'etape 3" + action automatique = le monitoring d'uptime pour agents.
**Actions :**
- [ ] Connecter drift detector -> compaction kill+relance
- [ ] Politiques de remediation configurables (ignore / warn / auto-fix / escalate)
- [ ] Notifications push au manager quand remediation auto executee
- [ ] Dashboard des drifts avec tendances (quel agent drift le plus, quelle etape)

### 6. Connecteurs auto-generes
**Quoi :** A2A-S04 fait des connecteurs MCP statiques. La vision = "donne le code source d'un outil, un agent cree le connecteur".
**Pourquoi :** Verite #51 — L'extensibilite n'est pas un catalogue de plugins, c'est une capacite native.
**Actions :**
- [ ] Agent specialise "connector builder" qui analyse une API/codebase
- [ ] Generation automatique de MCP server adapte
- [ ] Registry de connecteurs partageable entre companies
- [ ] Versionning et rollback des connecteurs

---

## Priorite 3 — Vision long terme

### 7. MnM modifiable de l'interieur
**Quoi :** La personne responsable de MnM peut utiliser des agents MnM pour modifier MnM lui-meme.
**Verite #52.** Meta mais puissant pour l'adaptabilite.

### 8. Brainstorm comme point d'entree de la chaine
**Quoi :** Aujourd'hui le workflow commence par une story/issue. La vision = brainstorm humain -> output structure -> agents -> prod.
**Verite #31.** C'est le "pourquoi" de MnM.

### 9. Agents comme proxys de communication
**Quoi :** L'agent du dev query directement l'agent du PO pour le contexte d'une story. Communication machine-to-machine, humain en superviseur.
**WhatIf #1.** Supprime la perte d'info aux handoffs.

### 10. L'IA qui brainstorme seule
**Quoi :** MnM detecte problemes, brainstorme solutions, simule impact, propose au CEO un top 3. L'humain = go/no-go.
**Verite #33.** C'est le end-game : l'entreprise autonome.

---

## Matrice de couverture par noyau

| Noyau | Fait (69 stories) | Manque (P1-P2) | Vision (P3) |
|-------|-------------------|----------------|-------------|
| **A. Orchestrateur** | State machine, enforcer, HITL, API, UI editor | Drift auto-remediation (#5) | IA qui brainstorme seule (#10) |
| **B. Observabilite** | Audit immutable, emitter, UI, resume LLM | Distributed tracing (#4), alertes | — |
| **C. Onboarding** | Wizard CEO, cascade, import Jira basique, dual-mode | Import intelligent (#2) | Brainstorm comme entree (#8) |
| **D. A2A + Permissions** | Bus, permissions, audit, connecteurs MCP | Connecteurs auto-generes (#6) | Agents proxys (#9), MnM self-modify (#7) |
| **E. Dual-Speed** | Curseurs, UI, enforcement | Experience pilotage live (#3) | — |
| **Transverse** | — | Validation integration E2E (#1) | — |

---

## Estimation effort

| Priorite | Items | Effort estime |
|----------|-------|---------------|
| **P1** | 3 items | 2-3 semaines |
| **P2** | 3 items | 3-4 semaines |
| **P3** | 4 items | Long terme (iteratif) |

**Prochaine action concrete :** Deployer l'instance de test, fixer les bugs d'integration, et pitcher le CTO de CBA (verite #57).
