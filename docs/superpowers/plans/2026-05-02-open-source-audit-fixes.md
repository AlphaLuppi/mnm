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

---

## 6. Round 2 — P1 fixes (2026-05-02 même jour)

Suite à validation des P0, traitement immédiat des 3 P1 restants.

### 6.1 Caveat `@codesandbox/nodebox` (SUL vs AGPL)

**Investigation** :
- `@mdxeditor/editor` est utilisé dans [ui/src/components/MarkdownEditor.tsx](../../../ui/src/components/MarkdownEditor.tsx) et [ui/src/main.tsx](../../../ui/src/main.tsx) (style.css).
- Plugins importés : `headings, lists, quote, table, link, codeBlock, codeMirror, image, markdownShortcut, thematicBreak`.
- **Aucun import Sandpack** dans le code MnM (ni `sandpack-react`, ni `sandpack-client`, ni `nodebox` directement).
- MnM utilise `codeMirrorPlugin` pour les blocs de code, pas Sandpack.

**Conclusion** : `@codesandbox/nodebox` est une dépendance transitive **non utilisée à l'exécution**. Vite tree-shake l'arbre Sandpack hors du bundle de production puisqu'aucun symbole n'est importé. Le bundle distribué aux utilisateurs ne contient pas nodebox → la frontière SUL/AGPL n'est pas franchie au moment de la distribution.

**Action** : reformuler le bloc "Known license caveats" du NOTICE en "Known third-party license edge cases" avec l'analyse documentée. Aucun changement de dépendance nécessaire à ce stade. Flag pour l'avenir : si on active un plugin Sandpack (ex : preview de code live), il faudra dropper la dépendance ou trouver une alternative OSI.

### 6.2 Workflow CLA Assistant

Création de [.github/workflows/cla-assistant.yml](../../../.github/workflows/cla-assistant.yml) basé sur `contributor-assistant/github-action@v2.6.1` :
- Trigger : `pull_request_target` + `issue_comment`
- Stockage des signatures : repo séparé `AlphaLuppi/cla-signatures` (à créer au moment de l'activation)
- Phrase de signature : "I have read the CLA Document and I hereby sign the CLA"
- Allowlist : bots (dependabot, renovate, github-actions) + mainteneurs core actuels (Seeyko, gabrieldesbouis, TarsaaL, NicolasBataille)
- Comment templates bilingues FR + EN

**Activation pré-publication publique** : créer `AlphaLuppi/cla-signatures` (privé OK) + ajouter un secret `PERSONAL_ACCESS_TOKEN` avec scope `repo` sur le repo de signatures.

### 6.3 AUTHORS file

Création de [AUTHORS](../../../AUTHORS) avec les 3 contributeurs humains identifiés via `git log --format='%aN <%aE>' | sort -u` :
- Tom Andrieu (Seeyko)
- Gabriel Desbouis (TarsaaL, gabrieldesbouis)
- Nicolas Bataille

Exclusion intentionnelle de l'identité Claude (cohérent avec la règle projet "Pas de Co-Authored-By Claude/AI" — l'IA est un outil de développement, pas un contributeur au sens du copyright).

[COPYRIGHT](../../../COPYRIGHT) mis à jour : `the AUTHORS file (when available)` → `the AUTHORS file`.

### 6.4 Restant pour publication publique effective

- [x] ~~Réserver/activer un catch-all sur `@alphaluppi.fr` pour les 6 alias~~ — résolu en §6.7 : on simplifie à 1 seul email public (`tom@alphaluppi.fr`).
- [x] ~~Générer SBOM complet (script à écrire)~~ — résolu en §6.6 : script `scripts/sbom.sh` livré.
- [x] ~~Audit secret-scan une dernière fois avant `gh repo edit --visibility public`~~ — résolu en §6.8 : 0 vrai secret trouvé, `.gitleaksignore` figé.

### 6.5 Decision update (2026-05-02 — même jour, après §6.2)

**Décision** : abandonner le workflow CLA Assistant automatisé pour l'instant, passer en **validation manuelle**.

**Raisons** :
- Volume de contributeurs externes attendu très faible à l'ouverture (<10/mois) — l'automatisation est sur-dimensionnée.
- Évite de créer un repo `AlphaLuppi/cla-signatures` séparé + de gérer un PAT.
- Évite la dépendance sur `contributor-assistant/github-action` (action tierce, ajoute une supply chain à auditer).
- Validité juridique identique : un commentaire GitHub authentifié reste une signature électronique au sens eIDAS, qu'il soit validé par un bot ou par un humain.

**Actions effectuées** :
- Suppression de `.github/workflows/cla-assistant.yml`.
- Reformulation du §8 du [CLA.md](../../../CLA.md) (FR + EN) pour décrire le processus manuel : phrase de signature à coller en commentaire de PR, validation par un mainteneur avant merge, signature couvrant toutes les contributions futures.
- Le §8 mentionne explicitement qu'un futur passage à un outil automatisé reste possible sans invalider les signatures déjà collectées.

**Process d'onboarding contributeur en validation manuelle** :
1. Contributeur ouvre une PR.
2. Mainteneur (Tom ou autre) vérifie si le contributeur a déjà signé (recherche dans l'historique des PR).
3. Si non : commenter sur la PR avec le texte du CLA + demander la phrase de signature.
4. Contributeur poste la phrase en commentaire.
5. Mainteneur ajoute un label `cla-signed` sur le contributeur (ou tient une liste dans un fichier privé) et merge.
6. Plus de demande pour les PR ultérieures du même contributeur.

### 6.6 SBOM (Software Bill of Materials)

**Décision** : livrer un script `scripts/sbom.sh` qui génère 3 SBOMs à la demande, plutôt que de les commit dans le repo (artifacts régénérables, pollueraient l'historique).

**Couverture** :
1. **App SBOM** (mandatory) — `sbom-app.cdx.json` via `@cyclonedx/cdxgen` au format CycloneDX 1.5. Couvre tout l'arbre bun workspaces (~1100 packages npm).
2. **Docker SBOM** (best-effort) — `sbom-docker.cdx.json` + `.spdx.json` via `syft`. Reflète exactement ce qui est dans l'image distribuée (binaires OS + npm deps installées). Skip si l'image n'est pas buildée.
3. **GitHub-native SBOM** (best-effort) — `sbom-github.spdx.json` via `gh api /repos/.../dependency-graph/sbom`. Skip tant que le repo est privé.

**Outils requis** :
- `bun` + `bunx` (déjà requis pour MnM dev)
- `syft` ([Anchore](https://github.com/anchore/syft)) — install à la demande
- `gh` CLI — déjà requis dans le workflow git

**Scripts package.json** :
- `bun run sbom` — génère tout ce qui est disponible
- `bun run sbom:app-only` — saute Docker + GitHub (utile pour CI ne build pas Docker)

**Format CycloneDX 1.5** retenu (vs SPDX) car plus moderne, mieux supporté par les outils SAST/SCA enterprise (Snyk, Dependency-Track, etc.). SPDX généré aussi pour Docker (compat GitHub).

**Output dans `/sbom/`** (gitignored). À attacher aux GitHub Releases comme assets le jour d'une release publique. Job CI à écrire post-publication.

**Pourquoi maintenant** : les premiers prospects enterprise vont demander un SBOM dans leur audit fournisseur (SOC 2, NIS2). Avoir le script prêt évite de bricoler à la dernière minute.

### 6.7 Emails simplifiés (décision 2026-05-02)

**Décision** : abandonner les 6 alias par fonction (`security@`, `licensing@`, `cla@`, `conduct@`, `trademarks@`, `legal@`) et utiliser un **seul email public** : `tom@alphaluppi.fr`.

**Raisons** :
- 3 personnes physiques (Tom, Gabriel, Nicolas) → 6 alias est sur-dimensionné.
- "Trucs globaux" (sécurité, licensing, etc.) vont chez Tom de toute façon.
- Évite de configurer 6 redirections + un catch-all pour rien.
- Simplifie la doc : 1 email à mémoriser, pas une liste à maintenir.

**Setup résultant** :
- `tom@alphaluppi.fr` → mailbox réelle de Tom (Cloudflare Email Routing → boîte Gmail principale)
- `gabriel@alphaluppi.fr` → boîte Gabriel (interne, non publique)
- `nicolas@alphaluppi.fr` → boîte Nicolas (interne, non publique)

**Coût** : 0 € (Cloudflare Email Routing) + envoi via Brevo/Resend free tier si Tom veut répondre depuis l'alias.

**Tradeoff accepté** :
- Le repo public expose un email perso plutôt qu'une adresse "team@" — légitime au vu du stade pré-incorporation.
- Si le volume de mails publics devient ingérable (>50/mois), on pourra introduire `contact@` ou `team@` comme overlay sans casser les anciennes mentions (un "Closed" auto-reply suffirait sur `tom@` qui redirige vers `contact@`).

**Action effectuée** : remplacement de tous les `(security|licensing|cla|conduct|trademarks|legal)@alphaluppi.fr` par `tom@alphaluppi.fr` dans les 10 fichiers OSS publics + simplification du bloc "Contact" du `ee/LICENSE`.

### 6.8 Secret-scan (gitleaks)

**Outil** : `gitleaks` 8.30.1 (installé via `winget install --id gitleaks.gitleaks`).

**Méthode** :
1. Scan worktree (`gitleaks detect --no-git`) → 6 findings.
2. Scan full history (`gitleaks detect`, 6160 commits sur ~180 MB) → 48 findings.
3. Analyse manuelle de chaque finding (lecture des sources via `git show`).
4. Tri faux positifs vs vrais secrets.

**Résultat du tri** : **0 vrai secret**. Tous les findings sont des faux positifs catégorisés ainsi :

| Catégorie | Pattern flagué | Réalité |
|---|---|---|
| `_bmad/_config/files-manifest.csv` (24 lignes×4 commits) | Hash haute entropie | SHA-256 de file integrity, pas une API key |
| `_bmad/.../api-testing-patterns.md` (1 ligne×4 commits) | `expiredToken = 'eyJ...'` | JWT canonique de jwt.io pour test "should reject expired" |
| `docs/deploy/secrets.md` (2 lignes) | `secretId: "uuid"` | Placeholder UUID dans une doc d'exemple |
| `ui/src/api/onboarding.ts` + `jira-import.ts` (3 commits) | `// onb-s01-api-...` | Commentaires de tracking gitnexus |
| `ui/storybook-static/assets/*.js` (2 commits) | `e.key,REDACTED` | Variable lexer Lexical dans JS minifié |
| `server/src/__tests__/redaction.test.ts` + `heartbeat-...test.ts` (4 commits) | JWT + GitHub token | Fixtures synthétiques pour tester la redaction (l'ironie) |
| `.env` (worktree) | `BETTER_AUTH_SECRET=...` | Vrais secrets MAIS `.env` est gitignored, jamais commité |

**Vérification `.env` jamais commit** : `git log --all --oneline -- .env` → 0 ligne. ✅

**Action** : création de `.gitleaksignore` qui fige les 48 fingerprints history + 6 fingerprints worktree, avec une justification commentée par catégorie. Re-scan post-`.gitleaksignore` : **0 leak en worktree, 0 leak en history**.

**Suivi recommandé après publication publique** :
- Ajouter un job CI GitHub Actions qui run `gitleaks` sur chaque PR (`.github/workflows/gitleaks.yml`).
- Configurer Dependabot + Secret Scanning dans Settings → Code security après ouverture du repo.
- Tom installe gitleaks en pre-commit hook local : `gitleaks protect --staged` (optionnel).

**Conclusion** : le repo est **safe à publier en l'état**. Aucune réécriture d'historique nécessaire. Aucun secret à rotate.
