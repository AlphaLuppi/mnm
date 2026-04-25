# Plan d'implémentation — Workflow démo EnterpriseCustomer `feature-dev`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un workflow MnM gouverné `feature-dev` complet (workflow.json + 2 gates custom + 4 agents) hébergé sur `lab.enterprise.example/tom.andrieu/`, prêt à dérouler en live pour la démo plénière EnterpriseCustomer en 5-10 min.

**Architecture:** Deux repos GitLab séparés sur `lab.enterprise.example/tom.andrieu/` — `mnm-demo-workflows` (héberge le workflow + gates + agents) et `mnm-demo-app` (le repo "feature" où le dev se passe). Les gates custom (`approval-granted`, `mr-approved`) sont du TS pur, sans accès réseau (isolated-vm), qui lisent l'artifact du step. L'agent `review-watcher` fait l'appel MCP GitLab et produit l'artifact que la gate `mr-approved` vérifiera.

**Tech Stack:** TypeScript (gates), `@mnm/governed-workflows` (defineGate), vitest (tests gates), bun (test runner du repo demo-app), MCP `mcp__plugin_atlassian_atlassian__*` (lecture Jira), MCP `mcp__plugin_gitlab_gitlab__*` (branche, MR, approvals, merge, tag).

**Spec source:** [`docs/superpowers/specs/2026-04-25-feature-dev-workflow-design.md`](../specs/2026-04-25-feature-dev-workflow-design.md)

---

## File Structure

Tous les chemins ci-dessous sont **dans un dossier de travail local hors du repo `mnm`**, par exemple `~/IdeaProjects/perso/alphalup/mnm-demo-workflows/` et `~/IdeaProjects/perso/alphalup/mnm-demo-app/`. Ces deux dossiers seront poussés en repos distincts sur `lab.enterprise.example/tom.andrieu/`.

### Repo `mnm-demo-workflows`

```
mnm-demo-workflows/
├── README.md                              # pitch + usage 10 lignes
├── package.json                           # vitest, typescript, @mnm/governed-workflows
├── tsconfig.json                          # strict, NodeNext
├── vitest.config.ts                       # défauts vitest
├── workflow.json                          # définition du workflow (4 steps)
├── .gitignore                             # node_modules, dist, .env
├── gates/
│   ├── approval-granted.gate.ts           # nouvelle, custom
│   ├── approval-granted.gate.test.ts
│   ├── mr-approved.gate.ts                # nouvelle, custom
│   ├── mr-approved.gate.test.ts
│   ├── artifact-exists.gate.ts            # copie de packages/gate-runner/canonical/
│   └── step-succeeded.gate.ts             # copie de packages/gate-runner/canonical/
└── agents/
    ├── senior-dev.md                      # prompt système + outils
    ├── dev.md
    ├── review-watcher.md
    └── release-mgr.md
```

### Repo `mnm-demo-app`

```
mnm-demo-app/
├── README.md                              # 1 paragraphe — c'est le repo "feature"
├── package.json                           # bun + vitest
├── tsconfig.json
├── .gitignore
└── src/
    ├── format.ts                          # fonction triviale (formatPrice ou autre)
    └── format.test.ts                     # 1 test qui passe
```

### Ressources externes (manuel / CLI)

- Projet GitLab `lab.enterprise.example/example-org/mnm-demo-workflows` (créé via CLI/UI)
- Projet GitLab `lab.enterprise.example/example-org/mnm-demo-app` (créé via CLI/UI, branche par défaut protégée avec règle "≥ 2 approvals")
- Ticket Jira `AY-DEMO-1` (créé via UI Atlassian ou MCP)
- 2 comptes lab.enterprise.example pour pouvoir approuver les MR (Tom + un compte secondaire ou collègue)

---

## Task 1 : Bootstrap du repo `mnm-demo-workflows`

**Files:**
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-workflows/.gitignore`
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-workflows/package.json`
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-workflows/tsconfig.json`
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-workflows/vitest.config.ts`
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-workflows/README.md`

- [ ] **Step 1.1 : Créer le dossier et initialiser git**

```bash
mkdir -p ~/IdeaProjects/perso/alphalup/mnm-demo-workflows
cd ~/IdeaProjects/perso/alphalup/mnm-demo-workflows
git init -b main
```

- [ ] **Step 1.2 : Créer `.gitignore`**

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

- [ ] **Step 1.3 : Créer `package.json`**

```json
{
  "name": "mnm-demo-workflows",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@mnm/governed-workflows": "file:../mnm/packages/governed-workflows",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

> **Note** : la dépendance `@mnm/governed-workflows` pointe en `file:` vers le repo `mnm` local. Au moment du déploiement final, on remplacera par la version publiée si elle existe — sinon on conserve un import relatif (voir Task 2).

- [ ] **Step 1.4 : Créer `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["gates/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 1.5 : Créer `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["gates/**/*.test.ts"],
  },
});
```

- [ ] **Step 1.6 : Créer `README.md`**

```markdown
# mnm-demo-workflows

Workflow MnM démo EnterpriseCustomer — `feature-dev` : de Jira à la prod, gouverné en 4 steps.

## Lancer

```bash
# Côté MnM, depuis Claude Code :
launch_governed_workflow(
  name: "feature-dev",
  variables: {
    ticket_id: "AY-DEMO-1",
    gitlab_project: "example-org/mnm-demo-app"
  }
)
```

## Steps

1. `tech-design` — agent senior-dev lit Jira, écrit `design.md`, demande approbation explicite.
2. `dev` — agent dev code la feature, ouvre une MR.
3. `review` — agent review-watcher attend ≥ 2 approvals humains sur GitLab.
4. `merge-tag` — agent release-mgr merge, tague, génère `changelog.md`.

## Gates custom

- `approval-granted.gate.ts` — vérifie `artifact.approval.granted === true`.
- `mr-approved.gate.ts` — vérifie `artifact.approvals_count >= config.min_approvals`.

## Tests

```bash
npm install
npm test
```
```

- [ ] **Step 1.7 : Installer les dépendances et committer**

```bash
npm install
git add .
git commit -m "chore: bootstrap mnm-demo-workflows scaffold"
```

Expected: install OK, commit créé.

---

## Task 2 : Copier les gates canonical (artifact-exists, step-succeeded)

**Files:**
- Create: `gates/artifact-exists.gate.ts` (copie 1:1 de `mnm/packages/gate-runner/canonical/artifact-exists.gate.ts`)
- Create: `gates/step-succeeded.gate.ts` (copie 1:1 de `mnm/packages/gate-runner/canonical/step-succeeded.gate.ts`)

**Pourquoi copier et pas symlink** : le runtime MnM fetch les gates depuis le sha pinné du repo de workflows. Le repo doit être self-contained. Pas de symlink cross-repo.

- [ ] **Step 2.1 : Copier `artifact-exists.gate.ts`**

Source : `~/IdeaProjects/perso/alphalup/mnm/packages/gate-runner/canonical/artifact-exists.gate.ts`
Dest : `~/IdeaProjects/perso/alphalup/mnm-demo-workflows/gates/artifact-exists.gate.ts`

```bash
cp ~/IdeaProjects/perso/alphalup/mnm/packages/gate-runner/canonical/artifact-exists.gate.ts \
   ~/IdeaProjects/perso/alphalup/mnm-demo-workflows/gates/artifact-exists.gate.ts
```

- [ ] **Step 2.2 : Copier `step-succeeded.gate.ts`**

```bash
cp ~/IdeaProjects/perso/alphalup/mnm/packages/gate-runner/canonical/step-succeeded.gate.ts \
   ~/IdeaProjects/perso/alphalup/mnm-demo-workflows/gates/step-succeeded.gate.ts
```

- [ ] **Step 2.3 : Vérifier que TypeScript compile (typecheck)**

```bash
cd ~/IdeaProjects/perso/alphalup/mnm-demo-workflows
npm run typecheck
```

Expected: pas d'erreur. Si l'import `@mnm/governed-workflows` échoue, vérifier que `file:../mnm/packages/governed-workflows` est bien résolu — la commande `npm install` a-t-elle créé un lien dans `node_modules/@mnm/governed-workflows` ? Sinon : `cd ../mnm/packages/governed-workflows && bun run build` puis re-`npm install` côté demo-workflows.

- [ ] **Step 2.4 : Commit**

```bash
git add gates/
git commit -m "feat(gates): import canonical artifact-exists + step-succeeded"
```

---

## Task 3 : Implémenter `approval-granted.gate.ts` (TDD)

**Files:**
- Create: `gates/approval-granted.gate.test.ts`
- Create: `gates/approval-granted.gate.ts`

**Spec de référence:** §5.1 du spec.

- [ ] **Step 3.1 : Écrire le test pour le cas nominal (approval valide)**

Create `gates/approval-granted.gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import gate from "./approval-granted.gate.js";
import type { GateContext } from "@mnm/governed-workflows";

function makeCtx(artifact: unknown): GateContext {
  return {
    artifact,
    run: { id: "r1", workflow_name: "feature-dev", git_tag: "v0", params: {} },
    step: { id: "tech-design", previous_artifacts: {} },
    config: {},
    kind: "exit",
    helpers: {},
  };
}

describe("approval-granted gate", () => {
  it("passe si approval.granted=true et tous les champs valides", async () => {
    const out = await gate(makeCtx({
      approval: {
        granted: true,
        by: "tom",
        message: "APPROUVÉ — OK pour implémentation",
        ts: "2026-04-25T14:32:00Z",
      },
    }));
    expect(out.pass).toBe(true);
    expect(out.report).toContain("tom");
  });
});
```

- [ ] **Step 3.2 : Run test, vérifier qu'il échoue (gate pas encore créée)**

```bash
npm test -- approval-granted
```

Expected: FAIL (`approval-granted.gate.js` introuvable).

- [ ] **Step 3.3 : Implémenter la gate, version minimale qui passe le test nominal**

Create `gates/approval-granted.gate.ts`:

```ts
/**
 * Custom gate: approval-granted
 *
 * Vérifie qu'un humain a explicitement approuvé l'artifact courant. L'agent
 * du step (typiquement un agent Claude Code interactif) DOIT afficher un
 * message d'approbation à l'utilisateur, attendre sa réponse, et structurer
 * la réponse dans `artifact.approval`.
 *
 * Expected artifact shape:
 *   { approval: { granted: boolean, by: string, message: string, ts: string } }
 *
 * Error codes:
 *   - APPROVAL_MISSING       — `approval` absent ou non-objet.
 *   - APPROVAL_REJECTED      — granted !== true.
 *   - APPROVAL_INCOMPLETE    — by/message vide ou non-string.
 *   - APPROVAL_INVALID_TS    — ts manquant ou pas ISO 8601.
 */
import { defineGate } from "@mnm/governed-workflows";

interface ApprovalArtifact {
  approval?: {
    granted?: unknown;
    by?: unknown;
    message?: unknown;
    ts?: unknown;
  };
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export default defineGate<ApprovalArtifact>(async (ctx) => {
  const a = ctx.artifact;
  if (!a || typeof a !== "object" || !a.approval || typeof a.approval !== "object") {
    return {
      pass: false,
      error_code: "APPROVAL_MISSING",
      report: "approval-granted: artifact.approval is missing",
      hints: [
        "Ensure the step agent produces { approval: { granted, by, message, ts } } after asking the user.",
      ],
    };
  }
  const { granted, by, message, ts } = a.approval;
  if (granted !== true) {
    return {
      pass: false,
      error_code: "APPROVAL_REJECTED",
      report: `approval-granted: rejected (granted=${String(granted)}, message=${typeof message === "string" ? message : "<n/a>"})`,
    };
  }
  if (typeof by !== "string" || by.length === 0 || typeof message !== "string" || message.length === 0) {
    return {
      pass: false,
      error_code: "APPROVAL_INCOMPLETE",
      report: "approval-granted: approval.by and approval.message must be non-empty strings",
    };
  }
  if (typeof ts !== "string" || !ISO_RE.test(ts)) {
    return {
      pass: false,
      error_code: "APPROVAL_INVALID_TS",
      report: `approval-granted: approval.ts must be ISO 8601 (got ${typeof ts === "string" ? ts : typeof ts})`,
    };
  }
  return {
    pass: true,
    report: `approval-granted: approved by ${by} at ${ts}`,
  };
});
```

- [ ] **Step 3.4 : Run test, vérifier que le cas nominal passe**

```bash
npm test -- approval-granted
```

Expected: PASS (1 test).

- [ ] **Step 3.5 : Ajouter les tests pour les 4 cas d'échec**

Append à `gates/approval-granted.gate.test.ts` (à l'intérieur du `describe`) :

```ts
  it("échoue avec APPROVAL_MISSING si approval absent", async () => {
    const out = await gate(makeCtx({}));
    expect(out.pass).toBe(false);
    expect(out.error_code).toBe("APPROVAL_MISSING");
  });

  it("échoue avec APPROVAL_REJECTED si granted=false", async () => {
    const out = await gate(makeCtx({
      approval: { granted: false, by: "tom", message: "REJETÉ — manque tests", ts: "2026-04-25T14:32:00Z" },
    }));
    expect(out.pass).toBe(false);
    expect(out.error_code).toBe("APPROVAL_REJECTED");
    expect(out.report).toContain("REJETÉ");
  });

  it("échoue avec APPROVAL_INCOMPLETE si by ou message vide", async () => {
    const out = await gate(makeCtx({
      approval: { granted: true, by: "", message: "x", ts: "2026-04-25T14:32:00Z" },
    }));
    expect(out.pass).toBe(false);
    expect(out.error_code).toBe("APPROVAL_INCOMPLETE");
  });

  it("échoue avec APPROVAL_INVALID_TS si ts non-ISO", async () => {
    const out = await gate(makeCtx({
      approval: { granted: true, by: "tom", message: "ok", ts: "hier" },
    }));
    expect(out.pass).toBe(false);
    expect(out.error_code).toBe("APPROVAL_INVALID_TS");
  });
```

- [ ] **Step 3.6 : Run tous les tests, vérifier qu'ils passent**

```bash
npm test -- approval-granted
```

Expected: 5 tests passent.

- [ ] **Step 3.7 : Commit**

```bash
git add gates/approval-granted.gate.ts gates/approval-granted.gate.test.ts
git commit -m "feat(gates): add approval-granted gate with TDD"
```

---

## Task 4 : Implémenter `mr-approved.gate.ts` (TDD)

**Files:**
- Create: `gates/mr-approved.gate.test.ts`
- Create: `gates/mr-approved.gate.ts`

**Spec de référence:** §5.2 du spec.

**Important** : la gate ne fait PAS d'appel réseau (isolated-vm). Elle lit l'artifact `{ approvals_count, mr_iid, mr_url, checked_at, ... }` produit par l'agent `review-watcher`.

- [ ] **Step 4.1 : Écrire le test pour le cas nominal (≥ min_approvals)**

Create `gates/mr-approved.gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import gate from "./mr-approved.gate.js";
import type { GateContext } from "@mnm/governed-workflows";

function makeCtx(opts: { artifact: unknown; config: Record<string, unknown> }): GateContext {
  return {
    artifact: opts.artifact,
    run: { id: "r1", workflow_name: "feature-dev", git_tag: "v0", params: {} },
    step: { id: "review", previous_artifacts: {} },
    config: opts.config,
    kind: "exit",
    helpers: {},
  };
}

const VALID_ARTIFACT = {
  gitlab_project: "example-org/mnm-demo-app",
  mr_iid: 42,
  mr_url: "https://lab.enterprise.example/example-org/mnm-demo-app/-/merge_requests/42",
  approvals_count: 2,
  approvers: ["alice", "bob"],
  checked_at: "2026-04-25T14:32:00Z",
};

describe("mr-approved gate", () => {
  it("passe si approvals_count >= min_approvals et tous les refs présents", async () => {
    const out = await gate(makeCtx({ artifact: VALID_ARTIFACT, config: { min_approvals: 2 } }));
    expect(out.pass).toBe(true);
    expect(out.report).toContain("MR !42");
    expect(out.report).toContain("2/2");
  });
});
```

- [ ] **Step 4.2 : Run test, vérifier qu'il échoue (gate pas encore créée)**

```bash
npm test -- mr-approved
```

Expected: FAIL.

- [ ] **Step 4.3 : Implémenter la gate**

Create `gates/mr-approved.gate.ts`:

```ts
/**
 * Custom gate: mr-approved
 *
 * Vérifie qu'une MR GitLab a obtenu un nombre minimum d'approbations
 * humaines. La gate s'exécute en isolated-vm (pas de réseau, pas de fs) :
 * elle lit `artifact.approvals_count` produit par l'agent `review-watcher`
 * (qui a fait l'appel MCP GitLab).
 *
 * Expected artifact shape:
 *   {
 *     gitlab_project:  string,
 *     mr_iid:          number,
 *     mr_url:          string,
 *     approvals_count: number,
 *     approvers?:      string[],
 *     checked_at:      string  // ISO 8601
 *   }
 *
 * Config:
 *   - min_approvals (required, number >= 1)
 *
 * Error codes:
 *   - GATE_INVALID_CONFIG       — min_approvals manquant ou invalide.
 *   - MR_REF_MISSING            — mr_iid ou mr_url absent.
 *   - MR_STATUS_MISSING         — approvals_count absent ou non-numérique.
 *   - STALE_CHECK               — checked_at absent ou pas ISO 8601.
 *   - APPROVALS_INSUFFICIENT    — approvals_count < min_approvals.
 */
import { defineGate } from "@mnm/governed-workflows";

interface MrArtifact {
  gitlab_project?: unknown;
  mr_iid?: unknown;
  mr_url?: unknown;
  approvals_count?: unknown;
  approvers?: unknown;
  checked_at?: unknown;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export default defineGate<MrArtifact, { min_approvals?: unknown }>(async (ctx) => {
  const minApprovals = ctx.config.min_approvals;
  if (typeof minApprovals !== "number" || !Number.isFinite(minApprovals) || minApprovals < 1) {
    return {
      pass: false,
      error_code: "GATE_INVALID_CONFIG",
      report: "mr-approved: config.min_approvals must be a number >= 1",
    };
  }

  const a = ctx.artifact ?? {};
  const { gitlab_project, mr_iid, mr_url, approvals_count, checked_at } = a;

  if (typeof mr_iid !== "number" || typeof mr_url !== "string" || mr_url.length === 0) {
    return {
      pass: false,
      error_code: "MR_REF_MISSING",
      report: "mr-approved: artifact.mr_iid (number) and artifact.mr_url (string) are required",
    };
  }
  if (typeof approvals_count !== "number" || !Number.isFinite(approvals_count)) {
    return {
      pass: false,
      error_code: "MR_STATUS_MISSING",
      report: "mr-approved: artifact.approvals_count must be a number",
      hints: [
        "Have the review-watcher agent call the GitLab MCP tool and write approvals_count into the step artifact.",
      ],
    };
  }
  if (typeof checked_at !== "string" || !ISO_RE.test(checked_at)) {
    return {
      pass: false,
      error_code: "STALE_CHECK",
      report: "mr-approved: artifact.checked_at must be ISO 8601",
    };
  }
  if (approvals_count < minApprovals) {
    return {
      pass: false,
      error_code: "APPROVALS_INSUFFICIENT",
      report: `mr-approved: MR !${mr_iid} has ${approvals_count}/${minApprovals} approvals`,
      hints: [
        `Ask reviewers to approve ${mr_url} until at least ${minApprovals} approvals are reached.`,
      ],
    };
  }
  const proj = typeof gitlab_project === "string" ? gitlab_project : "<unknown project>";
  return {
    pass: true,
    report: `mr-approved: MR !${mr_iid} (${proj}) approved by ${approvals_count}/${minApprovals} reviewers`,
  };
});
```

- [ ] **Step 4.4 : Run test, vérifier que le cas nominal passe**

```bash
npm test -- mr-approved
```

Expected: PASS (1 test).

- [ ] **Step 4.5 : Ajouter les tests pour tous les cas d'échec**

Append à `gates/mr-approved.gate.test.ts` (à l'intérieur du `describe`) :

```ts
  it("échoue avec GATE_INVALID_CONFIG si min_approvals manquant", async () => {
    const out = await gate(makeCtx({ artifact: VALID_ARTIFACT, config: {} }));
    expect(out.pass).toBe(false);
    expect(out.error_code).toBe("GATE_INVALID_CONFIG");
  });

  it("échoue avec GATE_INVALID_CONFIG si min_approvals = 0", async () => {
    const out = await gate(makeCtx({ artifact: VALID_ARTIFACT, config: { min_approvals: 0 } }));
    expect(out.pass).toBe(false);
    expect(out.error_code).toBe("GATE_INVALID_CONFIG");
  });

  it("échoue avec MR_REF_MISSING si mr_iid absent", async () => {
    const { mr_iid: _omit, ...without } = VALID_ARTIFACT;
    const out = await gate(makeCtx({ artifact: without, config: { min_approvals: 2 } }));
    expect(out.pass).toBe(false);
    expect(out.error_code).toBe("MR_REF_MISSING");
  });

  it("échoue avec MR_STATUS_MISSING si approvals_count absent", async () => {
    const { approvals_count: _omit, ...without } = VALID_ARTIFACT;
    const out = await gate(makeCtx({ artifact: without, config: { min_approvals: 2 } }));
    expect(out.pass).toBe(false);
    expect(out.error_code).toBe("MR_STATUS_MISSING");
  });

  it("échoue avec STALE_CHECK si checked_at non-ISO", async () => {
    const out = await gate(makeCtx({
      artifact: { ...VALID_ARTIFACT, checked_at: "yesterday" },
      config: { min_approvals: 2 },
    }));
    expect(out.pass).toBe(false);
    expect(out.error_code).toBe("STALE_CHECK");
  });

  it("échoue avec APPROVALS_INSUFFICIENT si count < min", async () => {
    const out = await gate(makeCtx({
      artifact: { ...VALID_ARTIFACT, approvals_count: 1 },
      config: { min_approvals: 2 },
    }));
    expect(out.pass).toBe(false);
    expect(out.error_code).toBe("APPROVALS_INSUFFICIENT");
    expect(out.hints?.[0]).toContain(VALID_ARTIFACT.mr_url);
  });
```

- [ ] **Step 4.6 : Run tous les tests, vérifier qu'ils passent**

```bash
npm test
```

Expected: tous les tests passent (1 nominal + 6 échecs = 7 sur mr-approved, plus 5 sur approval-granted = 12 total).

- [ ] **Step 4.7 : Commit**

```bash
git add gates/mr-approved.gate.ts gates/mr-approved.gate.test.ts
git commit -m "feat(gates): add mr-approved gate with TDD"
```

---

## Task 5 : Écrire les 4 fichiers d'agents Markdown

**Files:**
- Create: `agents/senior-dev.md`
- Create: `agents/dev.md`
- Create: `agents/review-watcher.md`
- Create: `agents/release-mgr.md`

**Spec de référence:** §6 du spec.

> **Note** : le format exact `agents/<name>.md` est convention MnM. Le runtime lit ces fichiers comme prompts système des agents Claude Code lancés au moment du step. Pas de schéma frontmatter rigide à respecter — du Markdown lisible suffit. Inspecter `mnm/.claude/agents/` ou les exemples existants si un format strict est attendu.

- [ ] **Step 5.1 : Créer `agents/senior-dev.md`**

```markdown
---
name: senior-dev
description: Lit un ticket Jira, produit une conception technique, demande l'approbation explicite de l'utilisateur. Utilise le MCP atlassian.
---

Tu es un développeur senior EnterpriseCustomer. Ta mission est de transformer un ticket Jira en une conception technique courte et exploitable, puis d'obtenir une approbation explicite avant que l'implémentation ne démarre.

## Contexte fourni

- `ticket_id` : identifiant Jira (ex: `AY-DEMO-1`)

## Étapes obligatoires

1. **Lire le ticket** via le MCP atlassian (`mcp__plugin_atlassian_atlassian__*`). Récupère titre, description, AC.
2. **Produire `design.md`** dans le workspace courant. Structure imposée :
   - `## Objectif` (1-2 phrases reformulées du ticket)
   - `## Conception technique` (3-6 bullets max — fichiers touchés, signatures, structures de données)
   - `## Impacts et risques` (1-3 bullets)
   - `## Tests prévus` (liste des tests qu'on écrira en step 2)
3. **Afficher le bloc d'approbation à l'utilisateur** — copie-colle exactement le bloc ci-dessous, avec le contenu de `design.md` injecté entre les `[...]`. NE PAS PARAPHRASER.

```
🛑 GATE D'APPROBATION — CONCEPTION TECHNIQUE

Voici la conception proposée pour {ticket_id} :

[contenu intégral de design.md]

Ton approbation explicite est requise avant l'implémentation.
Réponds par : APPROUVÉ ou REJETÉ + raisons.
```

4. **Attendre la réponse de l'utilisateur** dans le terminal. Ne produis pas l'artifact tant que tu n'as pas reçu la réponse.
5. **Produire l'artifact final** quand tu as la réponse :

```json
{
  "files": { "design.md": { "bytes": <taille réelle> } },
  "design_md": "design.md",
  "approval": {
    "granted": <true si réponse commence par APPROUVÉ, sinon false>,
    "by": "<utilisateur courant — récupère via env ou demande>",
    "message": "<réponse intégrale de l'utilisateur, copier-coller>",
    "ts": "<ISO 8601 actuel UTC>"
  }
}
```

## Règles dures

- **N'invente JAMAIS l'approbation.** Si tu ne reçois pas de réponse explicite, l'artifact ne doit pas être produit (le step échouera, c'est volontaire).
- **N'écris PAS de code dans cette step.** Tu produis uniquement la conception technique.
- **Pas d'autre fichier que `design.md`.** Pas de README, pas de TODO, rien d'autre.
```

- [ ] **Step 5.2 : Créer `agents/dev.md`**

```markdown
---
name: dev
description: Implémente la feature décrite dans design.md, écrit les tests, ouvre une MR GitLab. TDD obligatoire.
---

Tu es un développeur EnterpriseCustomer. Ta mission est d'implémenter la feature décrite dans `design.md` (produit par le step précédent) en TDD strict, puis d'ouvrir une MR sur GitLab.

## Contexte fourni

- `ticket_id` : identifiant Jira
- `gitlab_project` : ex `example-org/mnm-demo-app`
- `design_md` : chemin vers le fichier de conception

## Étapes obligatoires

1. **Cloner / pull** le repo `gitlab_project` localement (utilise le MCP gitlab si possible, sinon `git clone`).
2. **Créer une branche** `feat/<ticket_id>` (ex: `feat/AY-DEMO-1`).
3. **TDD** :
   - Écris d'abord les tests qui correspondent à la section `## Tests prévus` de `design.md`.
   - Vérifie qu'ils échouent (red).
   - Implémente le code minimal pour les faire passer (green).
   - Refactor si nécessaire.
4. **Commiter** avec un message conventional commit : `feat(<scope>): <description>` qui réfère le ticket.
5. **Pousser** la branche.
6. **Ouvrir la MR** via le MCP gitlab (`mcp__plugin_gitlab_gitlab__create_merge_request` ou équivalent) :
   - Source : `feat/<ticket_id>`
   - Target : branche par défaut (`main` ou `master`)
   - Titre : `<ticket_id>: <titre lisible>`
   - Description : lien vers le ticket Jira + résumé de la conception.
7. **Produire l'artifact** :

```json
{
  "files": { "<fichier1>": { "bytes": N }, ... },
  "mr_iid": <numéro de la MR>,
  "mr_url": "<URL absolue>",
  "branch_name": "feat/<ticket_id>",
  "tests_passed": true
}
```

## Règles dures

- **TDD strict** : pas une ligne de code de production avant que le test correspondant n'existe et ne soit en échec.
- **Tests doivent passer** avant le commit.
- **Pas de force-push.** Si tu te trompes, fais un nouveau commit (rebase autorisé si propre).
- **Pas de modification de `design.md`.** Si tu trouves un défaut dans la conception, échoue le step et signale-le — il faudra refaire le step 1.
```

- [ ] **Step 5.3 : Créer `agents/review-watcher.md`**

```markdown
---
name: review-watcher
description: Affiche l'URL de la MR à l'utilisateur, attend les approbations humaines, interroge GitLab pour produire l'artifact. NE PAS approuver soi-même.
---

Tu es un agent de surveillance de review. Ta mission est d'attendre que des humains approuvent une MR sur GitLab, puis de produire l'artifact qui permet à la gate `mr-approved` de passer.

## Contexte fourni

- `gitlab_project` : ex `example-org/mnm-demo-app`
- `mr_iid` : numéro de la MR à surveiller

## Étapes obligatoires

1. **Récupérer l'URL de la MR** via le MCP gitlab (`mcp__plugin_gitlab_gitlab__get_merge_request` ou équivalent).
2. **Afficher à l'utilisateur** un message clair :

```
🔍 MR EN ATTENTE DE REVIEW

MR ouverte : <mr_url>
Attente : ≥ 2 approbations humaines.

Demande aux reviewers de l'approuver dans GitLab.
Tape 'check' quand tu penses que les approbations sont là, ou attends que je vérifie.
```

3. **Polling / vérification** : interroge `mcp__plugin_gitlab_gitlab__list_merge_request_approvals` (ou équivalent) jusqu'à obtenir au moins 2 `approved_by` distincts.
   - Maximum 10 minutes d'attente cumulée. Au-delà, échoue le step proprement.
   - Entre deux vérifications, pause de 15-30 secondes.
4. **Produire l'artifact** :

```json
{
  "gitlab_project": "<inchangé>",
  "mr_iid": <inchangé>,
  "mr_url": "<URL absolue>",
  "approvals_count": <nombre réel récupéré via MCP>,
  "approvers": ["<username1>", "<username2>"],
  "checked_at": "<ISO 8601 actuel UTC, juste avant la production de l'artifact>"
}
```

## Règles dures absolues

- **NE PAS APPROUVER LA MR TOI-MÊME.** Ton compte ne doit jamais être dans `approvers`. Si tu détectes que c'est ton compte qui a approuvé, échoue le step.
- **NE PAS FABRIQUER `approvals_count`.** Le nombre doit venir EXCLUSIVEMENT de la réponse du MCP GitLab. Si l'API échoue, échoue le step — ne devine pas.
- **`checked_at` doit refléter le moment réel de l'appel MCP**, pas un horodatage inventé.
- **Ne modifie rien dans le repo.** Ce step est read-only.
```

- [ ] **Step 5.4 : Créer `agents/release-mgr.md`**

```markdown
---
name: release-mgr
description: Merge la MR approuvée, tague la release, génère le changelog. Utilise le MCP gitlab.
---

Tu es un release manager EnterpriseCustomer. Ta mission est de finaliser la release : merge, tag, changelog.

## Contexte fourni

- `gitlab_project` : ex `example-org/mnm-demo-app`
- `mr_iid` : numéro de la MR (déjà approuvée par 2 reviewers grâce au step précédent)

## Étapes obligatoires

1. **Merger la MR** via `mcp__plugin_gitlab_gitlab__merge_merge_request` ou équivalent.
   - Stratégie : merge commit (ou squash si la convention EnterpriseCustomer l'exige — choisis selon les paramètres GitLab du projet).
   - Récupère le SHA du merge commit.
2. **Déterminer la prochaine version** : lis le dernier tag (`mcp__plugin_gitlab_gitlab__list_tags`), incrémente le patch (sémantique semver simple : `vX.Y.Z` → `vX.Y.Z+1`). Si aucun tag, démarre à `v0.1.0`.
3. **Créer le tag** sur le merge commit.
4. **Générer `changelog.md`** : un fichier court qui liste les commits de la MR (titre + sha tronqué) sous une section `## v<X.Y.Z> — <date>`. Si un `changelog.md` existe déjà, prepend la nouvelle section au début.
5. **Commiter et pousser `changelog.md`** sur la branche par défaut (commit direct ou via une mini-MR auto-mergée — choisis selon les protections de la branche).
6. **Produire l'artifact** :

```json
{
  "files": { "changelog.md": { "bytes": <taille> } },
  "changelog_md": "changelog.md",
  "tag": "v<X.Y.Z>",
  "merge_commit_sha": "<sha>",
  "released_at": "<ISO 8601>"
}
```

## Règles dures

- **N'écrase JAMAIS un tag existant.** Si la version cible existe déjà, incrémente.
- **Le tag doit pointer sur le merge commit**, pas sur une autre référence.
- **Pas d'autre changement que `changelog.md`** dans le commit final.
```

- [ ] **Step 5.5 : Vérifier que les 4 fichiers existent et commit**

```bash
ls agents/
# Expected: 4 fichiers .md

git add agents/
git commit -m "feat(agents): add senior-dev, dev, review-watcher, release-mgr prompts"
```

---

## Task 6 : Écrire `workflow.json` et le valider

**Files:**
- Create: `workflow.json`

**Spec de référence:** §4.3 du spec.

- [ ] **Step 6.1 : Créer `workflow.json`**

```json
{
  "apiVersion": "mnm/v1",
  "kind": "GovernedWorkflow",
  "name": "feature-dev",
  "description": "Démo EnterpriseCustomer — De Jira à la prod, gouverné. 4 steps, 2 humains explicites.",
  "variables": {
    "ticket_id":      { "type": "string", "required": true },
    "gitlab_project": { "type": "string", "required": true }
  },
  "steps": [
    {
      "id": "tech-design",
      "deps": [],
      "agent": "senior-dev",
      "prompt_context": {
        "ticket_id": "{{variables.ticket_id}}"
      },
      "required_tools": ["mcp__plugin_atlassian_atlassian__*"],
      "gates": {
        "exit": [
          { "id": "design-exists",    "source": "./gates/artifact-exists.gate.ts",
            "config": { "path": "design.md", "min_bytes": 200 } },
          { "id": "approval-granted", "source": "./gates/approval-granted.gate.ts" }
        ]
      }
    },
    {
      "id": "dev",
      "deps": ["tech-design"],
      "agent": "dev",
      "prompt_context": {
        "ticket_id":      "{{variables.ticket_id}}",
        "gitlab_project": "{{variables.gitlab_project}}",
        "design_md":      "{{steps.tech-design.artifact.design_md}}"
      },
      "required_tools": ["mcp__plugin_gitlab_gitlab__*"],
      "gates": {
        "exit": [
          { "id": "tests-pass", "source": "./gates/step-succeeded.gate.ts",
            "config": { "step": "dev" } },
          { "id": "mr-opened",  "source": "./gates/artifact-exists.gate.ts",
            "config": { "path": "mr_iid" } }
        ]
      }
    },
    {
      "id": "review",
      "deps": ["dev"],
      "agent": "review-watcher",
      "prompt_context": {
        "gitlab_project": "{{variables.gitlab_project}}",
        "mr_iid":         "{{steps.dev.artifact.mr_iid}}"
      },
      "required_tools": ["mcp__plugin_gitlab_gitlab__*"],
      "gates": {
        "exit": [
          { "id": "mr-approved", "source": "./gates/mr-approved.gate.ts",
            "config": { "min_approvals": 2 } }
        ]
      }
    },
    {
      "id": "merge-tag",
      "deps": ["review"],
      "agent": "release-mgr",
      "prompt_context": {
        "gitlab_project": "{{variables.gitlab_project}}",
        "mr_iid":         "{{steps.dev.artifact.mr_iid}}"
      },
      "required_tools": ["mcp__plugin_gitlab_gitlab__*"],
      "gates": {
        "exit": [
          { "id": "changelog-exists", "source": "./gates/artifact-exists.gate.ts",
            "config": { "path": "changelog.md", "min_bytes": 50 } }
        ]
      }
    }
  ]
}
```

> **Note importante sur la gate `tests-pass`** : `step-succeeded` vérifie qu'un step nommé a complété. La référence `step: "dev"` est une auto-référence : la gate vérifiera que le step courant a bien produit un artifact (proxy déterministe pour "le step a réussi côté agent"). Si l'orchestrateur MnM rejette les auto-références, remplacer par une gate qui vérifie un artifact `tests_passed: true` produit par l'agent — ou simplement retirer cette gate (l'autre, `mr-opened`, suffit déjà à prouver que le step a produit un artifact valide).

- [ ] **Step 6.2 : Valider contre le JSON schema MnM**

Run la validation manuelle via le helper du package `@mnm/governed-workflows` :

```bash
cd ~/IdeaProjects/perso/alphalup/mnm-demo-workflows
node --experimental-vm-modules -e '
import("@mnm/governed-workflows").then(async (m) => {
  const fs = await import("node:fs/promises");
  const wf = JSON.parse(await fs.readFile("workflow.json", "utf-8"));
  const parsed = m.workflowSchema.safeParse(wf);
  if (!parsed.success) {
    console.error("INVALID:", JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }
  console.log("VALID");
});
'
```

Expected: `VALID`. Si erreur, lire le détail Zod et corriger le JSON.

> **Si le helper `workflowSchema` n'est pas exporté** : utiliser `defineWorkflow` ou parser manuellement avec les schemas exportés. Vérifier dans `packages/governed-workflows/src/index.ts` quels symboles sont disponibles.

- [ ] **Step 6.3 : Faire un dry-run via le MCP MnM si dispo**

Si l'environnement de Tom a déjà le MCP MnM connecté :

```
mcp__plugin_mnm_mnm__get_governed_workflow(...)
```

Sinon, sauter cette validation E2E ici — elle sera faite en Task 10.

- [ ] **Step 6.4 : Commit**

```bash
git add workflow.json
git commit -m "feat: add feature-dev workflow definition"
```

---

## Task 7 : Bootstrap du repo `mnm-demo-app`

**Files:**
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-app/.gitignore`
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-app/package.json`
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-app/tsconfig.json`
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-app/README.md`
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-app/src/format.ts`
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-app/src/format.test.ts`

- [ ] **Step 7.1 : Créer le dossier et initialiser**

```bash
mkdir -p ~/IdeaProjects/perso/alphalup/mnm-demo-app/src
cd ~/IdeaProjects/perso/alphalup/mnm-demo-app
git init -b main
```

- [ ] **Step 7.2 : Créer `.gitignore`**

```
node_modules/
dist/
.env
*.log
.DS_Store
```

- [ ] **Step 7.3 : Créer `package.json`**

```json
{
  "name": "mnm-demo-app",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 7.4 : Créer `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 7.5 : Créer `src/format.ts` (fonction triviale de base)**

```ts
/**
 * Formate un montant en euros.
 * Utilisé comme base de feature pour la démo MnM EnterpriseCustomer.
 */
export function formatPrice(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new RangeError("amount must be finite");
  }
  return `${amount.toFixed(2)} €`;
}
```

- [ ] **Step 7.6 : Créer `src/format.test.ts` (test qui passe)**

```ts
import { describe, expect, it } from "vitest";
import { formatPrice } from "./format.js";

describe("formatPrice", () => {
  it("formate un montant entier", () => {
    expect(formatPrice(10)).toBe("10.00 €");
  });

  it("formate un montant décimal", () => {
    expect(formatPrice(12.5)).toBe("12.50 €");
  });

  it("rejette NaN", () => {
    expect(() => formatPrice(Number.NaN)).toThrow(RangeError);
  });
});
```

- [ ] **Step 7.7 : Créer `README.md`**

```markdown
# mnm-demo-app

Repo "feature" pour la démo MnM EnterpriseCustomer. C'est ici que l'agent `dev` du workflow `feature-dev` écrit du code.

## Lancer les tests

```bash
npm install
npm test
```

## Convention

- Branches : `feat/<ticket-id>` (ex: `feat/AY-DEMO-1`)
- Tests : vitest, à côté du code (`src/foo.ts` + `src/foo.test.ts`)
```

- [ ] **Step 7.8 : Installer, tester, commit**

```bash
cd ~/IdeaProjects/perso/alphalup/mnm-demo-app
npm install
npm test
```

Expected: 3 tests passent.

```bash
git add .
git commit -m "chore: bootstrap mnm-demo-app with formatPrice baseline"
```

---

## Task 8 : Créer les projets sur lab.enterprise.example et pousser

**Files:** aucun fichier local — opérations git remote.

- [ ] **Step 8.1 : Créer le projet `mnm-demo-workflows` sur lab.enterprise.example**

Via UI GitLab (lab.enterprise.example → New Project), ou via MCP gitlab si dispo dans l'environnement Tom :
- Visibilité : private (ou internal selon préférence EnterpriseCustomer)
- Path : `example-org/mnm-demo-workflows`
- Pas d'init README (on push notre repo existant)

- [ ] **Step 8.2 : Ajouter le remote et pousser**

```bash
cd ~/IdeaProjects/perso/alphalup/mnm-demo-workflows
git remote add origin git@lab.enterprise.example:example-org/mnm-demo-workflows.git
git push -u origin main
```

Expected: push OK, branche `main` trackée.

- [ ] **Step 8.3 : Créer le projet `mnm-demo-app` sur lab.enterprise.example**

Mêmes options que ci-dessus, path `example-org/mnm-demo-app`.

- [ ] **Step 8.4 : Ajouter le remote et pousser le repo demo-app**

```bash
cd ~/IdeaProjects/perso/alphalup/mnm-demo-app
git remote add origin git@lab.enterprise.example:example-org/mnm-demo-app.git
git push -u origin main
```

- [ ] **Step 8.5 : Configurer la branche `main` du repo demo-app pour exiger ≥ 2 approvals**

Sur `lab.enterprise.example/example-org/mnm-demo-app/-/settings/merge_requests` :
- "Approvals required" : 2
- "Prevent approval by author" : ON
- "Prevent approval by users who add commits" : ON (recommandé pour EnterpriseCustomer)
- "Reset approvals on new push" : ON (recommandé)

Et ajouter 2 reviewers éligibles dans le projet (ou via groupe).

> **Si tu n'as pas de second compte EnterpriseCustomer prêt** : ajoute un collègue à qui tu peux demander un clic pendant la démo. Alternativement, abaisse temporairement à `min_approvals: 1` dans `workflow.json` et `mnm-demo-app` (et fais valider par toi-même, ce qui démontre quand même la mécanique GitLab — moins percutant mais ça marche).

- [ ] **Step 8.6 : Tag les commits comme version stable de démo**

```bash
cd ~/IdeaProjects/perso/alphalup/mnm-demo-workflows
git tag v0.1.0-demo
git push origin v0.1.0-demo
```

> **Pourquoi un tag** : MnM pin le sha au moment de `launchWorkflow`. Avoir un tag stable rassure pour la répétition.

---

## Task 9 : Créer le ticket Jira `AY-DEMO-1`

**Files:** aucun — opération externe Atlassian.

- [ ] **Step 9.1 : Créer le ticket via le MCP atlassian**

Si le MCP atlassian est connecté dans l'environnement Tom :

```
mcp__plugin_atlassian_atlassian__create_issue(
  project_key: "AY" (ou un projet sandbox dédié),
  issue_type: "Story" (ou Task),
  summary: "Ajouter un formatPrice avec devise dynamique",
  description: "...",
  ...
)
```

Sinon, créer manuellement dans l'UI Jira EnterpriseCustomer.

- [ ] **Step 9.2 : Contenu du ticket**

```
Titre : [DEMO MnM] Ajouter un formatPrice avec devise dynamique

Description :
Étendre la fonction `formatPrice(amount: number): string` du repo
mnm-demo-app pour accepter une devise optionnelle :

  formatPrice(10)         → "10.00 €"   (par défaut, EUR)
  formatPrice(10, "USD")  → "10.00 $"
  formatPrice(10, "GBP")  → "10.00 £"

Acceptance criteria :
- AC1: Signature étendue : formatPrice(amount: number, currency?: "EUR" | "USD" | "GBP")
- AC2: Comportement par défaut inchangé (formatPrice(10) → "10.00 €")
- AC3: Devise inconnue → throw RangeError("unsupported currency")
- AC4: Tests unitaires couvrant les 4 cas (3 devises + erreur)
```

- [ ] **Step 9.3 : Noter l'identifiant exact du ticket créé**

L'identifiant réel pourra différer de `AY-DEMO-1` selon le projet Jira. **Mettre à jour `workflow.json` et le script de répétition avec le vrai ID si nécessaire.**

---

## Task 10 : Run E2E + checklist de répétition

**Files:**
- Create: `~/IdeaProjects/perso/alphalup/mnm-demo-workflows/REPETITION.md`

- [ ] **Step 10.1 : Run le workflow de bout en bout**

Depuis Claude Code, dans une session avec le MCP MnM connecté :

```
mcp__plugin_mnm_mnm__launch_governed_workflow(
  name: "feature-dev",
  variables: {
    ticket_id: "<id réel>",
    gitlab_project: "example-org/mnm-demo-app"
  }
)
```

Suivre le run jusqu'à `merge-tag`. Au step 1, taper `APPROUVÉ — OK pour implémentation`. Au step 3, approuver la MR depuis l'UI GitLab dans un autre onglet (avec 2 comptes différents).

Expected : 4 steps, tous gates vertes, run termine en `succeeded`.

- [ ] **Step 10.2 : Si un step échoue, diagnostiquer et corriger**

| Symptôme | Cause probable | Action |
|---|---|---|
| Gate `approval-granted` reste rouge | L'agent n'a pas écrit `artifact.approval` | Vérifier que `senior-dev.md` est bien chargé comme prompt système ; vérifier l'artifact produit dans le dashboard MnM |
| Gate `mr-approved` reste rouge | L'agent `review-watcher` n'a pas mis à jour `approvals_count` | Voir l'artifact produit ; vérifier que le MCP gitlab est bien connecté côté agent |
| Step `dev` échoue à ouvrir la MR | Permissions GitLab insuffisantes ou tool MCP différent | Vérifier le token GitLab du MCP, ajuster l'appel dans `dev.md` |
| Workflow rejeté à la validation | Schéma JSON incorrect | Refaire la validation Step 6.2, lire l'erreur Zod |

Re-pousser les corrections sur le repo `mnm-demo-workflows` (`git commit && git push && git tag -f v0.1.0-demo && git push -f origin v0.1.0-demo`).

- [ ] **Step 10.3 : Reset l'état pour pouvoir refaire la démo proprement**

Avant la vraie démo (et après chaque répétition réussie) :

```bash
# Repo demo-app : supprimer la branche feat/<ticket> et le tag créés par le run
cd ~/IdeaProjects/perso/alphalup/mnm-demo-app
git push origin --delete feat/<ticket-id>
git push origin --delete v<X.Y.Z>     # le tag de release créé au step merge-tag
# Localement aussi
git branch -D feat/<ticket-id>
git tag -d v<X.Y.Z>
git fetch --prune
```

Et dans MnM : annuler le run précédent depuis le dashboard si nécessaire.

- [ ] **Step 10.4 : Créer `REPETITION.md` avec la checklist de répétition pre-démo**

```markdown
# Checklist de répétition — Démo MnM EnterpriseCustomer

## J-1 (la veille)

- [ ] Run E2E complet du workflow, vérifier que tout passe vert.
- [ ] Reset l'état des repos (branches feat/*, tags vX.Y.Z).
- [ ] Le ticket Jira AY-DEMO-1 est bien dans l'état "À faire" (ou équivalent).
- [ ] Préparer le 2e compte / collègue qui approuvera la MR (l'avoir en stand-by sur Slack).
- [ ] Backup screencast prêt si MCP plante en live.

## J-0 (juste avant la démo)

- [ ] MnM démarré (`bun run dev` dans le repo `mnm`).
- [ ] Claude Code ouvert avec le MCP MnM connecté (`/mcp` → vert).
- [ ] Onglet GitLab `mnm-demo-app` ouvert sur la liste des MR.
- [ ] Onglet Jira ouvert sur le ticket AY-DEMO-1.
- [ ] Studio MnM ouvert avec `workflow.json` chargé.
- [ ] Slide finale prête.
- [ ] Run précédent purgé (sinon le launch sera rejeté en "already running").

## Pendant la démo

- [ ] Step 1 : taper exactement `APPROUVÉ — OK pour implémentation` (pas de typo).
- [ ] Step 3 : basculer sur GitLab, approuver depuis le compte secondaire, attendre 5-10s que MnM détecte.
- [ ] Step 4 : montrer le tag créé (`Repository → Tags`).
- [ ] Conclusion : ouvrir le dashboard MnM, montrer la trace audit complète.
```

- [ ] **Step 10.5 : Commit `REPETITION.md`**

```bash
cd ~/IdeaProjects/perso/alphalup/mnm-demo-workflows
git add REPETITION.md
git commit -m "docs: add demo rehearsal checklist"
git push origin main
```

---

## Self-Review (couverture du spec)

Vérification rapide que le plan implémente tout le spec :

| Spec § | Couvert par |
|---|---|
| §2 (audience) | Plan ne touche pas à l'audience, mais le déroulé démo (§8 spec) est encodé dans `REPETITION.md` (Task 10.4) |
| §3 (hors-scope) | Plan ne contient AUCUNE tâche pour la primitive native `kind: "approval"`, l'inbox UI, le MCP `approve_governed_step`, les webhooks. ✓ |
| §4.1 (4 steps) | Task 6 `workflow.json` |
| §4.2 (humain pattern A) | Task 5.1 (`senior-dev.md`) + Task 3 (`approval-granted.gate.ts`) |
| §4.2 (humain pattern B) | Task 5.3 (`review-watcher.md`) + Task 4 (`mr-approved.gate.ts`) |
| §4.3 (workflow.json) | Task 6 |
| §5.1 (`approval-granted` gate) | Task 3 |
| §5.2 (`mr-approved` gate) | Task 4 |
| §5.3 (gates canonical) | Task 2 |
| §6.1-6.4 (4 agents) | Task 5 |
| §7 (données démo) | Tasks 7, 8, 9 |
| §8 (déroulé démo) | Task 10.4 (`REPETITION.md`) |
| §9 (composants à livrer) | Tasks 1-9 |
| §10 (risques) | Task 10.4 + tableau de diagnostic Task 10.2 |
| §11 (suite) | Hors-scope, mentionné dans le README éventuel ou laissé pour `/schedule` post-démo |

Aucun trou détecté.
