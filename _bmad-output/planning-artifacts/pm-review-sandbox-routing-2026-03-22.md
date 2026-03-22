# PM Review: Sandbox Routing Architecture Proposals
**Date**: 2026-03-22
**Author**: PM Review (Consolidated)
**Inputs**: Architect A (Routing Design), Architect B (Enterprise Security)
**Status**: REVIEW COMPLETE -- Recommendation included

---

## 1. DOES THIS MATCH WHAT TOM WANTS?

Tom's requirements (verbatim from brainstorming session):
- "chaque user a son container, sur lequel tout ces workflows etc... s'execute"
- "il faut que ce soit robuste car si on deploie ca dans une entreprise"
- "il faut que le reset des container etc... fasse que l'utilisateur ne soit jamais deconnecte"
- "il faut que personne n'ait acces au container des autres"

### Assessment

| Requirement | Architect A | Architect B | Verdict |
|------------|-------------|-------------|---------|
| Each user has ONE container | YES -- resolved via `(userId, companyId)` lookup | YES -- 1:1 user:sandbox model | GOOD |
| All workflows execute in it | PARTIALLY -- timer runs fall back to local | N/A (defers to routing design) | GAP |
| Robust for enterprise | YES -- transport abstraction is clean | YES -- comprehensive hardening | GOOD |
| Container reset = user stays connected | NOT ADDRESSED | YES -- volume persistence + auto-restart | NEED CLARITY |
| Nobody accesses other users' containers | YES -- strict (userId, companyId) scoping | YES -- RBAC + RLS + no admin exec | GOOD |

### Challenges Raised

**Challenge 1: Timer runs falling back to local exec defeats the purpose.**

Tom said "tous les workflows s'executent" in the user's container. If timer-triggered runs bypass the sandbox and run on the MnM server host, this violates the isolation model. A rogue timer-run agent could access the host filesystem, other users' data, etc.

**Recommendation**: Every agent MUST have an `ownerUserId`. Timer runs use the agent owner's sandbox. If the owner has no sandbox, the run fails with a clear error -- never silently falls back to local. This is the ONLY behavior that matches Tom's "chaque user a son container" vision.

**Challenge 2: The `useSandbox: boolean` opt-in flag creates a confusing transition.**

If some agents use sandboxes and some don't, the security model has holes. An admin can't know which runs are isolated and which aren't. And users have to understand a technical flag to get the behavior they expect.

**Recommendation for MVP**: Instead of per-agent `useSandbox`, make it a company-level setting: `company.sandboxMode: "disabled" | "enabled" | "enforced"`. In "enabled" mode, runs use sandbox when available, local when not. In "enforced" mode, runs without a sandbox fail. This is simpler for enterprise admins.

---

## 2. USER EXPERIENCE -- DOES THE USER NEED TO DO ANYTHING NEW?

### Current UX Flow (as built)
1. User provisions sandbox via "Set Up Workspace" button
2. User runs `claude setup-token` in PodConsole terminal
3. User triggers agent runs via UI
4. Agent runs... somewhere (currently: MnM server host)

### Post-Implementation UX Flow
1. Same as current -- provision + auth
2. Agent runs automatically route to user's sandbox (transparent)
3. User sees no difference in the UI

### Challenge 3: The "transparent routing" is great but the user needs CONFIDENCE.

The user doesn't see where their agent is running. They need visual confirmation that their run is executing in their isolated sandbox, not on a shared server. This is an enterprise trust signal.

**Recommendation**: Add a small indicator in the RunDetail UI:
```
[shield icon] Running in your sandbox | Container: mnm-sandbox-abc123
```
This costs nothing to implement (the `sandboxUserId` and `sandboxContainerId` Architect A wants to add to `heartbeat_runs` gives us the data) and provides essential trust visibility.

### Challenge 4: What happens when the sandbox is hibernated and a run is triggered?

Architect A mentions "wake it automatically before exec, or fail the run" but doesn't commit to one. Architect B estimates 1-3 second wake time.

**Recommendation**: Auto-wake is the only acceptable UX. The user clicks "Run Agent" and it works. They should not need to remember to wake their sandbox first. The 1-3 second delay is invisible -- agent runs already take seconds to start. Add a log line: `[mnm] Waking sandbox... done (1.2s)` to the run output so the user knows what happened.

---

## 3. TIMER-TRIGGERED AGENTS (NO SPECIFIC USER)

This is the biggest gap between the two proposals. Neither fully addresses it.

### The Problem
Timer-triggered runs have no `requestedByActorId`. Architect A's resolution chain returns `null` for timers.

### Challenge 5: Timer runs are not "nobody's runs" -- they're the agent owner's runs.

In Tom's model, the agent belongs to a user (or is assigned to a project by a user). The timer just determines WHEN it runs, not WHO owns it.

**Recommendation**:
1. Add `ownerUserId` to the `heartbeat_agents` table (NOT nullable for new agents)
2. For existing agents without an owner, backfill from `created_by` or `company_members` first admin
3. Timer runs resolve to `agent.ownerUserId` and run in that user's sandbox
4. If the owner's sandbox is unavailable, fail the run with `"sandbox_unavailable"` error

This also solves the agent-to-agent (A2A) case: an agent triggered by another agent uses ITS OWN owner's sandbox, not the triggering agent's owner.

---

## 4. SHARED AGENTS (ASSIGNED TO A PROJECT, NOT A USER)

### Challenge 6: What about agents that serve the whole team?

Example: A "Code Review Bot" agent assigned to a project, triggered by any team member when they create a PR. Whose sandbox does it use?

**Options**:
- A) The triggering user's sandbox (makes sense for on-demand, but what about PR webhooks?)
- B) The agent owner's sandbox (consistent, but may overload one user's container)
- C) A shared "project sandbox" (new concept -- adds complexity)

**Recommendation**: Option A for on-demand, Option B for everything else.

The resolution chain from Architect A should be:
```
1. wakeup.requestedByActorId (if type=user) --> that user's sandbox
2. issue.assigneeUserId --> that user's sandbox
3. agent.ownerUserId --> owner's sandbox (covers timers, A2A, webhooks)
4. null --> ERROR (never local fallback in enforced mode)
```

This is clean, predictable, and matches Tom's mental model: "someone always owns the execution context."

---

## 5. MIGRATION PATH

### Challenge 7: How do we go from current system to sandbox routing?

Both proposals assume a phased rollout but don't detail the migration of EXISTING agents and runs.

**Current state**: All adapters run `claude` as a child process on the MnM server host.

**Migration concerns**:
1. Existing agents have no `ownerUserId` -- need backfill
2. Existing agent configs have no `useSandbox` -- need default behavior
3. Existing runs in progress during deployment -- what happens?
4. Claude sessions stored on host vs. in sandbox -- session IDs not transferable

**Recommended Migration Plan**:

| Phase | Scope | Who | Duration |
|-------|-------|-----|----------|
| Phase 0 | Add `ownerUserId` to agents, backfill existing | Backend | 1 sprint |
| Phase 1 | Implement `SpawnTransport` abstraction + `SandboxTransport` | Backend | 1 sprint |
| Phase 2 | Company setting: `sandboxMode = "enabled"` (sandbox when available, local fallback) | Backend + Admin UI | 1 sprint |
| Phase 3 | Run indicator in UI ("Running in sandbox") | Frontend | 0.5 sprint |
| Phase 4 | Company setting: `sandboxMode = "enforced"` (sandbox required, no fallback) | Backend | 0.5 sprint |
| Phase 5 | Enterprise security hardening (Architect B's P0/P1 items) | Backend + DevOps | 1-2 sprints |

**Total estimated effort**: 4-5 sprints for full sandbox routing with enterprise security.

**Critical path**: Phase 1 (transport abstraction) blocks everything. Start here.

---

## 6. MVP vs FULL VISION

### MVP (Phase 1-3, ~3 sprints)

What's IN:
- Transport injection (`SpawnTransport`) in adapter-utils
- Sandbox exec runner (`docker exec` via dockerode)
- User resolution chain (wakeup actor -> issue assignee -> agent owner)
- `ownerUserId` on agents table
- `sandboxMode: "enabled"` at company level (local fallback when no sandbox)
- Auto-wake hibernated sandboxes on run trigger
- `sandboxUserId` + `sandboxContainerId` on `heartbeat_runs` for audit
- Run indicator in UI

What's OUT (deferred):
- Per-company Docker networks (P0 security -- should be fast-followed)
- Audit log table
- Disk quotas
- Seccomp profiles
- User lifecycle hooks (deactivate -> hibernate)
- Prometheus metrics
- `sandboxMode: "enforced"` (requires all users to have provisioned sandboxes)

### Full Vision (Phase 1-5, ~5 sprints)

Everything above plus Architect B's full security stack.

**Recommendation**: Ship MVP first, then fast-follow with network isolation (it's P0 security and should not ship to enterprise customers without it).

---

## 7. GAPS BETWEEN THE TWO PROPOSALS

| Area | Architect A | Architect B | Gap |
|------|-------------|-------------|-----|
| Timer runs | Returns null, suggests local fallback | Not addressed | CRITICAL -- need `ownerUserId` |
| A2A runs | Suggests "triggering agent's owner" | Mentions exec session isolation | NEEDS alignment -- always use target agent's owner |
| Wake-on-demand | Mentioned but not committed | Estimates 1-3s latency | NEEDS decision: auto-wake is mandatory |
| Workspace paths | Translation from host to container discussed | Not addressed | NEEDS Phase 2 design |
| Skills directory | Flagged as open question | Not addressed | NEEDS resolution -- prebake into image for MVP |
| Session continuity | Flagged as open question | Not addressed | NEEDS decision -- sessions are container-local, accept session reset on first sandbox run |
| Container naming | Not mentioned | Recommends full UUID | AGREE with Architect B |
| Per-agent vs per-company config | `useSandbox` per agent | Not addressed | RECOMMEND: company-level `sandboxMode` instead |
| Concurrent runs in same sandbox | Not addressed | Flagged as question for Architect A | Docker exec handles this natively -- document it |
| Volume cleanup on failed provision | Not addressed | Flagged as question | ADD to sandbox-manager error handling |

---

## 8. CONSOLIDATED RECOMMENDATION

### Architecture Decision: Transport Injection (Architect A's preferred approach)

The `SpawnTransport` abstraction is the right choice. It is clean, testable, and future-proof (remote machines, HTTP transport, etc.). The pragmatic Phase 1 approach (duplicate adapter logic) should be REJECTED in favor of going straight to transport injection -- it's not much more work and avoids technical debt.

### Critical Design Additions

1. **`ownerUserId` on agents table** -- required for timer/A2A/webhook runs
2. **Company-level `sandboxMode`** instead of per-agent `useSandbox`
3. **Auto-wake on run trigger** -- non-negotiable for UX
4. **Per-company Docker network** (Architect B) -- include in MVP, it's a security requirement
5. **Container name = full sandboxId** (Architect B) -- trivial fix, do immediately
6. **Skills directory prebaked into image** -- add to Dockerfile.agent, not runtime mount

### What to Build First (in order)

1. Add `ownerUserId` to `heartbeat_agents` + backfill migration
2. Add `SpawnTransport` to adapter-utils types
3. Build `SandboxTransport` (docker exec wrapper)
4. Modify claude-local adapter to use transport
5. Add user resolution chain in `executeRun()`
6. Add auto-wake logic (hibernated -> wake -> exec)
7. Add `sandboxUserId` / `sandboxContainerId` to `heartbeat_runs`
8. Add per-company Docker networks
9. Add company `sandboxMode` setting
10. Add UI sandbox indicator on run detail

### What NOT to Build Yet

- Audit log table (P1, next sprint)
- Disk quotas (P2)
- Seccomp profiles (P3)
- User lifecycle hooks (P1, next sprint)
- Prometheus metrics (P2)
- Shared/project sandboxes (future epic)

---

## 9. RISKS

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Skills dir not accessible inside container | HIGH | Runs fail | Prebake skills into Dockerfile.agent |
| Claude session not resumable after sandbox switch | HIGH | Session lost, extra API costs | Accept session reset, document in changelog |
| Workspace path mismatch | MEDIUM | Wrong cwd, agent confusion | Default to `/workspace`, workspace resolver Phase 2 |
| Concurrent execs in one container cause resource contention | MEDIUM | Slow runs | Document resource limits per sandbox, company quotas |
| Docker daemon overloaded at 100+ containers | LOW | Host crash | Architect B's health monitor + graceful degradation |

---

## 10. FINAL VERDICT

Both proposals are solid and complementary. Architect A provides the routing mechanism (HOW to route execution), Architect B provides the hardening (HOW to secure it). Together they form a complete design.

**Key corrections needed**:
1. No local fallback for timer runs -- use `ownerUserId` instead
2. Company-level config, not per-agent
3. Auto-wake is mandatory, not optional
4. Per-company networks should be in MVP, not deferred
5. Skills dir must be prebaked into image

With these corrections, the design matches Tom's vision: every user has their container, everything runs in it, it just works, nobody else can access it.
