# Story 8.2: Production Deployment Guide

Status: ready-for-dev

## Story

As a **user**,
I want **clear documentation for deploying MnM to production**,
So that **I can run it securely on my server**.

## Context

MnM is deployed as a Docker container. This story covers production deployment best practices.

## Acceptance Criteria

### AC1 — Production docker-compose

**Given** I want to deploy to production
**When** I use the production compose file
**Then** it includes: external Postgres, HTTPS via reverse proxy, secure defaults

### AC2 — Security checklist

**Given** I deploy MnM
**When** I follow the security guide
**Then** secrets are not in environment variables, CORS is configured, auth is enabled

### AC3 — Reverse proxy configuration

**Given** I want HTTPS
**When** I follow the docs
**Then** I have working Traefik or Nginx configuration examples

## Tasks / Subtasks

- [ ] Task 1: Production compose file (AC: #1)
  - [ ] 1.1 Create `docker-compose.prod.yml` with production settings
  - [ ] 1.2 Use external Postgres (not embedded)
  - [ ] 1.3 Set `DEPLOYMENT_MODE=authenticated`

- [ ] Task 2: Security documentation (AC: #2)
  - [ ] 2.1 Create `docs/security.md` with deployment security checklist
  - [ ] 2.2 Cover: secrets management, network configuration, backup

- [ ] Task 3: Reverse proxy examples (AC: #3)
  - [ ] 3.1 Create `docs/traefik.md` with Traefik + Let's Encrypt example
  - [ ] 3.2 Create `docs/nginx.md` with Nginx + certbot example

- [ ] Task 4: Tests
  - [ ] 4.1 Review: production compose file is valid
  - [ ] 4.2 Review: documentation is complete

## Dev Notes

### What NOT to do
- Do NOT create Electron builds
- Do NOT expose secrets in documentation examples

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
