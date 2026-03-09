# Story 8.3: GitHub Actions CI/CD Pipeline

Status: ready-for-dev

## Story

As a **developer**,
I want **a CI/CD pipeline that tests, builds, and publishes MnM**,
So that **releases are automated and quality is enforced**.

## Context

MnM is open source on GitHub. CI/CD runs tests, builds Docker images, and can publish to container registry.

## Acceptance Criteria

### AC1 — CI runs on PR

**Given** a PR is opened
**When** CI runs
**Then** it executes: lint, type-check, unit tests, build

### AC2 — Docker image published on release

**Given** a new release tag is pushed
**When** the release workflow runs
**Then** a Docker image is built and pushed to GitHub Container Registry (ghcr.io)

### AC3 — Build status visible

**Given** CI has run
**When** I view the PR or commit
**Then** I see pass/fail status with link to logs

## Tasks / Subtasks

- [ ] Task 1: CI workflow (AC: #1, #3)
  - [ ] 1.1 Create `.github/workflows/ci.yml`
  - [ ] 1.2 Steps: checkout, setup Node/pnpm, install, lint, type-check, test, build
  - [ ] 1.3 Run on: push to main, pull_request

- [ ] Task 2: Release workflow (AC: #2)
  - [ ] 2.1 Create `.github/workflows/release.yml`
  - [ ] 2.2 Trigger on: tag push `v*`
  - [ ] 2.3 Steps: build Docker image, push to ghcr.io/seeyko/mnm

- [ ] Task 3: Badge and docs
  - [ ] 3.1 Add CI status badge to README
  - [ ] 3.2 Document release process in CONTRIBUTING.md

- [ ] Task 4: Tests
  - [ ] 4.1 Verify CI workflow runs successfully on a test PR
  - [ ] 4.2 Verify Docker image builds in CI

## Dev Notes

### GitHub Actions Best Practices
- Use `pnpm` caching for faster builds
- Use matrix for multiple Node versions if needed (optional for MVP)
- Pin action versions (`actions/checkout@v4`)

### What NOT to do
- Do NOT create Electron build workflows
- Do NOT publish to npm — MnM is not an npm package

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
