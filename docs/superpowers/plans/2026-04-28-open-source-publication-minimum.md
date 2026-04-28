# Plan — Publication open source MnM (minimum viable)

> **Statut** : exécution 2026-04-28
> **Branche de travail** : `claude/open-source-phase-1` (forkée de `claude/open-source-phase-zero-d5drS`)
> **Owner public** : Alpha Luppi (Studio Manifeste). Repo restera sous `github.com/AlphaLuppi/mnm`.
> **But** : finir le strict nécessaire pour publier proprement avant publication publique.

## Contexte

La branche `claude/open-source-phase-zero-d5drS` (4 commits ahead de master) a déjà :
- Phase 0 cleanup/anonymisation (commit `1e4629e3`)
- Restore + anonymize des `_bmad-output/` (commit `660efd74`)
- Phase 1 partielle : `LICENSE` (AGPL-3.0) + `NOTICE` ajoutés (commit `fe546cea`)

Audit initial 2026-04-28 : **170 occurrences résiduelles** dans 30 fichiers trackés (EnterpriseCustomer, enterprise, lab.enterprise, paperclip, emails). À nettoyer.

Auteurs git history : `andrieutom30@gmail.com` (Tom) + `noreply@anthropic.com` (Claude). Pas besoin de réécrire les auteurs, juste scrub les emails/strings internes dans les commits.

## Steps (parallélisables A/B/C/D, puis E/F en série)

### Step A — Audit Phase 0 résiduel (cleanup tracked files)

**Périmètre** : édits ciblés sur `server/src/`, `ui/src/`, `cli/src/`, `e2e/`, `_bmad-output/`, `_bmad/`, `docs/`, `packages/*/src/`, `releases/`, `README.md`, `NOTICE`, `bun.lock`, `CHANGELOG.md` × N.

**Règles** :
- Retirer toute mention `EnterpriseCustomer`, `enterprise`, `lab.enterprise`, `lab.enterprise.example`, emails internes en clair (`@enterprise.example`, etc.), noms de personnes physiques côté client.
- Garder `Alpha Luppi` (entité proprio) ✅
- Garder mentions `paperclip`/`paperclipai` dans **comparatifs concurrents factuels** uniquement (README), retirer le reste (refs internes au fork).
- Remplacer `lab.enterprise.example` → `https://example.com` ou supprimer la ligne si c'est un commentaire.
- Sur les emails de tests/E2E : remplacer par `@example.com`.
- `andrieutom30@gmail.com` reste sur les commits git (on ne réécrit pas l'historique pour ça).

**AC** : `git grep -i -E "EnterpriseCustomer|enterprise|lab\.cba" -- ':!docs/superpowers/specs/T7-marketplace-manifest.md' ':!bun.lock' ':!_bmad/_config/files-manifest.csv'` retourne 0 hits suspects. Faux positifs (EnterpriseCustomer dans un nom de constante neutre type `RBAC`, `enterprise` dans une URL externe légitime) à documenter.

**Output** : 1 commit `chore(open-source): finish Phase 0 — scrub residual EnterpriseCustomer/enterprise/internal refs`.

---

### Step B — Phase 1 légal complet

**Périmètre** : nouveaux fichiers à la racine + `ee/`. **Ne touche PAS LICENSE ni NOTICE** (déjà OK).

Crée :
- `CLA.md` — Contributor License Agreement Alpha Luppi (basé sur le template Apache CLA Individual + Entity, adapté français/anglais bilingue).
- `COMMERCIAL-LICENSE.md` — procédure achat licence non-AGPL, contact `licensing@alphaluppi.com`.
- `TRADEMARKS.md` — usage des marques MnM/Alpha Luppi (pattern PostHog), dépôt INPI à venir.
- `ee/LICENSE` — MnM Enterprise License (placeholder texte propriétaire, build flag `EE=1`, pattern PostHog/GitLab EE).
- `ee/README.md` — explique la séparation core/ee, comment build avec/sans EE.
- `ee/.gitkeep` si dossier vide.

**Pas de SPDX headers** dans ce step (script séparé, conflit potentiel — déféré post-merge).

**AC** : 5 fichiers créés. `LICENSE`/`NOTICE` non modifiés. `ee/` existe à la racine.

**Output** : 1 commit `chore(open-source): Phase 1 — add CLA, commercial license, trademarks, ee scaffolding`.

---

### Step C — Phase 2 multi-tenant hardening (CRITIQUE)

**Périmètre** : `server/src/db/`, `server/src/middleware/`, ajout test E2E.

Tâches :
1. Localiser le pool Postgres et la fonction `setTenantContext` / `clearTenantContext` (ou équivalent).
2. Vérifier que `clearTenantContext()` est appelé dans le **finally** du middleware HTTP (pas juste sur succès) — fix si manquant.
3. Ajouter rate-limit per-company (bucket `{companyId}:*` en plus du `{companyId}:{actorId}` existant).
4. Test E2E `e2e/tests/multi-tenant-pool-isolation.spec.ts` : force la réutilisation d'une connexion entre deux companies, vérifie que `current_setting('app.current_company_id')` est reset entre les deux.

**AC** : tests passent en local (`bun test e2e/tests/multi-tenant-pool-isolation.spec.ts`). Cleanup tenant context vérifié dans le finally.

**Output** : 1 commit `fix(security): Phase 2 — guarantee tenant context cleanup + per-company rate-limit`.

---

### Step D — Phase 4 minimal hygiène GitHub

**Périmètre** : nouveaux fichiers `.github/` et racine, **pas de modif des fichiers existants** sauf README.md (ajout lien vers README EN).

Crée :
- `SECURITY.md` — politique de signalement vulnérabilité, contact `security@alphaluppi.com`, SLA 90 jours.
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 (texte standard, contact maintainers).
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/question.md`
- `.github/ISSUE_TEMPLATE/config.yml` (link to Discussions, désactive blank issues)
- `.github/pull_request_template.md`
- `README.en.md` — version anglaise du README (traduction du FR existant + badge "🇫🇷 README en français").

**Pas inclus dans Step D** : workflows CI (release, changesets), CODEOWNERS, GOVERNANCE.md, MAINTAINERS.md, dependabot.yml — déférés post-publi.

**AC** : 8 fichiers créés. README.md a un lien vers README.en.md en haut. Templates GitHub valides (rendu sur github.com/AlphaLuppi/mnm).

**Output** : 1 commit `chore(open-source): Phase 4 minimal — issue/PR templates, security policy, code of conduct, README EN`.

---

### Step E — Réécriture historique git (filter-repo)

**Pré-requis** : `pip install git-filter-repo` (Tom a Python 3.12 dispo).

**Périmètre** : scrub dans tout l'historique (pas juste HEAD) :
- `lab.enterprise.example` → `example.com`
- `enterprise.example` → `example.com`
- emails `*@enterprise.example` → `internal@example.com`
- noms de personnes clients en clair (liste à finaliser après Step A)

**Approche** :
1. Clone bare local du repo dans `/tmp/mnm-rewrite/` pour test.
2. Écrire `scripts/scrub-history.txt` (replacements file pour `--replace-text`).
3. `git filter-repo --replace-text scripts/scrub-history.txt --force` sur le clone test.
4. Vérifier `git log -p | grep -i enterprise` retourne rien.
5. Appliquer sur la branche réelle.
6. **Important** : `git filter-repo` réécrit tous les SHA → la branche `claude/open-source-phase-1` aura un nouveau hash de tous ses commits. Les autres branches du remote (`claude/open-source-phase-zero-d5drS`, `claude/open-source-preparation-uIglt`) seront orphelines après merge → à supprimer après PR mergée.

**AC** : `git log --all -p | grep -i -E "enterprise|lab\.cba"` retourne 0. Branche pushable en force-with-lease.

**Output** : commits réécrits sur `claude/open-source-phase-1`. Pas de nouveau commit "filter-repo" — c'est la branche entière qui est rewrite.

---

### Step F — Push + PR vers master

1. `git push -u origin claude/open-source-phase-1 --force-with-lease`
2. Ouvrir PR via `gh pr create` :
   - Titre : "feat(open-source): Phase 0 → 1 → 2 → 4 minimum publishable"
   - Body : récap des 4 phases, lien vers `docs/open-source-migration-plan.md`, mention que Phase 3/5/6 sont post-publi.
3. Tom review, merge sur master.
4. Tom toggle le repo public sur GitHub.
5. Cleanup : supprimer branches `claude/open-source-phase-zero-d5drS` et `claude/open-source-preparation-uIglt` (mergées).

**AC** : PR créée. Tom a l'URL.

## Risques

1. **`git filter-repo` casse des refs** → on bosse sur clone test d'abord, puis on push avec `--force-with-lease` (pas `--force`) pour éviter l'overwrite si Tom a pushé entre-temps.
2. **Conflit entre agents A/B/C/D** → périmètres bien découpés, agents NE COMMITENT PAS (juste éditent/créent), je commit en série après.
3. **Step C casse des tests existants** → on lance `bun test server/` avant de commit.
4. **README EN désynchronisé du FR** → accepté, on signale dans le README.en que la source de vérité est le FR.

## Ordre d'exécution

```
[A] [B] [C] [D]  ← parallèle (4 agents general-purpose, no commit)
  ↓
[Tom valide diffs]  ← optionnel, 4 commits atomiques
  ↓
[E] filter-repo
  ↓
[F] push + PR
```
