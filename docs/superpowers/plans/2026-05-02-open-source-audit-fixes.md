# Plan — Open Source Audit Fixes (P0)

> **Statut** : in progress 2026-05-02
> **Owner** : Tom + Claude
> **Contexte** : audit OSS du 2026-05-02 a remonté 5 incohérences bloquantes pour publication publique du repo. Ce plan les corrige toutes en un commit atomique.

---

## 1. Contexte

L'audit a comparé les fichiers OSS (LICENSE, NOTICE, COPYRIGHT, CLA, TRADEMARKS, COMMERCIAL-LICENSE, ee/LICENSE, CODE_OF_CONDUCT, SECURITY, README FR/EN, templates GitHub) à la réalité juridique du projet, et à la compliance vis-à-vis du fork Paperclip.

**Constats P0 :**
1. Tous les emails `@alphaluppi.com` doivent être `@alphaluppi.fr` (le `.fr` est le domaine réellement détenu).
2. [TRADEMARKS.md](../../../TRADEMARKS.md) prétend un dépôt INPI en cours et une protection au titre de la concurrence déloyale depuis 2026-01 — **faux**. Aucun dépôt INPI, aucun usage commercial public attesté.
3. [NOTICE](../../../NOTICE) ne contient pas le texte de la licence MIT de Paperclip ni la copyright notice MIT — **non conforme à MIT** (qui exige la préservation de la permission notice).
4. [CLA.md](../../../CLA.md) et [COPYRIGHT](../../../COPYRIGHT) traitent "Alpha Luppi (Studio Manifeste)" comme entité juridique mainteneuse — **fausse représentation** car pas d'entité juridique enregistrée à ce jour.
5. [NOTICE](../../../NOTICE) référence `docs/open-source-migration-plan.md` qui **n'existe pas**.

**Ce qui est OK et qu'on touche pas :**
- Structure dual-license AGPL + Commercial + EE (pattern PostHog/GitLab) — solide.
- Attribution Paperclip présente partout (README, NOTICE, comparatif) — ton respectueux.
- LICENSE = AGPL-3.0 GNU intégrale 661 lignes — conforme.
- ee/LICENSE = MnM Enterprise License source-available, build flag `EE=1` — propre.
- SECURITY.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, templates GitHub — tous propres.

**Hors scope (P1+, traité ailleurs ou plus tard) :**
- Caveat `@codesandbox/nodebox` SUL vs AGPL — déjà flagué dans NOTICE, à trancher avant publication réelle (changement de dépendance, pas un fix de doc).
- Workflow CLA Assistant `.github/workflows/cla-assistant.yml` — pas urgent tant que repo en privé.
- AUTHORS file — "when available" dans COPYRIGHT, peut attendre les premières contribs externes.
- Génération SBOM — Phase 1 distincte avant publication réelle.

---

## 2. Approche

### 2.1 Replacement domaine email

`@alphaluppi.com` → `@alphaluppi.fr` dans 10 fichiers identifiés :

```
README.en.md, README.md, TRADEMARKS.md, SECURITY.md,
ee/README.md, COMMERCIAL-LICENSE.md, CODE_OF_CONDUCT.md,
CLA.md, ee/LICENSE, .github/ISSUE_TEMPLATE/config.yml
```

Edit avec `replace_all=true` quand l'occurrence est unique par fichier.

### 2.2 Reformule TRADEMARKS.md

Retirer les sections qui prétendent une protection juridique inexistante :
- Bloc "Statut INPI : dépôt en cours / Registration pending"
- Bloc "ces marques bénéficient d'une protection au titre du droit français de la concurrence déloyale et du parasitisme dès l'usage commercial effectif (depuis 2026-01)"

Remplacer par une formulation honnête : "Aucune marque déposée à ce jour. Cette politique exprime l'intention des mainteneurs et constitue un cadre communautaire ; elle ne crée pas de droit opposable au sens du droit des marques."

### 2.3 Compliance MIT Paperclip

Ajouter une section dans NOTICE avec :
- Le texte intégral de la licence MIT
- La copyright notice `MIT © 2026 Paperclip` (ou plus précis si disponible)
- Lien vers le repo upstream pour la version source

Format inspiré du pattern Apache NOTICE.

### 2.4 Reformule CLA.md

Remplacer "Alpha Luppi (Studio Manifeste), entité française mainteneuse du projet MnM" par :

> "Alpha Luppi (Studio Manifeste) — collectif des mainteneurs actuels du projet MnM. À la date de la présente version, Alpha Luppi opère sous forme de projet sans personne morale distincte ; les droits cédés bénéficient au mainteneur principal (personne physique) et seront transférés de plein droit à toute structure juridique qui lui succéderait dans la maintenance du projet."

Et préciser dans Article 3 que la cession est faite "à Alpha Luppi (et à toute structure successeur)".

### 2.5 Reformule COPYRIGHT

Remplacer `Copyright (c) 2026 Alpha Luppi (Studio Manifeste)` par :

> `Copyright (c) 2026 The MnM contributors (collectively "Alpha Luppi" / Studio Manifeste).`

Plus exact : le copyright appartient aux contributeurs individuels (dont Tom Andrieu), regroupés sous le nom de projet.

### 2.6 Retirer ref orpheline

Dans NOTICE, supprimer la phrase "A full SBOM and license summary will be generated in Phase 1 of the open-source preparation (see docs/open-source-migration-plan.md)." → garder juste l'engagement de générer un SBOM, sans pointer vers un fichier inexistant.

---

## 3. Acceptance Criteria

- [ ] `grep -ri "@alphaluppi\.com" .` → 0 résultat (hors node_modules)
- [ ] `grep -ri "INPI\|registration pending\|dépôt en cours" .` → 0 résultat (hors ce plan + memory perso)
- [ ] NOTICE contient le texte MIT et la copyright notice Paperclip
- [ ] CLA.md ne dit plus "entité française" sans qualification
- [ ] COPYRIGHT ne traite plus Alpha Luppi comme cessionnaire unique implicite
- [ ] NOTICE ne référence plus `docs/open-source-migration-plan.md`
- [ ] `bun run typecheck` passe (rien de touché côté code, sanity check)
- [ ] Commit atomique signé DCO + GPG, push direct sur master

## 4. Risques

- **R1** : reformulation CLA pourrait fragiliser la cession des droits si Tom incorpore plus tard. Mitigation : la clause "et à toute structure successeur" couvre ça par novation. Solution propre = avocat IP au moment de l'incorporation.
- **R2** : retirer le claim INPI pourrait laisser penser qu'aucune protection n'existe. C'est exactement le statut réel ; mieux vaut être honnête que tenter une "présomption" de protection invocable.

## 5. Suivi

Après merge, documenter dans le decision-log un nouveau §X "Open source readiness — état réel à 2026-05-02" avec checklist des P1/P2 restants avant publication publique effective.
