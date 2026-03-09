# Story 8.1: Docker Build & Local Deployment

Status: ready-for-dev

## Story

As a **user**,
I want **to deploy MnM as a Docker container**,
So that **I can run it on my own server or locally**.

## Context

MnM is a web app (Paperclip fork), not Electron. Deployment is via Docker. The `Dockerfile` and `docker-compose.yml` already exist from Paperclip.

## Acceptance Criteria

### AC1 — Docker build works

**Given** I run `docker build -t mnm .`
**When** the build completes
**Then** a working Docker image is produced

### AC2 — Docker Compose runs the stack

**Given** I run `docker-compose up`
**When** the containers start
**Then** MnM is accessible at `http://localhost:3100` with UI and API working

### AC3 — Environment configuration

**Given** I configure environment variables
**When** I start the container
**Then** settings like database URL, LLM API keys, and deployment mode are respected

## Tasks / Subtasks

- [ ] Task 1: Verify and update Dockerfile (AC: #1)
  - [ ] 1.1 Review existing `Dockerfile` — ensure it builds the full stack (server + UI)
  - [ ] 1.2 Update if needed for MnM-specific changes (renamed packages, etc.)
  - [ ] 1.3 Test: `docker build -t mnm .` succeeds

- [ ] Task 2: Verify docker-compose (AC: #2)
  - [ ] 2.1 Review `docker-compose.yml` — ensure all services (app, postgres) are configured
  - [ ] 2.2 Test: `docker-compose up` starts MnM successfully
  - [ ] 2.3 Verify UI loads at `http://localhost:3100`

- [ ] Task 3: Environment documentation (AC: #3)
  - [ ] 3.1 Document all environment variables in README or `.env.example`
  - [ ] 3.2 Include: `DATABASE_URL`, `DEPLOYMENT_MODE`, `JWT_SECRET`, LLM API keys

- [ ] Task 4: Tests
  - [ ] 4.1 Test: Docker image builds without errors
  - [ ] 4.2 Test: Application starts and health endpoint responds

## Dev Notes

### What NOT to do
- Do NOT create Electron builds — MnM is web-only
- Do NOT modify core Paperclip Docker setup significantly — it works

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
