# Vision produit MnM

Bienvenue dans la documentation produit de **MnM — Make no Mistake**.

MnM est un cockpit de supervision B2B pour orchestrer des équipes complètes d'agents IA — dev, QA, PM, infra, compliance, direction — sans remplacer les outils que les développeurs aiment déjà. La conviction : les entreprises ne veulent pas substituer leurs équipes par des agents autonomes, elles veulent **augmenter leurs équipes avec des agents sous supervision**.

Ce dossier rassemble la vision consolidée, les fondations conceptuelles et la trajectoire produit. Si vous arrivez en contributeur open-source, commencez ici avant de plonger dans le code.

## Sommaire

| Document | Pour quoi |
|----------|-----------|
| [`vision.md`](./vision.md) | La vision produit consolidée — quoi, pourquoi, comment, pour qui, différenciateurs et trajectoire haut niveau. À lire en premier. |
| [`three-pillars.md`](./three-pillars.md) | Les trois piliers fondamentaux (Confiance, Contrôle, Transparence) et les features concrètes qui les incarnent (Quality Profiles, Autonomy Continuum, Improvement Cockpit, traces, gates, CAO). |
| [`autonomy-continuum.md`](./autonomy-continuum.md) | Le continuum d'autonomie en 6 niveaux — du Manual au Full Autopilot — avec les KPI qui pilotent la progression et le rationale derrière chaque transition. |

## Contexte

- **Stack** : React 18 + Express + PostgreSQL + Drizzle ORM. Monorepo Bun. Voir `README.md` racine.
- **Décisions d'architecture vivantes** : `CLAUDE.md` (multi-tenant, RBAC dynamique, isolation par tags, pipeline Bronze/Silver/Gold, etc.).
- **Sources internes** : ces documents consolident les visions et brainstorms de `docs/history/visions/` et `docs/history/brainstorms/` (Q1–Q2 2026). En cas d'incohérence, ce dossier `docs/product/` fait foi.

## Principe directeur

> *MnM est le management plane de l'IA coding. Pas un IDE, pas un framework, pas un concurrent de Claude Code, Cursor ou Codex. La couche au-dessus.*
>
> Analogie fondatrice : Kubernetes n'a pas remplacé Docker — il l'orchestre.

## Pour aller plus loin

- Architecture technique : `CLAUDE.md` à la racine du repo.
- Features livrées et en cours : section *"Ce qu'on a construit"* du `README.md` racine.
- Plans actifs et progress logs : `docs/superpowers/plans/`.
- Décisions historiques (visions et brainstorms archivés) : `docs/history/`.

---

*Document maintenu par Tom Andrieu et la communauté MnM. Studio Manifeste, 2026.*
