# Story 5.9: Production Build & Distribution

Status: ready-for-dev

## Story

As a user,
I want to run MnM easily without a development setup,
so that I can start using it without configuring a Node.js development environment.

## Acceptance Criteria

1. A production build is created via `npm run build` producing an optimized Next.js output
2. The production build starts via `npm start` (or a single launcher script) with startup time < 3 seconds
3. Build output is self-contained: includes all dependencies, runs with Node.js runtime only
4. Build is reproducible (same source produces same output)
5. A launcher script or npm package provides one-command startup: `npx mnm` or `./start-mnm.sh`
6. Release artifacts are suitable for upload to GitHub Releases
7. Docker option available: `docker run mnm` for environment-independent deployment

## Tasks / Subtasks

- [ ] Task 1: Configure production build (AC: #1, #4)
  - [ ] Verify `next build` produces optimized output in `.next/` directory
  - [ ] Configure `next.config.ts` with `output: "standalone"` for self-contained builds
  - [ ] Ensure all environment variables are documented in `.env.example`
  - [ ] Add build validation script that checks for required files post-build
- [ ] Task 2: Create launcher script (AC: #2, #5)
  - [ ] Create `scripts/start-mnm.sh` bash script: checks Node.js version, runs `npm start`
  - [ ] Add `bin` field to `package.json` for `npx mnm` support
  - [ ] Create `scripts/setup.sh` for first-time setup: `npm install && npm run build && npm run db:push`
  - [ ] Ensure `.mnm/` directory is created on first startup if it does not exist
- [ ] Task 3: Optimize bundle size (AC: #3)
  - [ ] Analyze bundle with `@next/bundle-analyzer` to identify large dependencies
  - [ ] Tree-shake unused shadcn/ui components (only import what is used)
  - [ ] Verify `better-sqlite3` native bindings are included in standalone output
  - [ ] Test that standalone build includes all required `node_modules`
- [ ] Task 4: Create Docker configuration (AC: #7)
  - [ ] Create `Dockerfile` with multi-stage build: build stage (Node.js + deps) and run stage (Node.js slim)
  - [ ] Use `node:20-slim` as runtime base image
  - [ ] Configure volume mounts for `.mnm/` data persistence and repository access
  - [ ] Create `docker-compose.yml` for easy local deployment
  - [ ] Document Docker usage in README
- [ ] Task 5: Create release packaging script (AC: #6)
  - [ ] Create `scripts/package-release.sh` that builds and packages into a tarball
  - [ ] Include: standalone build output, launcher scripts, README, LICENSE
  - [ ] Name format: `mnm-v{version}-{platform}.tar.gz`
  - [ ] Generate SHA256 checksum file for integrity verification
- [ ] Task 6: Add health check and startup validation (AC: #2)
  - [ ] Create `/api/health` endpoint returning: `{ status: "ok", version: "x.y.z", uptime: seconds }`
  - [ ] Launcher script waits for health check to pass before opening browser
  - [ ] Log startup time and report if it exceeds 3-second target
- [ ] Task 7: Write tests (AC: #1, #2, #3)
  - [ ] Test that `npm run build` completes without errors
  - [ ] Test that standalone output contains all required files
  - [ ] Test health check endpoint returns correct format
  - [ ] Test Docker build completes (if Docker available in CI)

## Dev Notes

- Next.js `output: "standalone"` creates a minimal server with only required dependencies, ideal for distribution
- The standalone output includes a `server.js` that can be run directly with `node server.js`
- `better-sqlite3` requires native bindings compiled for the target platform; the standalone build must include these
- For the POC, the primary distribution method is `git clone + npm install + npm start`; Docker and tarball are secondary
- The Docker setup needs volume mounts for the target repository (read-only) and `.mnm/` data (read-write)
- Consider using `pkg` or `nexe` for a single-binary distribution in the future (post-POC)

### Project Structure Notes

- `scripts/start-mnm.sh` -- launcher script
- `scripts/setup.sh` -- first-time setup script
- `scripts/package-release.sh` -- release packaging
- `Dockerfile` -- Docker build configuration
- `docker-compose.yml` -- Docker Compose for local deployment
- `src/app/api/health/route.ts` -- health check endpoint
- `next.config.ts` -- update with `output: "standalone"`

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 2.3 - Version Constraints: Node.js 20+ LTS]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 2.2 - Trade-offs: Distribution via npm start or Docker]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 3.1 - Directory Layout: next.config.ts]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.9]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
