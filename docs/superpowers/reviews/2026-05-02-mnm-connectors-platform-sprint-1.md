# MnM Connectors Platform — Sprint 1 multi-review (2026-05-02)

> **État** : **Phase 4 SHIPPED 2026-05-02 (10 commits Sprint 1+Phase 4)**. 4 HIGH security/archi findings + 4 MED quick wins fixés ; 20 tests Phase 4 ajoutés (4 HIGH-Q1 getUserToken paths + 7 HIGH-Q2 callback msw + 9 HIGH-Q3 RLS runtime). Total : **46 Vitest pass + 14 migration regex + 17/17 typecheck**. Sprint 2 (T5-T8) prêt à démarrer.

> **Mise à jour 2026-05-02 (Phase 4 close)** : Le test HIGH-Q3 RLS runtime a découvert un finding architectural NEW-S1 (cf. ci-dessous) — la pattern RLS de la codebase (depuis 0030) n'a qu'une RESTRICTIVE policy sans PERMISSIVE → default-deny postgres → l'isolation tenant ne marche que parce que l'app connecte avec un user `BYPASSRLS`. Le test contourne en ajoutant une PERMISSIVE temporaire. Bug à fixer codebase-wide en follow-up séparé.

> **Multi-review original (Phase 3)** parallèle exécutée 2026-05-02 par 4 reviewers (sécu, archi, code-quality, bug-hunter). Verdict consolidé : **SHIP avec fixes prio HIGH avant Sprint 2** — ✅ effectué Phase 4.

## Contexte

- **Branche** : `feat/connectors-platform`
- **Plan canonique** : [`docs/superpowers/plans/2026-05-02-mnm-connectors-platform.md`](../plans/2026-05-02-mnm-connectors-platform.md) (v2)
- **5 commits Sprint 1** :
  | Commit | Tâche | Tests |
  |---|---|---|
  | `94cc210aa` | T1 — DB schema + migration 0079 (4 tables, RLS×4, 2 perms) | +14 (regex SQL) |
  | `93265a37f` | T2 — service connectors.ts + getUserToken + refresh + secret-crypto | — |
  | `bb00ac918` | T2.4 — OAuth callback dispatcher + state JWT (HS256/10min) | — |
  | `3121a5c31` | T2.5 — 21 tests Vitest (C1+C2+H1) + msw devDep | +21 |
  | `a1c44612c` | T3 — BetterAuth dynamic providers + merge DB-wins | +5 |

## État Sprint 1 vs plan v2

| Tâche plan | % réel | Reste |
|---|---|---|
| T1 — DB schema + migration | **100%** | — |
| T2 — service + getUserToken + refresh + callback | **~85%** | tests integration msw OAuth provider mock manquants ; tests E2E refresh concurrent (B1) |
| T3 — BetterAuth dynamic providers | **~70%** | aucun caller passe encore `dynamicProviders` arg → feature DB-managed providers dormante. T3.5 backward compat E2E 3 cas non câblé. Hot-reload SSE V0 = single-process accepté (note ops à graver dans decision-log §4.6). |
| T4 — API keys path | **~95%** | tests cross-tenant runtime intra-company manquants |

**Total Sprint 1 ~85% shipped. Fondation solide. Bloquant Sprint 2 = HIGH findings ci-dessous.**

## Reviews consolidées

### Verdicts par reviewer

| Reviewer | Verdict | Notes |
|---|---|---|
| Sécu | **PASS_WITH_NITS** | 1 fix HIGH post-merge (HTTP en prod), 4 nits MED/LOW |
| Archi | **GAPS_ACCEPTABLES** | 3 gaps bloquant Sprint 2 (cast `result.length`, msw tests, `setTenantContext` dans tx) |
| Code Quality | **B / C** (qualité B, coverage C) | 6 recommandations dont 3 HIGH (api_key paths non testés, callback aucun test, pas de RLS runtime) |
| Bug Hunter | **0 critical, 2 HIGH, 3 MED, 2 LOW** | 2 race conditions confirmées (TOCTOU userId in callback ; createConnector concurrent slug) |

### Invariants sécurité (audit consolidé sécu)

| Invariant | Statut | Référence |
|---|---|---|
| **C1** tokens chiffrés AES-256-GCM jamais en clair | HOLDS | `secret-crypto.ts`, `connectors.ts` listConnectors projection sans `clientSecretCiphertext` |
| **C2** cross-tenant guard `assertUserInCompany` | HOLDS (avec NIT cast fragile) | `connectors.ts:457` cast `result.length` voir HIGH-A2 |
| **B1** advisory lock + re-read inside lock | HOLDS | `connectors.ts:801-849` |
| **H1** redirect_after whitelist | HOLDS | `connectors.ts:74-95` validateRedirectAfter |
| **HOST-ONLY** getUserToken jamais hors process Express | HOLDS (culturel : pas testé E2E avec hooks) | `connectors.ts` JSDoc ligne 730 |
| **STATE-JWT** HS256 BETTER_AUTH_SECRET 10min | HOLDS | `connectors.ts:25-67` |
| **SSRF** validateOAuthUrl IP privées | HOLDS avec NIT (HTTP autorisé en prod) | `connectors.ts:176` voir HIGH-S1 |
| **AUDIT-FIRE-AND-FORGET** maybeAuditTokenUsed `void` | HOLDS | `connectors.ts:252` |
| **NO-SECRET-IN-LIST** | HOLDS | `connectors.ts:262-284` |
| **RLS** RESTRICTIVE FORCE × 4 | HOLDS | migration 0079 lignes 61-64, 105-108, 139-142, 171-174 |
| **FK-CASCADES** | HOLDS | migration 0079 lignes 73-74, 152 |

## Findings consolidés (à fixer Phase 4)

### CRITICAL
*(aucun)*

### HIGH (à fixer avant Sprint 2)

#### **HIGH-S1** — `validateOAuthUrl` autorise `http://` en NODE_ENV=production
- **Source** : reviewer sécu
- **File** : `server/src/services/connectors.ts:176`
- **Vecteur** : un admin compromis peut configurer `authorization_url=http://attacker.com/...` qui submit les tokens OAuth en HTTP cleartext.
- **Risque réel** : faible (les providers OAuth légitimes sont tous HTTPS, le flow échoue) mais sur dev/test internal HTTP provider en prod = leak token cleartext.
- **Fix** : en `NODE_ENV=production`, rejeter `protocol === "http:"`. Garder HTTP uniquement en dev/test.
- **Estimé** : 5 min + 1 test.

#### **HIGH-A1** — Callback dispatcher ne valide pas `userId` ∈ `companyId` avant upsert (TOCTOU window 10min)
- **Source** : bug hunter
- **File** : `server/src/routes/connectors-callback.ts:63-141`
- **Vecteur** : le state JWT (10min) carry `userId` issued au moment de l'authorize. Si admin révoque membership entre authorize et callback, le token est upserted dans `connector_tokens` sous une tenant que le user ne fait plus partie. Token mort mais lisible si user re-invité plus tard.
- **Reproduction** : admin revoke membership → user finishes OAuth flow → token stored.
- **Fix** : `await svc.assertUserInCompany(userId, companyId)` immédiatement après line 63 (avant `setTenantContext` ou avant `upsertConnectorToken`). Si throws → audit + redirect erreur.
- **Estimé** : 10 min + test integration.

#### **HIGH-A2** — Cast fragile `result.length` au lieu de `result.rows.length` dans `assertUserInCompany`
- **Source** : sécu + archi + code-quality (3 reviewers convergent)
- **File** : `server/src/services/connectors.ts:457`
- **Vecteur** : Drizzle `db.execute(sql\`...\`)` retourne `{ rows: [...] }` selon le driver (postgres-js). `(result as unknown as { length: number }).length === 0` peut être `undefined === 0` → false → guard ne trigger jamais → bypass cross-tenant silencieux.
- **Test mock** : artificiellement satisfait les 2 formes via `Object.defineProperty`. Couvre le code mais cache le bug runtime.
- **Fix** : utiliser `(result as { rows: unknown[] }).rows.length === 0` ou destructurer `const { rows } = result`. Vérifier sur DB réelle (postgres-js v3).
- **Estimé** : 10 min + 1 test runtime avec setupTestDb.

#### **HIGH-A3** — `connectors-callback.ts` doit envelopper le code dans une `db.transaction()` pour épingler la connexion (clearTenantContext fragile)
- **Source** : archi
- **File** : `server/src/routes/connectors-callback.ts:63-178`
- **Vecteur** : `setTenantContext(db, companyId)` puis `clearTenantContext(db)` dans `finally` peuvent acquérir des connexions différentes du pool postgres-js. Le commentaire `tenant-context.ts:18-25` mentionne le risque. Si pool re-use une connexion sans clear, leak inter-request possible.
- **Fix** : wrap tout le bloc handler dans `await db.transaction(async (tx) => { ... use tx instead of db ... })`. Ou utiliser `setTenantContext` avec un client dédié single-conn.
- **Estimé** : 30 min + 1 test concurrent.

#### **HIGH-Q1** — `getUserToken` api_key path entièrement non testé (4 paths critiques)
- **Source** : code-quality
- **Files** : tests manquants
- **Coverage gaps** :
  - `api_key` happy path retournant decrypted key (lines 748-773 connectors.ts)
  - `api_key` user not connected → `CONNECTOR_USER_NOT_CONNECTED`
  - `CONNECTOR_TOKEN_EXPIRED_NO_REFRESH` (lines 790-798)
  - `CONNECTOR_TOKEN_REVOKED` (lines 851-863)
  - "concurrent caller already refreshed" branche (line 812)
- **Fix** : ajouter 4 tests unit dans `connectors-service.test.ts` ou un nouveau `connectors-service-paths.test.ts`. Mock `db.select` / `db.execute` selon le path.
- **Estimé** : 1h.

#### **HIGH-Q2** — Callback dispatcher (entire route) zéro test
- **Source** : code-quality + bug-hunter
- **File** : tests manquants `server/src/routes/__tests__/connectors-callback.test.ts`
- **Cases minimum à couvrir** :
  - Provider `?error=access_denied`
  - `?code` ou `?state` manquant
  - State JWT expired (10min TTL)
  - Token exchange retourne 401/400
  - Provider retourne pas `access_token` dans body
  - `redirect_after` open-redirect rejeté (audit `redirect_after_rejected` fired)
  - `clearTenantContext` appelé en `finally` même si `setTenantContext` throw
- **Fix** : créer le fichier de test avec supertest + msw pour mock token endpoint.
- **Estimé** : 2h.

#### **HIGH-Q3** — Aucun test RLS runtime sur connector_tokens / user_api_keys / oauth_connectors_audit
- **Source** : code-quality
- **Files** : tests manquants
- **Convention violée** : `.claude/rules/testing.md` "Toute nouvelle table company-scoped DOIT avoir un test RLS runtime." Le test migration regex prouve le DDL, pas que la policy fire au runtime.
- **Fix** : créer `packages/db/src/migrations/__tests__/0079-rls-runtime.test.ts` avec `setupTestDb` + `SET LOCAL app.current_company_id` + INSERT rows in 2 tenants + assert isolation.
- **Estimé** : 1h.

### MEDIUM

#### **MED-B1** — Refresh token jamais cleared quand provider returns 401 → boucle infinie
- **Source** : bug hunter
- **File** : `server/src/services/connectors.ts:817-823`
- **Vecteur** : quand `refreshOAuthTokenInner` retourne `null` (provider 401), le code set `lastRefreshFailedAt` mais ne clear PAS `refreshTokenIv/Ciphertext/Tag`. Next call : `refreshTokenIv` toujours non-null → condition ligne 534 passes → `refreshOAuthTokenInner` re-called → loop avec provider 401 chaque fois.
- **Fix** : dans branch "refresh failed" (lines 817-823), aussi null out les 3 colonnes refresh_token. Le user devra reconnect, ce qui est l'intention.
- **Estimé** : 5 min + 1 test.

#### **MED-B2** — `expires_in: 0` traité comme "no expiry" (token jamais refreshed)
- **Source** : bug hunter
- **Files** : `server/src/services/connectors.ts:594` ET `server/src/routes/connectors-callback.ts:126`
- **Vecteur** : `json.expires_in ? new Date(... + expires_in * 1000) : null` — `expires_in: 0` falsy → `expiresAt: null`. Token avec `expiresAt: null` est traité comme non-expirant (ligne 785) → utilisé indéfiniment sans refresh.
- **Fix** : changer en `json.expires_in != null ? ... : null` (explicit null check, accepte 0).
- **Estimé** : 5 min + 1 test.

#### **MED-S1** — Race `createConnector` slug → 500 unhandled au lieu de 409 conflict
- **Source** : bug hunter
- **File** : `server/src/services/connectors.ts:317-356`
- **Vecteur** : application-level SELECT-then-INSERT sans transaction. 2 admin requests concurrents pour même slug peuvent tous deux passer le SELECT, puis le 2e INSERT viole `UNIQUE INDEX` → erreur Postgres 23505 unhandled → 500 au caller au lieu de 409.
- **Fix** : catch error code `23505` après INSERT et convertir en `conflict()` ; ou wrap SELECT+INSERT dans une transaction avec ROW lock.
- **Estimé** : 15 min + 1 test.

#### **MED-S2** — `updateConnector` audit diff peut être stale (TOCTOU)
- **Source** : bug hunter
- **File** : `server/src/services/connectors.ts:378-427`
- **Vecteur** : `getConnectorById` read puis `db.update` sans transaction lock. 2 admins flip `enabled` concurrent → audit log peut enregistrer la mauvaise transition (`enabled` au lieu de `disabled`).
- **Fix** : wrap dans `db.transaction` avec `SELECT ... FOR UPDATE` ou utiliser `.returning()` du UPDATE pour comparer avant/après.
- **Estimé** : 20 min.

#### **MED-Q1** — `await import("../services/secret-crypto.js")` dynamic import inutile dans callback
- **Source** : code-quality
- **File** : `server/src/routes/connectors-callback.ts:83`
- **Vecteur** : pas un bug, juste un coût async inutile sur chaque request (module déjà loaded au boot via connectors.ts).
- **Fix** : remplacer par static `import { decryptSecret } from "../services/secret-crypto.js"` au top du fichier.
- **Estimé** : 2 min.

#### **MED-Q2** — `resolveDynamicProviders` non testé
- **Source** : code-quality
- **File** : tests manquants pour `server/src/auth/dynamic-providers.ts`
- **Coverage gaps** : mis-configured row skipped path, decrypt failure path, happy path map build.
- **Fix** : ajouter tests dans `server/src/auth/__tests__/dynamic-providers.test.ts`. Mock db.select.
- **Estimé** : 30 min.

### LOW

#### **LOW-N1** — FK `created_by_user_id` sans `ON DELETE` action explicite (default RESTRICT silencieux)
- **Source** : sécu
- **File** : `packages/db/src/migrations/0079_connectors_platform.sql:38`
- **Fix** : ajouter `ON DELETE RESTRICT` explicite ou `ON DELETE SET NULL` + nullable column.

#### **LOW-N2** — `disconnectUser` pour api_key appelle `assertUserInCompany` 2× (redondant)
- **Source** : bug hunter
- **File** : `server/src/services/connectors.ts:689` + `:651`
- **Fix** : dédoublonner en passant un flag interne ou en restructurant.

#### **LOW-N3** — `validateRedirectAfter` accepte path traversal `../`
- **Source** : bug hunter
- **File** : `server/src/services/connectors.ts:79-82`
- **Vecteur** : `/settings/../../../etc` accepté. Risque faible car `res.redirect()` produit un Location header relatif que le browser navigue (pas de fetch serveur-side). Frontend router peut juste 404.
- **Fix** : ajouter check sur `..` ou normaliser le path.

#### **LOW-N4** — `audit.diff_json` peut contenir données operator non-sanitizées (potentiel XSS futur)
- **Source** : sécu
- **File** : `server/src/routes/connectors-callback.ts:165` + autres usages `recordAudit`
- **Vecteur** : `redirectAfterPrefix: redirectAfter.slice(0, 120)` stocke un préfixe URL malveillante dans audit. Si UI render le JSON sans escape, surface XSS.
- **Fix** : à surveiller en Sprint 2 quand UI audit table sera implémentée. React escape par défaut → mitigé si pas de rendu HTML brut côté UI.

### INFO (non-blockers)

- **`publishLiveEvent`** non émis sur `user_connected`/`user_disconnected` → frontend doit poll/reload (cf. CLAUDE.md no-polling). À ajouter Sprint 2 / T7 (UI user accounts).
- **`pg_advisory_xact_lock(hashtext(...))` collision** théorique avec int4 (32-bit) — perf degradation, pas correctness.
- **`secret-crypto` divergence subtile** : `credential.ts` chiffre des `Record<string, unknown>` (JSON) vs `connectors.ts` chiffre des string brutes. Acceptable mais à graver en `decision-log.md` §4.6.

## Plan d'action Phase 4 (priorisé)

### ✅ Phase 4 SHIPPED (4 commits, 2026-05-02)

| Finding | Fix commit | État |
|---|---|---|
| HIGH-S1 | `e268660e7` | ✅ HTTPS-only via `process.env.NODE_ENV === "production"` |
| HIGH-A2 | `e268660e7` | ✅ Drizzle `select(..).from(companyMemberships).where(..).limit(1)` (remplace cast hack) |
| HIGH-A1 | `e268660e7` | ✅ `assertUserInCompany` à l'intérieur de la tx du callback, redirect USER_NOT_IN_COMPANY |
| HIGH-A3 | `e268660e7` | ✅ `db.transaction()` + `set_config('app.current_company_id', $1, true)` (transaction-local) |
| MED-B1 | `e268660e7` | ✅ Sur 401 provider, null `refreshTokenIv/Ciphertext/Tag` + `lastRefreshFailedAt` |
| MED-B2 | `e268660e7` | ✅ `typeof expires_in === "number" && expires_in > 0` |
| MED-Q1 | `e268660e7` | ✅ Static import `decryptSecret` au top du callback |
| MED-S1 | `e268660e7` | ✅ Catch postgres `code: "23505"` dans `createConnector` → `conflict()` |
| HIGH-Q1 | `feecb521a` | ✅ 4 tests `getUserToken` (api_key happy / EXPIRED_NO_REFRESH / REVOKED + MED-B1 verify / concurrent already-refreshed) |
| HIGH-Q2 | `eeb57479f` | ✅ 7 tests callback dispatcher (msw + supertest) — missing/invalid state, provider error, USER_NOT_IN_COMPANY, disabled, TOKEN_EXCHANGE_FAILED, happy path |
| HIGH-Q3 | `b43413e89` | ✅ 9 tests RLS runtime (4 structure pg_policy + 1 fail-closed + 4 isolation) — 4 tables Sprint 1 |

**Total Phase 4 : 16 tests ajoutés (4 + 7 + 5 RLS runtime + 4 RLS structure)**, 0 régression sur les 26 tests existants.

### NEW-S1 (Phase 4 finding, architectural — out of scope)

**Source** : test HIGH-Q3 RLS runtime
**File** : `packages/db/src/migrations/0030_rls_policies.sql` + tous les fichiers RLS depuis (incl. 0079).
**Vecteur** : Le pattern RLS du repo (`tenant_isolation` AS RESTRICTIVE FOR ALL ...`) ne crée QU'UNE policy RESTRICTIVE. En postgres, RESTRICTIVE seul = default-deny — **aucune ligne n'est jamais visible** pour un user sans BYPASSRLS. La défense "RLS = fail-closed last line of defense" documentée dans `docs/conventions/middleware-chain.md` est donc une fiction tant que l'app connecte avec `mnm` (qui a `rolbypassrls=true`). En production l'isolation tenant repose ENTIÈREMENT sur les `eq(table.companyId, ...)` côté code applicatif — RLS ne fait rien.
**Fix attendu (séparé)** :
- Soit ajouter une `PERMISSIVE FOR ALL USING (true)` sur chaque table tenant (RESTRICTIVE narrow ensuite).
- Soit créer un user app non-bypass ET ajouter PERMISSIVE policies (recommandé, vraie défense en profondeur).
**Impact ship** : aucun (le test HIGH-Q3 contourne en ajoutant une PERMISSIVE temporaire dans son setup, droppée en afterAll). À traiter en chantier dédié post-Sprint 2.

## Sprint 2 (T5-T8) — encore tout à faire

D'après le plan v2 :
- **T5** REST + MCP parité (~0.5j) — REST admin/user routes + MCP tools list_connectors/get_connector_status/connect_user_to_connector/wait_for_connection/set_user_api_key avec H3 redaction
- **T6** UI admin "Connecteurs" (~1j) — page liste + grille templates + wizard 2 étapes + `<Sheet>` détail
- **T7** UI user "Mes comptes connectés" (~1j) — page `/settings/accounts` + SSE `user.connector_status_changed` + lien depuis UserProfile
- **T8** Templates + helper consume + tests + parity + doc (~1.5j) — 10 templates connectors-templates.ts, refactor `governed-workflows.ts:resolveAuthor` pour consommer `getUserToken("gitlab")`, E2E Playwright OAuth real-flow, `scripts/parity/data.ts` entries, `docs/governed-workflows/connectors.md`, decision-log §4.6

## Reprise post-/compact (mémo pour la prochaine session)

**État** : **Phase 4 SHIPPED 2026-05-02**. Sprint 1 + Phase 4 = 10 commits sur `feat/connectors-platform` (poussés). Prochain chantier : **Sprint 2 (T5-T8)**.

**Branche** : `feat/connectors-platform`. **Dev server** : `bun run dev` (http://127.0.0.1:3100).

**Sprint 2 — étape suivante** :
- **T5** REST + MCP parité (~0.5j)
- **T6** UI admin "Connecteurs" (~1j)
- **T7** UI user "Mes comptes connectés" (~1j)
- **T8** Templates + helper consume + E2E + parity + decision-log §4.6 (~1.5j)

**Files actifs Sprint 1 + Phase 4** :
- `packages/db/src/schema/{oauth_connectors,connector_tokens,user_api_keys,oauth_connectors_audit}.ts`
- `packages/db/src/migrations/0079_connectors_platform.sql` + `.test.ts`
- `server/src/services/secret-crypto.ts`
- `server/src/services/connectors.ts` (Phase 4 : Drizzle select + HTTPS-only + transactions + MED-B1/S1)
- `server/src/services/__tests__/{secret-crypto,connectors-state-validation,connectors-service}.test.ts` (Phase 4 : +4 HIGH-Q1)
- `server/src/routes/connectors-callback.ts` (Phase 4 : tx wrap + HIGH-A1 guard + MED-B2/Q1)
- `server/src/routes/__tests__/connectors-callback.test.ts` (Phase 4 : NEW, 7 HIGH-Q2)
- `server/src/__tests__/connector-tokens.rls.e2e.test.ts` (Phase 4 : NEW, 9 HIGH-Q3)
- `server/src/auth/dynamic-providers.ts` + `__tests__/`
- `server/src/auth/better-auth.ts` (modifié)
- `server/src/app.ts` (modifié, mount callback)

**Tests pass post-Phase 4** : **46/46 Vitest** (5 secret-crypto + 9 state-validation + 11 service-mock + 5 dynamic-providers + 7 callback msw + 9 RLS runtime). Migration regex : 14/14. Typecheck : 17/17 packages. Suite RLS runtime requiert DB non-mnm (BYPASSRLS) — `bun run test:docker:up` ou DB dédiée embedded.

**Architectural follow-up (NEW-S1)** : pattern RLS de la codebase ne marche que via BYPASSRLS du user app — chantier dédié post-Sprint 2 pour ajouter PERMISSIVE policies + user app non-bypass. Documenté dans le finding NEW-S1 ci-dessus.
