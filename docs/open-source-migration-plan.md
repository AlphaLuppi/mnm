# Plan de migration open source — MnM

> **Statut** : Phase 0 exécutée 2026-04-26 sur `claude/open-source-phase-zero-d5drS` (cf. section "Phase 0 — exécution"). Phases 1+ encore à faire.
> Document basé sur l'audit multi-agents 2026-04-26 (sécurité, self-hosting, multi-tenant, communauté, licensing) + audit adversarial Phase 0.
> Chaque phase peut être reprise par un sub-agent spécialisé. Ce doc reste volontairement haut-niveau.

## Objectifs

1. Publier MnM en open source pour créer une communauté et générer de l'engouement autour d'Studio Manifeste.
2. **Garder la propriété** du nom, du logo, et du droit de relicencier.
3. Permettre le **self-host gratuit** (AGPL) + une **app desktop**.
4. Faire payer les grands comptes anti-AGPL via une **licence commerciale** + un module **Enterprise** propriétaire.
5. Lancer plus tard un **SaaS hébergé** par Studio Manifeste qui inclut les features Enterprise.

## Stratégie de licensing retenue

- **Cœur du repo** : AGPLv3 (suit Elastic 2024 et Redis 2025, OSI-approved, network clause anti-hyperscaler).
- **Dossier `ee/`** : licence Enterprise propriétaire (pattern PostHog) — modules premium dans le même monorepo, build flag `EE=1`.
- **Dual-license commerciale** sur le core pour les boîtes qui refusent l'AGPL.
- **CLA obligatoire** via CLA Assistant (sans CLA, le dual-license est juridiquement impossible).
- **Trademark** déposé à l'INPI (classes 9 + 42), puis EUIPO.

Modules destinés à `ee/` (à valider) : multi-org admin cross-company, SSO/SAML/SCIM, audit logs SOC2, advanced RBAC builder, billing/usage metering, AI Assistant premium, gates marketplace privé, support 24/7.

## Phases

### Phase 0 — Sécurité & nettoyage — EXÉCUTÉE 2026-04-26

Périmètre redéfini après audit adversarial : nettoyage cosmétique + anonymisation, mais **PAS** publication (LICENSE manquant + git history pollué = blockers — voir "Pré-publication blockers" plus bas).

Réalisé sur `claude/open-source-phase-zero-d5drS` :

**Code applicatif anonymisé**
- `ui/src/pages/UserProfile.tsx` : label `"GitLab (<customer-gitlab-domain>)"` → `"GitLab"`, descriptions génériques (suppression mention client / Azure tenant spécifique).
- `server/src/auth/better-auth.ts` : commentaires GitLab issuer + Microsoft tenant rendus génériques.
- `server/src/routes/governed-workflows-ui.ts` : `providerId.default("<customer>-lab")` → `"gitlab:primary"`.

**`.env.example` reconstruit**
- Bug corrigé : `MNM_PUBLIC_URL` était dupliqué (sections Auth + Email).
- Section Microsoft / Entra OAuth ajoutée (jamais documentée alors que le code la supporte).
- Sections ajoutées : `MNM_ALLOWED_HOSTNAMES`, `MNM_AGENT_JWT_SECRET` (+ clarification vs `BETTER_AUTH_SECRET`), `MNM_MCP_JWT_SECRET`, Git provider (`MNM_GIT_PROVIDER`, `GITLAB_BASE_URL`, `GITLAB_PROJECT_ID`, `GITLAB_TOKEN`, `MNM_GIT_LOCAL_PATH`), LLM (`ANTHROPIC_API_KEY`, `MNM_LLM_*`), Adapters CLI overrides, Docker sandbox.

**Conservés et anonymisés (mémoire des sessions de travail)**
- `_bmad-output/` (75 fichiers de brainstorming, vision, planning) — tous anonymisés (client, produit client, the maintainer/the lead developer/the CEO, paths perso).
- `docs/prd.md` (PRD historique) — anonymisé (nom produit client → `<customer-product>`, etc.).
- `docs/governed-workflows-scenarios.md` (scénarios d'usage) — anonymisé.
- `docs/superpowers/plans/2026-04-25-feature-dev-workflow.md` + spec design associée — fichier renommé (avait un préfixe client dans le nom) + contenu anonymisé.
- `ROADMAP-B2B-REMAINING.md`, `RELEASE-NOTES-B2B.md` — anonymisés.

**Supprimés (audit visuel impossible)**
- 22 screenshots QA à la racine (`qa-*.png`, `step*.png`, `u8-*.png`) — peuvent contenir noms d'utilisateurs réels, URLs internes dans la barre d'adresse, IDs de session. Suppression plus sûre que déplacement sans audit pixel par pixel. Re-prendre des captures avec un dataset fictif quand on en aura besoin pour la doc.

**Anonymisation bulk (sed multi-fichiers)**
- `<customer-gitlab-domain>` → `gitlab.example.com`
- `<personal-username>` → `your-username` ; `<contributor-name>` → `the contributor`
- Paths Windows `C:/Users/<personal>/IdeaProjects/perso/alphalup/mnm` → `C:/path/to/mnm`
- Paths Unix `/Users/<personal>` → `~`, `~/IdeaProjects/perso/alphalup` → `~/projects`
- Repos exemples `<personal>/<customer>-demo-*` → `your-username/mnm-*-demo`
- Prénoms équipe : `Gabriel`/`the lead developer` → `the lead developer` ; `the CEO`/`the CEO` → `the CEO` ; `Thomas`/`the maintainer Andrieu` → `the maintainer`/`the contributor`.
- Plugins Claude Code customer-spécifiques : `<client>-dev-angular` → `team-dev-frontend`, `<client>-dev-java` → `team-dev-backend`, `<client>-dev-workflows` → `team-dev-workflows`, etc.
- Produit client : nom produit → `<customer-product>` ; sous-produits → `internal-product-{web,mobile}`.
- Dans CONTRIBUTING/README/HISTORY/ARCHITECTURE : mentions du client pilote (chez le client, infra client, GitLab client) → tournures génériques (`en entreprise`, `GitLab self-hosted`, etc.).
- Dans `skills/mnm/SKILL.md` + `references/api-reference.md` : prefixes d'exemple client → `ACME-123` / `/ACME/`.

**Hygiène repo**
- `.claude/settings.local.json` détrackée (contenait paths Windows perso) + ajoutée à `.gitignore` (le suffixe `.local` est déjà la convention "local-only").

### Phase 0 — Hors-périmètre (volontairement non fait, à trancher avant push public)

L'audit adversarial a flaggé ces points, dont la résolution dépend de décisions humaines / juridiques :
- **Git history** : 58 commits historiques mentionnent `<customer-domain>`, `<personal-username>`, l'org `<editor>`. Choix binaire : (a) republish from clean tree (nouveau repo public, perte de l'historique) vs (b) `git filter-repo` sur l'existant (intrusif, casse les PRs et tags). Recommandation : **(a) nouveau repo**, plus simple et propre.
- **Notification clients / clients** : retirer leurs mentions sans prévenir peut être contractuellement problématique si MnM est cité comme référence dans des deals B2B. À trancher avec le juridique avant push.
- **Trademark `MnM`** : dépôt INPI/EUIPO + recherche disponibilité (npm, GitHub org, USPTO) à faire AVANT push public, pas après — sinon risque de devoir renommer le projet.

### Phase 1 — Licensing & légal (≈ 2j) — INCLUT BLOCKERS J-0

> **BLOCKER push public** : sans `LICENSE` à la racine, un repo public est juridiquement "tous droits réservés" → personne ne peut forker légalement, l'objectif #1 du plan tombe. Idem `package.json` sans champ `license` → `npm publish` part en `UNLICENSED`. À faire AVANT `git push public`.

Phase 0 a confirmé : aucun de `LICENSE`, `COPYING`, `NOTICE`, `COPYRIGHT` n'existe. `package.json` racine n'a ni `license`, ni `author`, ni `repository`, ni `homepage`. `cli/package.json` est en MIT et pointe vers une URL inventée (`github.com/mnm/mnm`) — incohérence licensing intra-monorepo à résoudre.

À livrer :
- `LICENSE` (AGPL-3.0), `COPYING`, `NOTICE`, `COPYRIGHT`
- Champs `license`/`author`/`repository`/`homepage`/`bugs` cohérents dans **chaque** `package.json` (racine + 12 sous-packages)
- `ee/LICENSE` (MnM Enterprise License) + `ee/README.md`
- `CLA.md` + workflow `.github/workflows/cla.yml` (CLA Assistant)
- `COMMERCIAL-LICENSE.md` (procédure d'achat licence non-AGPL)
- `TRADEMARKS.md` + lancement dépôt INPI
- Headers SPDX sur tous les fichiers source (`AGPL-3.0-or-later` ou `LicenseRef-MnM-Enterprise`)
- **Audit licences deps** (`license-checker --production`) : vérifier compatibilité AGPLv3 (notamment `bullmq`, `better-auth`, `dockerode`, `@aws-sdk/*`).
- Vérifier compatibilité licence du fork upstream d'origine + headers de copyright préservés dans `NOTICE`.
- **Secrets scan** : passer `gitleaks detect` + `trufflehog filesystem` sur le repo final (et sur l'historique si choix (b) ci-dessus). Phase 0 n'a trouvé aucun secret en clair, mais ce n'est pas un substitut à un scan automatisé.

### Phase 2 — Bouchage trou multi-tenant (≈ 1j) — CRITIQUE

- Vérifier que `clearTenantContext()` est appelé en cleanup HTTP sur le pool Postgres ; ajouter test E2E qui force la réutilisation de connexion entre deux companies.
- Ajouter rate-limit per-company (bucket `{companyId}:*`) en plus du `{companyId}:{actorId}` existant.

### Phase 3 — Self-hosting fonctionnel (≈ 3-4j)

- Endpoint `POST /auth/register-first-admin` (n'autorise qu'un seul appel quand aucun `instance_admin` n'existe).
- `docs/DEPLOY.md` complet (docker-compose, env vars, secrets master key, backup, reverse-proxy, upgrade).
- Documenter la CLI `@mnm/cli` (`configure`, `onboard`, `doctor`, `run`).
- Décision Redis : doc mode dégradé OU bascule de la job queue sur `pg-boss` pour rendre Redis optionnel.

### Phase 4 — Hygiène GitHub (≈ 2j)

- `.github/workflows/` : `test.yml`, `lint.yml`, `release.yml` (Changesets), `dependabot.yml`, `gitleaks.yml` (scan continu)
- `.github/ISSUE_TEMPLATE/` (bug, feature, question), `pull_request_template.md`, `CODEOWNERS`
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md` (canal disclosure responsable — **à livrer J-0 avec LICENSE**, pas après), `SUPPORT.md`, `GOVERNANCE.md`, `MAINTAINERS.md`
- README EN à côté du FR + badges shields.io
- `.gitattributes` (normalisation EOL) + `.editorconfig` pour éviter diffs CRLF/LF côté contributeurs Windows.

### Phase 5 — Site doc + communauté (≈ 3j)

- Mintlify (`docs/mint.json`) déployé sur Vercel.
- GitHub Discussions activé, Discord, landing page produit.
- Demo en ligne publique (instance Dokploy avec data fake) linkée depuis le README.

### Phase 6 — SaaS commercial (≈ 10j, **post-publication**)

À faire après le go-public, en parallèle de la croissance communauté :

- Tables `company_plans`, `company_usage_metrics`, `feature_usage` + middleware `requireFeature(licenseKey, featureKey)`.
- Premier module `ee/multi-org-admin/` (vendable directement aux grands comptes).
- Stripe billing + endpoint public `/signup` (crée company + first admin + invite email).
- Admin panel super-admin (`/admin/companies`, usage par tenant).
- Tauri desktop (`apps/desktop/` n'existe pas encore — packaging cross-OS, signing, updater).

## Risques majeurs et mitigation

1. **Fork hostile à la OpenTofu** → rester en AGPL (pas BSL/SSPL), gouvernance ouverte, ne jamais relicencier rétroactivement le code communautaire.
2. **Adoption corporate freinée par l'AGPL** → offre de licence commerciale claire, packagée avec SaaS et Enterprise on-prem.
3. **CLA vu comme repoussoir communauté** → CLA Assistant click-through (signature 30s), texte court, transparence sur la raison ("rester indépendants face aux hyperscalers").

## Pré-publication blockers — checklist J-0

Avant tout `git push` vers le repo public (au-delà de Phase 0 déjà faite) :

1. ✅ **LICENSE + NOTICE + COPYRIGHT** à la racine (committés Phase 1).
2. ✅ **`package.json`** racine + 15 sous-packages : `license`, `author`, `repository`, `homepage`, `bugs` cohérents (committés Phase 1).
3. ✅ **`gitleaks`** scan clean — filesystem + 58 commits ; 4 findings = tous faux positifs (`TOKEN_ALPHABET` = jeu de caractères, JWT exemple en doc).
4. ✅ **Audit licences deps** : 1213 deps scannés ; 99% MIT/Apache-2.0/ISC/BSD/MPL (compatibles AGPL) ; ⚠️ **1 caveat** = `@codesandbox/nodebox` en Sustainable Use License (transitive via `@mdxeditor/editor → sandpack-react`). Pas un hard-block immédiat (SUL permet redistribution non-compétitive) mais à trancher avec un avocat OSS avant push public — option de remplacement : forker mdxeditor sans le module sandpack, ou changer d'éditeur Markdown.
5. ⚠️ **Git history rewrite** : à exécuter ensuite. `git filter-repo` pour réécrire les emails de commit (anciens emails internes → `andrieutom30@gmail.com`, name → `Seeyko`) sur les 58 commits historiques.
6. **SECURITY.md** + canal de disclosure responsable (encore à créer).
7. **Trademark `MnM`** : dépôt INPI initié + dispo confirmée (npm, GitHub org, USPTO).
8. **Notification clients** (et autres clients référencés en interne) si retrait de mention contractuellement encadré.
9. **Dry-run** : `bun install && bun run dev` doit passer sur fresh checkout sans `.env` perso.
10. **Validation finale humaine** par quelqu'un qui n'a pas écrit le plan.

## ⚠️ Findings adversariaux — docs à re-auditer manuellement avant push public

L'audit lecture-attentive du 2026-04-26 a identifié que **plusieurs docs sont en réalité du planning de projet client (secteur régulé France) plutôt que du planning MnM**. Même après 4 passes d'anonymisation sed, le vocabulaire métier sectoriel rend ces docs potentiellement identifiables (vocab spécifique fortement substitué : <redacted-acronym> → professionnel de santé, HAS/<redacted-acronym> → autorité/nomenclature sectorielle, <document> → document généré, etc., mais structure des cas d'usage reste sectorielle).

Documents flagués pour review humaine avant push public :

| Doc | Risque | Recommandation review |
|-----|--------|----------------------|
| `docs/prd.md` | PRD client (refonte auth `internal-product` web/mobile) | Soit anonymisation poussée manuelle, soit déplacer vers `internal/` gitignored |
| `docs/governed-workflows-scenarios.md` | Personas (`teammate-A`, `teammate-B`, ticket `FEAT-001`), GitLab self-hosted, Jira | Réécrire from scratch avec personas génériques (Alice/Bob/Carol) |
| `_bmad-output/vision-projects-v2-2026-04-06.md` | Décrit projet client (web Angular + mobile + legacy backend) avec exemples métier | À réécrire ou déplacer hors repo public |
| `_bmad-output/brainstorming/brainstorming-internal-product-refonte-2026-04-17.md` | Brainstorm client refonte | À déplacer hors repo public |
| `_bmad-output/brainstorming/tactical-deleted.md` | DMs réels (PO, QA, CEO, DSI, DPO, CTO, Architecte) | À supprimer ou déplacer hors repo public |
| `_bmad-output/brainstorming/tactical-deleted.md` | Questions interview événement interne | À supprimer ou déplacer hors repo public |
| `ROADMAP-B2B-REMAINING.md`, `RELEASE-NOTES-B2B.md` | Stratégie commerciale interne (verités #43/#54/#57, prospects) | À déplacer vers `internal/` ou anonymiser fortement |
| `docs/open-source-migration-plan.md` (CE DOC) | Méta-leak — liste les patterns sed appliqués | À déplacer vers `internal/` au moment du push public |

**Règle simple pour la review** : un doc qui décrit du métier client (santé, finance, retail, etc.) avec assez de détails pour qu'un Google de 2 minutes identifie le client n'a pas sa place dans un repo OSS. La passe sed corrige les noms propres mais pas la structure narrative ni le vocabulaire métier.

## Anonymisations supplémentaires (Phase 0.5 — 2026-04-26)

Suite à l'audit adversarial, passes additionnelles :
- **Filenames renommés** : `brainstorm-tom-*.md` → `brainstorm-founder-*.md` ; `brainstorm-nikou.md` → `brainstorm-ceo.md` ; `B2B-Gab-*.md` → `B2B-co-founder-*.md` ; `idees-vrac-gab-*.md` → `idees-vrac-co-founder-*.md` ; `brainstorming-session-{tom,gab}-*.md` → `brainstorming-session-{founder,co-founder}-*.md`.
- **Sed pass 2 (résiduels prénoms)** : `Tom`/`Gab`/`Gabri`/`Niko`/`Niko` standalone (manqués par la passe 1) + frontmatter YAML `user_name: Tom`.
- **Sed pass 3 (jargon sectoriel)** : `<redacted-acronym>` → professionnel de santé ; `HAS` → autorité de régulation sectorielle ; `<redacted-acronym>` → nomenclature sectorielle ; `cabinet` → local ; `<document>` → document généré ; `médecin` → professionnel ; `<document>` → génération de document ; `mutuelles` → tiers payeurs ; stack client (`internal-backend`/`internal-product`/`internal-backend`/`hybrid-mobile-stack`/`hybrid-mobile-stack`/`e2e-testing`) → tournures génériques (`internal-backend`, `hybrid-mobile-stack`, etc.) ; `internal-product` → `internal-product`.
- **Sed pass 4 (divers)** : `AlphaLuppi` (en clair) → `<editor>` ; `Alpha Luppi` → `Studio Manifeste` ; `3 personnes`/`équipe (3 personnes)` → `petite équipe` ; `AY-NNNN` (préfixe Jira client) → `FEAT-001` ; `Lucas`/`Marie` → `teammate-A/B` ; `John le PM` → `the PM` ; `NovaTech Solutions`/`Atelier Numerique` (test fixtures) → `TestCorp-A/B` + noms test users (Sophie Durand/Pierre Martin/Camille Leroy/Thomas Bernard/Marie Dupont) → `Test {Admin/Manager/Contributor/Viewer/Cross-Tenant Admin}` ; CLAUDE.md "Tom's morning review" → "technical review" ; citation CEO client → tournure générique.

## Relancer un agent par phase

Chaque phase peut être attaquée indépendamment via un sub-agent spécialisé. Lui passer en contexte :
- Ce document (`docs/open-source-migration-plan.md`).
- Les rapports d'audit détaillés (à conserver hors repo public, ex. dans `internal/audits/`).
- La branche `claude/open-source-phase-zero-d5drS` (Phase 0 exécutée) ou la branche dédiée à la phase suivante.

## Source des recommandations

Audit multi-agents 2026-04-26 :
- Audit secrets & variables d'environnement
- Audit self-hosting & déploiement
- Audit multi-tenancy & SaaS readiness
- Audit hygiène communautaire & gouvernance
- Recherche modèles de licence open source (Elastic 2024, Redis 2025, PostHog, Sentry FSL, OpenTofu)
