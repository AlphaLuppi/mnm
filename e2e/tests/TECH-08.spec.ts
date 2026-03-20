/**
 * TECH-08 — CI/CD Pipeline: GitHub Actions workflows, Dockerfile, Dependabot
 *
 * File-content-based E2E tests verifying:
 * - CI workflow (.github/workflows/ci.yml): QG-0, QG-1, QG-2, QG-5, Docker build
 * - Deploy workflow (.github/workflows/deploy.yml): build+tag, staging, production
 * - Security workflow (.github/workflows/security.yml): weekly audit + CodeQL
 * - Dependabot config (.github/dependabot.yml): npm + github-actions
 * - Dockerfile optimization: multi-stage, BuildKit cache mounts
 *
 * 35 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const CI_WORKFLOW = resolve(ROOT, ".github/workflows/ci.yml");
const DEPLOY_WORKFLOW = resolve(ROOT, ".github/workflows/deploy.yml");
const SECURITY_WORKFLOW = resolve(ROOT, ".github/workflows/security.yml");
const DEPENDABOT_CONFIG = resolve(ROOT, ".github/dependabot.yml");
const DOCKERFILE = resolve(ROOT, "Dockerfile");

// ============================================================
// CI Workflow: .github/workflows/ci.yml (T01–T18)
// ============================================================

test.describe("TECH-08 — CI Workflow", () => {
  // T01 — CI workflow file exists
  test("T01 — CI workflow file exists at .github/workflows/ci.yml", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src.length).toBeGreaterThan(100);
  });

  // T02 — CI workflow triggers on push and pull_request
  test("T02 — CI workflow triggers on push and pull_request", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toMatch(/on:\s*\n\s+push:/);
    expect(src).toMatch(/pull_request:/);
  });

  // T03 — CI workflow uses pnpm/action-setup
  test("T03 — CI workflow uses pnpm/action-setup", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("pnpm/action-setup");
  });

  // T04 — CI workflow uses actions/setup-node with cache
  test("T04 — CI workflow uses actions/setup-node with cache", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("actions/setup-node@v4");
    expect(src).toContain('cache: "pnpm"');
  });

  // T05 — CI workflow has QG-0 typecheck job
  test("T05 — CI workflow has QG-0 typecheck job", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("qg0-typecheck");
    // tech-08-qg0-typecheck marker
    expect(src).toContain("tech-08-qg0-typecheck");
  });

  // T06 — QG-0 runs pnpm typecheck
  test("T06 — QG-0 runs pnpm typecheck", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("pnpm typecheck");
  });

  // T07 — QG-0 runs check:tokens
  test("T07 — QG-0 runs check:tokens", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("pnpm check:tokens");
  });

  // T08 — CI workflow has QG-1 unit test job
  test("T08 — CI workflow has QG-1 unit test job", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("qg1-unit");
    // tech-08-qg1-unit marker
    expect(src).toContain("tech-08-qg1-unit");
  });

  // T09 — QG-1 runs vitest
  test("T09 — QG-1 runs vitest (pnpm test:run)", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    // The unit test job should run vitest via pnpm test:run
    expect(src).toContain("pnpm test:run");
  });

  // T10 — CI workflow has QG-2 integration job
  test("T10 — CI workflow has QG-2 integration job", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("qg2-integration");
    // tech-08-qg2-integration marker
    expect(src).toContain("tech-08-qg2-integration");
  });

  // T11 — QG-2 uses PostgreSQL and Redis services
  test("T11 — QG-2 uses PostgreSQL and Redis services (docker-compose.test.yml equivalent)", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    // Integration job should have services section with postgres and redis
    expect(src).toContain("postgres:17-alpine");
    expect(src).toContain("redis:7-alpine");
  });

  // T12 — QG-2 sets DATABASE_URL for test DB
  test("T12 — QG-2 sets DATABASE_URL for test DB", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toMatch(/DATABASE_URL:\s*postgres:\/\/mnm_test/);
  });

  // T13 — CI workflow has QG-5 E2E job
  test("T13 — CI workflow has QG-5 E2E job", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("qg5-e2e");
    // tech-08-qg5-e2e marker
    expect(src).toContain("tech-08-qg5-e2e");
  });

  // T14 — QG-5 installs Playwright browsers
  test("T14 — QG-5 installs Playwright browsers", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("playwright install");
  });

  // T15 — QG-5 runs playwright test
  test("T15 — QG-5 runs playwright test", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("playwright test");
  });

  // T16 — QG-5 uploads test artifacts
  test("T16 — QG-5 uploads test artifacts (report + traces)", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("actions/upload-artifact@v4");
    expect(src).toContain("playwright-report");
  });

  // T17 — CI workflow has Docker build job
  test("T17 — CI workflow has Docker build job", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("docker-build");
    // tech-08-docker-build marker
    expect(src).toContain("tech-08-docker-build");
  });

  // T18 — Docker build uses docker/build-push-action
  test("T18 — Docker build uses docker/build-push-action", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("docker/build-push-action");
  });
});

// ============================================================
// Deploy Workflow: .github/workflows/deploy.yml (T19–T22)
// ============================================================

test.describe("TECH-08 — Deploy Workflow", () => {
  // T19 — Deploy workflow file exists
  test("T19 — Deploy workflow file exists at .github/workflows/deploy.yml", async () => {
    const src = await readFile(DEPLOY_WORKFLOW, "utf-8");
    expect(src.length).toBeGreaterThan(100);
  });

  // T20 — Deploy workflow triggers on push to master
  test("T20 — Deploy workflow triggers on push to master", async () => {
    const src = await readFile(DEPLOY_WORKFLOW, "utf-8");
    expect(src).toMatch(/on:\s*\n\s+push:\s*\n\s+branches:\s*\[master\]/);
  });

  // T21 — Deploy workflow has build+tag job
  test("T21 — Deploy workflow has build-and-tag job", async () => {
    const src = await readFile(DEPLOY_WORKFLOW, "utf-8");
    expect(src).toContain("build-and-tag");
    // tech-08-deploy-job marker
    expect(src).toContain("tech-08-deploy-job");
  });

  // T22 — Deploy workflow uses environment protection
  test("T22 — Deploy workflow uses environment protection rules", async () => {
    const src = await readFile(DEPLOY_WORKFLOW, "utf-8");
    // Should have environment definitions for staging and production
    expect(src).toMatch(/environment:\s*\n\s+name:\s*staging/);
    expect(src).toMatch(/environment:\s*\n\s+name:\s*production/);
  });
});

// ============================================================
// Security Workflow: .github/workflows/security.yml (T23–T25)
// ============================================================

test.describe("TECH-08 — Security Workflow", () => {
  // T23 — Security workflow file exists
  test("T23 — Security workflow file exists at .github/workflows/security.yml", async () => {
    const src = await readFile(SECURITY_WORKFLOW, "utf-8");
    expect(src.length).toBeGreaterThan(100);
  });

  // T24 — Security workflow runs on schedule (weekly)
  test("T24 — Security workflow runs on schedule (weekly cron)", async () => {
    const src = await readFile(SECURITY_WORKFLOW, "utf-8");
    expect(src).toContain("schedule:");
    // Cron expression for weekly
    expect(src).toMatch(/cron:\s*".*\* \* 1"/);
  });

  // T25 — Security workflow runs pnpm audit
  test("T25 — Security workflow runs pnpm audit", async () => {
    const src = await readFile(SECURITY_WORKFLOW, "utf-8");
    expect(src).toContain("pnpm audit");
  });
});

// ============================================================
// Dependabot Config: .github/dependabot.yml (T26–T28)
// ============================================================

test.describe("TECH-08 — Dependabot Config", () => {
  // T26 — Dependabot config file exists
  test("T26 — Dependabot config file exists at .github/dependabot.yml", async () => {
    const src = await readFile(DEPENDABOT_CONFIG, "utf-8");
    expect(src.length).toBeGreaterThan(50);
  });

  // T27 — Dependabot config covers npm ecosystem
  test("T27 — Dependabot config covers npm ecosystem", async () => {
    const src = await readFile(DEPENDABOT_CONFIG, "utf-8");
    expect(src).toContain('package-ecosystem: "npm"');
  });

  // T28 — Dependabot config covers github-actions ecosystem
  test("T28 — Dependabot config covers github-actions ecosystem", async () => {
    const src = await readFile(DEPENDABOT_CONFIG, "utf-8");
    expect(src).toContain('package-ecosystem: "github-actions"');
  });
});

// ============================================================
// Dockerfile Optimization (T29–T30)
// ============================================================

test.describe("TECH-08 — Dockerfile", () => {
  // T29 — Dockerfile has multi-stage build
  test("T29 — Dockerfile has multi-stage build (base, deps, build, production)", async () => {
    const src = await readFile(DOCKERFILE, "utf-8");
    expect(src).toContain("AS base");
    expect(src).toContain("AS deps");
    expect(src).toContain("AS build");
    expect(src).toContain("AS production");
  });

  // T30 — Dockerfile has BuildKit cache mount hints
  test("T30 — Dockerfile has BuildKit cache mount for pnpm store", async () => {
    const src = await readFile(DOCKERFILE, "utf-8");
    expect(src).toContain("--mount=type=cache");
    expect(src).toContain("pnpm");
  });
});

// ============================================================
// Cross-cutting CI concerns (T31–T35)
// ============================================================

test.describe("TECH-08 — Cross-cutting CI concerns", () => {
  // T31 — CI workflow sets concurrency to cancel stale runs
  test("T31 — CI workflow sets concurrency to cancel stale runs", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("concurrency:");
    expect(src).toContain("cancel-in-progress: true");
  });

  // T32 — CI workflow has pnpm store cache via actions/setup-node
  test("T32 — CI workflow uses pnpm cache via setup-node", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    // pnpm cache is handled by setup-node with cache: "pnpm"
    const cacheCount = (src.match(/cache:\s*"pnpm"/g) || []).length;
    expect(cacheCount).toBeGreaterThanOrEqual(3); // At least 3 jobs use pnpm cache
  });

  // T33 — CI workflow specifies node version >= 20
  test("T33 — CI workflow specifies Node.js version >= 20", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    // NODE_VERSION env var should be 20 or higher
    expect(src).toMatch(/NODE_VERSION:\s*"2[0-9]"/);
  });

  // T34 — E2E job depends on QG-1 (unit) passing
  test("T34 — E2E job (qg5-e2e) depends on qg1-unit", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    // Find the qg5-e2e job section and check its needs
    const e2eSection = src.slice(src.indexOf("qg5-e2e:"));
    const needsLine = e2eSection.slice(0, e2eSection.indexOf("steps:"));
    expect(needsLine).toContain("qg1-unit");
  });

  // T35 — CI workflow has tech-08 markers in comments
  test("T35 — CI workflow has tech-08-ci-workflow marker", async () => {
    const src = await readFile(CI_WORKFLOW, "utf-8");
    expect(src).toContain("tech-08-ci-workflow");
  });
});
