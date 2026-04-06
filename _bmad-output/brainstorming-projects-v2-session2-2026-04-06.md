# Brainstorming Projects v2 — Session 2 : Vision Tom (2026-04-06)

## Raw Vision Capture

### 1. Le Chat comme interface primaire des PM

Le PM travaille principalement dans un **chat collaboratif avec l'IA** :
- Brainstorm et itération sur des sujets : produits, features, analyse utilisateurs, cahiers des charges
- Génération de prototypes pour tester des idées
- Potentiellement **déploiement de prototypes** pour tests utilisateurs
- Collaboration avec d'autres rôles : PD/UX pour l'UI, archi pour le tech, market, data engineers

**Deux modes de contexte :**
- **Sans accès codebase** — pour ne pas polluer/influencer le brainstorm avec le legacy
- **Avec accès codebase** (via GitNexus MCP) — pour comprendre les impacts d'implémentation

**Le Handoff :** Quand le brainstorm est satisfaisant → phase de "handoff validation" = packager les résultats pour les équipes de production (QA/dev/infra).

**Le package handoff peut contenir :**
- Une branche sur le repo avec des fichiers .md décrivant tout
- Un prototype live déployé et testé par les users
- Un PRD
- Des recos UX
- Un fichier epic.md si poussé jusqu'là
- Juste une issue MnM si c'est petit
- Des références vers les fichiers du brainstorm (cahier de recette, cahier des charges, études users, sources, stats, chiffres)

**Principe clé :** La transition brainstorm → réalisation tech doit être la plus fluide possible, avec le moins de perte d'info, orchestrée par des agents.

### 2. Feature-centric, pas Epic/Story-centric

- Au niveau produit : **liste de toutes les features**, construite et alimentée en live au fur et à mesure
- Chaque feature est **mappée sur le code source ET sur les tests E2E**
- Chaque feature peut avoir son propre niveau de granularité, ses propres cahiers des charges/tests
- **S'extraire du système epic/user story** — voir le produit comme un ensemble de fonctionnalités
- Les cahiers des charges et tests E2E **garantissent la conformité**
- Aide les PM à ne pas avoir peur de **remove/trash** des features non primordiales
- Les features sont des entités vivantes, pas des tickets à fermer

### 3. Flexibilité > Spécificité

- MnM doit s'adapter à tout type de besoin et d'entreprise
- **Ne pas créer une usine à gaz spécifique à CBA** — Tom est biaisé par ce modèle
- Limiter les types d'entité spécifiques, rester propre aux features de MnM
- **Réutilisable** : AlphaLuppi construit MnM via MnM (startup ≠ même besoins que enterprise)
- La flexibilité vient des Blocks + des agents configurables, pas d'entités hardcodées

### 4. Dashboard composable MAIS traceability accessible

- Dashboard composable (Blocks) — PM/QA/Dev veulent des vues différentes
- La **traceability doit être facilement retrouvable et récupérable**
- Ce n'est pas un dashboard OU de la traceability — c'est les deux

### 5. Smart Change Impact — la spec ne "change" pas, elle évolue

**Le PM ne peut pas "changer" une spec partie en production.** Il part de son chat qui :
- Est branché sur le projet
- A la connaissance de l'état live
- Sait où en est la feature
- Le guide dans les impacts d'un changement

**3 scénarios selon l'état du handoff :**

| État | Comportement |
|------|-------------|
| **Handoff non commencé** (devs n'ont pas touché) | Pas de soucis, modification libre |
| **Handoff en cours** (devs ont créé des issues, commencé à travailler) | Pondérer avec les impacts : temps perdu, issues à modifier, synchro nécessaire avec les devs |
| **Feature terminée** (en prod) | Corréler anciennes specs, tests E2E, codebase actuelle, mesurer l'impact full |

**L'objectif de MnM :** Qu'un PM puisse mesurer tout ça le plus facilement possible **sans reverse-engineer le code et faire 10 réunions** avec Lead/Archi/QA.

---

## Insights extraits

### Insight A : Le Chat est le workspace du PM, pas le projet
Le PM ne vit pas dans la "vue projet" — il vit dans son **chat avec l'IA**. Le projet est la destination du handoff, pas l'outil de travail du PM. Le chat PEUT avoir le contexte du projet (via MCP), mais le PM doit pouvoir brainstormer librement sans.

### Insight B : Le Handoff est une première classe entity
Ce n'est pas "le PM crée des issues". C'est un **package structuré** qui transite du brainstorm vers la production. Il peut contenir N types d'artefacts. Les agents orchestrent la transition.

### Insight C : Feature Map > Backlog
Le produit n'est pas un backlog d'issues — c'est une **carte de fonctionnalités** vivante. Chaque feature = specs + code + tests + couverture. Les issues sont des tâches temporaires SOUS une feature, pas l'unité de base.

### Insight D : Context Toggle (avec/sans codebase)
Le PM doit pouvoir choisir : brainstormer en mode "green field" (sans legacy) OU en mode "impact analysis" (avec GitNexus). Ce toggle est crucial — parfois le legacy tue la créativité.

### Insight E : Change Impact = fonction de l'état du lifecycle
L'impact d'un changement dépend de où en est la feature. MnM doit calculer ça automatiquement et guider le PM.

### Insight F : Généricité absolue
Pas d'entités CBA-spécifiques. MnM doit marcher pour une startup de 3 (AlphaLuppi) comme pour une boîte réglementée de 500. La flexibilité vient des Blocks + agents configurables.

### Insight G : Chat partageable, pas multi-user
Le PM ne veut pas un Google Docs collaboratif. Il veut pouvoir **partager** son chat, que quelqu'un d'autre le référence, travaille dans son coin, et repartage ses résultats. C'est un modèle de **fork & merge de contexte**, pas de co-editing temps réel.

### Insight H : Pas de rôles figés
Ne pas enfermer dans PM → PD → Archi. Les rôles seront de plus en plus flous. N'importe qui peut ajouter des inputs. Les idées circulent entre les personnes qui savent et qui ont besoin du "goût" des autres.

### Insight I : Projet = Produit (multi-codebase)
Un projet = un produit complet. Exemple Agathe@CBA : app mobile + app web Angular + vieille app Struts. Un produit = ensemble de features réparties sur N codebases. Chaque codebase = un workspace avec son MCP GitNexus.

### Insight J : Prototype deployment = MVP scope (anti shadow IT)
Le déploiement de prototypes par les PM est dans le scope MVP. Raison : éviter la shadow IT — PMs qui vibecode sur Vercel/Netlify et font fuiter des infos. MnM = outil officiel pour prototyper ET déployer. L'orchestrateur + features MnM répondent aussi à l'élimination de la shadow IA. Équipe infra/SRE CBA aide sur cette partie.
