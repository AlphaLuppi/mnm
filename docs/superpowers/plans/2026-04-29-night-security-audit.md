# Night Security Audit — MnM (2026-04-29 → 2026-04-30)

**Mission de Tom (autonome jusqu'à son réveil) :**

> Audit sécurité / pentesting GIGA mega sur toute la plateforme MnM.
> 10 agents teams successives. 4–10 agents spécialisés par team (whitehat / redhat / blackhat).
> Couvrir TOUTES les surfaces, de la faille la plus simple à la plus critique.
> Outils et techniques connus ET moins connus.
> Survivre aux /compact automatiques, reprendre le travail seul derrière.
> Minimum 3 teams en parallèle.
> Une dernière team fix les trouvailles.
> Document récap final.
>
> **Objectif** : que MnM passe l'audit de sécurité le plus dur de la planète sans souci.

---

## Périmètre cible (MnM)

- **Backend** : `server/src/` (Express, BetterAuth, Drizzle ORM, PostgreSQL, RLS, multi-tenant, RBAC dynamique, tag-scope, traces, gates, MCP)
- **Frontend** : `ui/src/` (React 18, Vite, SSE, WS, Monaco, AI Assistant)
- **Packages** : `packages/{adapters,gate-runner,git-provider,governed-workflows,db,shared,mnm-plugin}`
- **Desktop** : `apps/desktop/src-tauri/`
- **Plugins** : `plugins/`
- **Edition entreprise** : `ee/`
- **Infra** : `Dockerfile`, `docker-compose*.yml`, `.github/`, `cli/`
- **CI/CD** : `.github/workflows/`
- **Configs sensibles** : `.env*`, `drizzle.config*`, secrets/

## Hors périmètre

- `_bmad/` (framework externe, ne pas modifier)
- `node_modules/` (mais on audite les dépendances via npm/bun audit)
- `releases/` (artefacts buildés)

## Règles d'audit

1. **Lecture exhaustive** : chaque team lit le code en profondeur, pas juste grep surface.
2. **Tools libres** : `bun audit`, `npm audit`, `gitnexus`, `grep` (regex avancé), recherche manuelle, raisonnement sur threat models.
3. **Pas d'attaque réelle externe** : on est en whitebox, pas de scan public.
4. **Documenter chaque finding** dans `_bmad-output/security-audit-2026-04-29/findings/<team>/<id>.md` avec le format :
   ```
   ID: SEC-<team>-<n>
   Severity: critical | high | medium | low | info
   Category: OWASP / CWE
   Title: ...
   File: path:line
   Description: ...
   Impact: ...
   Reproduction: ...
   Recommendation: ...
   References: ...
   ```
5. **Severity levels** :
   - `critical` : RCE, auth bypass, mass data exfiltration, multi-tenant breach
   - `high` : privilege escalation, SQLi, XSS stored, secret leak
   - `medium` : XSS reflected, CSRF, info disclosure, weak crypto, DoS facile
   - `low` : verbose errors, missing headers, weak defaults
   - `info` : best-practice gaps, hardening opportunities
6. **Pas de fix pendant la phase recon** — on collecte d'abord, on fixe à la fin.

---

## Waves d'attaque (10 teams + 1 fix team)

> Chaque wave ≥ 3 teams en parallèle. Wave suivante ne démarre qu'à la fin de la précédente.

### Wave 1 — Foundations (3 teams parallèles)

**T1. Authentication & Session** (4 agents)
- BetterAuth config, JWT signing/verification, refresh tokens, OAuth 2.1 PKCE
- Session fixation, replay, theft, cookie flags (Secure/HttpOnly/SameSite)
- Password reset / magic link flows
- `agent-auth-jwt.ts`, `auth/`, `routes/auth.ts`

**T2. Multi-tenant Isolation** (5 agents)
- `assertCompanyMembership` middleware bypass
- `tenantContextMiddleware` RLS context (`app.current_company_id`)
- `tagScopeMiddleware` cross-tag leakage
- IDOR sur `/companies/:companyId/...` routes
- Race conditions sur switching company
- Postgres RLS policies (toutes les tables tenant-scoped)

**T3. SQL/ORM Injection** (4 agents)
- Drizzle query builder safety (raw `sql` template, `sql.raw`, dynamic table names)
- Prepared statements vs concatenation
- Migrations (`packages/db/src/migrations/`) injection
- Ordering / LIMIT / OFFSET injection via query params

### Wave 2 — Surface (3 teams parallèles)

**T4. XSS / CSRF / Frontend** (5 agents)
- Audit des injections HTML directes (`dangerouslySet*`, raw HTML rendering)
- React DOM sinks (href, src, eval)
- CSP headers, Trusted Types
- CSRF tokens / SameSite, double-submit, origin checks
- Markdown rendering, JSON rendering, Monaco editor injection
- AI Assistant Panel: indirect prompt injection via workflow.json

**T5. API & Endpoint Hardening** (6 agents)
- Rate limiting per-tenant correctness, bypass via header tampering
- Input validation (Zod schemas everywhere ?)
- Mass assignment, parameter pollution
- Error verbosity (stack traces leaked ?)
- HTTP method confusion
- File upload validation (size, MIME, magic bytes)

**T6. Secrets & Credentials** (4 agents)
- `.env*` leakage, `process.env` references
- Hardcoded secrets in code/migrations/seeds
- Secret rotation, ephemeral creds
- `secrets/` directory exposure
- Logs redaction (`server/src/redaction.ts`)
- API keys for adapters (Claude, OpenAI, etc.)

### Wave 3 — Advanced (3 teams parallèles)

**T7. Supply Chain & Dependencies** (4 agents)
- `bun audit` / `npm audit` full report
- Lockfile integrity (`bun.lock`)
- Postinstall scripts
- Prototype pollution patterns
- Typosquatting / abandoned packages
- `package.json` resolutions / overrides

**T8. WebSocket / SSE Security** (5 agents)
- `/events/ws` auth on connect, on each message
- Subscription scoping (companyId, tags)
- Message tampering, replay
- DoS via large messages / connection floods
- Heartbeat / reconnect logic
- `realtime/` directory deep dive

**T9. LLM / Prompt Injection** (6 agents)
- `claude -p` invocations: argv injection, command injection
- AI Assistant: indirect prompt injection via workflow content
- System prompt extraction
- Tool-call manipulation (CAO interactive)
- Trace LLM enrichment poisoning
- MCP server boundary (`server/src/mcp/`)
- Token cost amplification attacks (forced expensive prompts)

### Wave 4 — Wildcards (2 teams parallèles)

**T10. Infra / DevOps / Tauri** (5 agents)
- Dockerfile USER, secrets in layers, COPY .env
- docker-compose privileges, network segmentation
- Tauri capabilities, allowlist, IPC
- CI/CD secrets in workflows
- Release signing, auto-update channel
- CORS config, exposed dev ports

**T11. Wildcard Creative Recon** (4 agents)
- Business logic flaws (e.g., bypass quotas, free-tier abuse)
- Race conditions cross-request (TOCTOU)
- Cryptographic primitives misuse (timing leaks, weak RNG)
- Logging side channels
- Time-based attacks
- Cache poisoning
- Anything weird/clever the other teams missed

### Final — Fix Team (8 agents, sequential)

**T-FIX. Hardening Squad**
1. Read `VULNERABILITIES.md` (consolidated findings)
2. Triage by severity
3. Fix critical → high → medium (low/info documented but not auto-fixed unless trivial)
4. Each fix:
   - Patch code with minimal diff
   - Add regression test where possible
   - Update finding file with `Status: fixed (commit <sha>)` and `Fix: <description>`
5. Run `bun run typecheck` + `bun run build` + relevant tests after each batch
6. Atomic commits per finding cluster: `fix(security): SEC-T2-3 — multi-tenant assertCompanyMembership UUID strict check`
7. Push immediately after each commit (atomic commit + push rule)

---

## Outputs

```
_bmad-output/security-audit-2026-04-29/
├── findings/
│   ├── T1-auth/
│   ├── T2-multitenant/
│   ├── T3-sqlorm/
│   ├── T4-xss-csrf/
│   ├── T5-api-hardening/
│   ├── T6-secrets/
│   ├── T7-supply-chain/
│   ├── T8-ws-sse/
│   ├── T9-llm-prompt-injection/
│   ├── T10-infra-tauri/
│   └── T11-wildcard/
├── VULNERABILITIES.md           # Consolidated table (id, severity, file, status)
├── progress.md                  # Live progress log (resumable after /compact)
└── SECURITY-AUDIT-REPORT.md     # Final exec summary + remediation log
```

## Survivre au /compact

**Si /compact se déclenche :**
1. Relire ce plan (`docs/superpowers/plans/2026-04-29-night-security-audit.md`)
2. Relire le progress log (`_bmad-output/security-audit-2026-04-29/progress.md`)
3. `git log --oneline -30` pour voir les fix commits déjà poussés
4. `ls _bmad-output/security-audit-2026-04-29/findings/*/` pour voir les findings posées
5. Reprendre à la prochaine étape `[ ] pending` du progress log
6. Si une team a été interrompue, la relancer avec son brief original (recopié dans le progress log)

## Critères de succès

- [ ] 10 teams recon ont rendu leur rapport
- [ ] `VULNERABILITIES.md` consolidé
- [ ] Tous les findings critical + high fixés (commit + push)
- [ ] `bun run typecheck` passe
- [ ] `bun run build` passe
- [ ] `SECURITY-AUDIT-REPORT.md` complet et lisible par un humain
- [ ] Aucun secret commité par accident
- [ ] Aucune régression fonctionnelle introduite

## Risques & garde-fous

- **Régressions** : chaque fix doit garder l'app fonctionnelle. Si un fix casse, le reverter et flagger en `needs-design`.
- **Faux positifs** : les agents recon peuvent halluciner. La fix team doit re-vérifier chaque finding contre le code actuel avant patch.
- **Scope creep** : on ne refactore pas l'archi pour fixer une faille. Patch minimal.
- **Secrets** : si un finding dit "secret X est dans le code", NE PAS recopier le secret dans VULNERABILITIES.md. Juste référencer file:line.
