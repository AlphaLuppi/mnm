# Brainstorms à faire

## Access Logs — Retravailler le système existant

**Problème identifié (2026-04-17) :**
MnM a déjà un système d'access log mais il est probablement incomplet.

**Objectif :**
Tout logger, vraiment TOUT — toutes les actions users via MCP ET via UI.

**À brainstormer :**
- Auditer l'existant (quelles tables, quels events sont captés aujourd'hui ?)
- Identifier les trous (quelles actions ne sont pas logguées ?)
- Designer le schema universel (un `audit_events` unifié ? ou plusieurs tables dédiées ?)
- Performance (tout logger = beaucoup de writes, comment ça scale ?)
- Rétention (combien de temps on garde ? archivage ?)
- Queries d'usage (Sensei/CAO/Nightly Audit qui tape dedans)

**Prérequis pour ce brainstorm :**
- Mapping complet de l'audit existant dans le codebase
- Liste des actions MCP + UI à couvrir

---

## Sensei — Pédagogie et onboarding

**Contexte (2026-04-17) :**
Le Sensei doit connaître MnM "sur le bout des doigts" et aider Tom (consulting)
à onboarder les nouveaux clients. C'est l'agent "expert MnM" qui enseigne.

**Objectif :**
Designer comment le Sensei dialogue avec un client pour :
- Comprendre leurs use cases
- Proposer les bons workflows initiaux
- Enseigner les concepts MnM progressivement
- Accompagner la découverte des features

**À brainstormer :**
- Arbre de dialogue : quelles questions le Sensei pose en premier ?
- Scénarios d'onboarding par type de client (startup, enterprise, mid-market)
- Comment le Sensei accède à toute la doc MnM (RAG ? prompt injection ?)
- Comment il apprend des sessions d'onboarding passées
- Différenciation Sensei vs CAO vs Nightly Synthesis (3 rôles distincts)
- UX : le Sensei vit dans le chat MnM, dans un onboarding dédié, via MCP ?
- Scénarios "help me find the right workflow" en cours d'utilisation

**Prérequis :**
- Finir le brainstorm Governed Workflows (en cours)
- Avoir une vue claire du modèle de skills/agents MnM
