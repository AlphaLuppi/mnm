# Design: Sandbox Enterprise Security & Resilience
**Date**: 2026-03-22
**Author**: Architect B
**Scope**: Enterprise-grade security and resilience for MnM per-user sandbox routing
**Status**: PROPOSAL — for review and integration with Architect A's routing design

---

## Executive Summary

MnM's per-user sandbox model (one Docker container per user, persistent credentials via named volumes) is architecturally sound for enterprise deployment. This document specifies the security hardening, resilience mechanisms, and operational controls needed to safely run 100+ concurrent sandboxes in an enterprise environment.

The core security model is **defense in depth**:
1. Network-level isolation (per-sandbox Docker network)
2. OS-level isolation (non-root user, dropped capabilities, seccomp)
3. API-level authorization (RBAC + RLS)
4. Audit trail (immutable log of all sandbox operations)
5. Credential protection (volume encryption + no-plaintext-export)

---

## 1. CREDENTIAL PERSISTENCE

### Current State
The claude OAuth token is stored in `/home/agent/.bash_profile` inside the `mnm-sandbox-home-{userId}` named volume. This survives `docker stop`/`docker start` and even `docker rm` + `docker create` (the volume persists).

### Requirements
- Token survives container restart, hibernation/wake cycle, container recreation
- Token NEVER exported via API (admin cannot read it)
- Token rotation does not require destroying the sandbox
- If token expires, user must re-authenticate (not automatic — user-initiated)

### Design

#### 1.1 Volume Encryption at Rest (Enterprise Tier)

For enterprise deployments, the Docker named volumes must sit on an encrypted filesystem:

```
Option A — Host-level encryption (preferred for simplicity):
  - Mount host filesystem encrypted (LUKS on Linux, BitLocker on Windows)
  - Docker volumes inherit host-level encryption
  - No per-volume overhead, transparent to Docker
  - Responsibility: DevOps/sysadmin configures host

Option B — Per-volume EncryptedFS:
  - Use gVisor or kata-containers with dm-verity
  - High complexity, significant performance overhead
  - Only justified for government/banking deployments
```

**Recommendation: Option A** (host encryption). Document it as a deployment requirement, not an application-level concern.

#### 1.2 Token Isolation — No API Export

**Rule**: The API MUST NEVER return the Claude token, even to admin roles.

The `mapSandboxRow()` function in `sandbox-manager.ts:317` already excludes raw credentials (only `claudeAuthStatus` is exposed). This must be enforced as a contract:

```typescript
// sandbox-manager.ts: mapSandboxRow — DO NOT ADD credential fields here
// The only auth info exposed to the API is claudeAuthStatus: "authenticated" | "unknown" | "expired"
```

**Claude Auth Status** is determined by exec-ing a test command inside the sandbox, never by reading the token file:

```typescript
async function checkClaudeAuthStatus(containerId: string): Promise<"authenticated" | "expired" | "unknown"> {
  try {
    const result = await execCommandInContainer(containerId, ["claude", "--version"], { timeout: 5000 });
    return result.exitCode === 0 ? "authenticated" : "expired";
  } catch {
    return "unknown";
  }
}
```

#### 1.3 Token Rotation Flow

When a user's Claude token expires:
1. `claudeAuthStatus` is set to `"expired"` (detected by health check or on failed run)
2. User is shown an "Re-authenticate" prompt in the UI
3. User clicks → sandbox terminal opens with `claude setup` command pre-filled
4. On success, `claudeAuthStatus` is updated to `"authenticated"`
5. Existing volume/container is reused — no data loss

**No automatic token refresh** — Claude OAuth tokens are user-consent-bound.

---

## 2. NETWORK ISOLATION

### Current State
No explicit Docker network is created for sandboxes. Containers likely use the default bridge network, which allows inter-container communication.

### Risk
In a 100-user enterprise deployment, sandbox A could reach sandbox B's internal processes via the Docker bridge network. This is a **high severity** isolation gap.

### Design

#### 2.1 Per-Company Network Isolation

Each company gets its **own Docker bridge network**, completely isolated from other companies:

```
Network naming: mnm-net-{companyId}
  - Created when first sandbox in company is provisioned
  - Destroyed when last sandbox in company is destroyed
  - Bridge network (not overlay — single-host assumption)
```

Sandboxes within the same company CAN communicate via this network (shared tool execution, A2A communication). Cross-company communication is impossible at the network layer.

#### 2.2 No Internet Egress by Default (Configurable)

Default sandbox network policy:
```
Egress ALLOWED:
  - api.anthropic.com (Claude API)
  - github.com / gitlab.com (git operations)
  - npm registry, PyPI (package installs)
  - MnM server internal API (for agent callbacks)

Egress BLOCKED:
  - All other external destinations (configurable per company)
```

Implementation via iptables rules on the Docker bridge, applied at provision time. For enterprise, use a companion `mnm-egress-proxy` container (Squid/mitmproxy) to enforce and log all egress requests.

#### 2.3 No Inter-Company Cross-Talk

```yaml
# docker compose (illustrative):
networks:
  mnm-net-{companyId}:
    driver: bridge
    internal: false  # allow egress to internet via proxy
    ipam:
      config:
        - subnet: 172.20.{companyIndex}.0/24  # non-overlapping per company
```

#### 2.4 MnM Server ↔ Sandbox Communication

The MnM server (Express) communicates with sandboxes only via:
1. `docker exec` (for running commands, terminal sessions)
2. `docker stop` / `docker start` (lifecycle)
3. Docker events API (health monitoring)

There is NO direct network connection from the MnM server to sandbox containers. This is secure by design — the Docker daemon acts as the control plane.

#### 2.5 Container Creation — Network Assignment

```typescript
// sandbox-manager.ts: createAndStartSandbox — add NetworkingConfig
const networkName = `mnm-net-${companyId}`;
await ensureCompanyNetwork(networkName, companyId);

const container = await docker.createContainer({
  // ... existing config ...
  NetworkingConfig: {
    EndpointsConfig: {
      [networkName]: {}
    }
  },
  HostConfig: {
    // ... existing config ...
    NetworkMode: networkName,  // use company-specific bridge
  }
});
```

---

## 3. RBAC — API ROUTE ENFORCEMENT

### Current State
`sandbox-manager.ts` takes `userId` and `companyId` as parameters. The callers (API routes) must validate these. Need to verify the routes enforce ownership.

### Design

#### 3.1 Ownership Enforcement Rules

```
Rule 1 — Users can only operate on their OWN sandbox:
  GET /api/sandboxes/me → scoped to req.user.id + req.user.companyId
  POST /api/sandboxes/me/hibernate → same
  POST /api/sandboxes/me/wake → same
  DELETE /api/sandboxes/me → same (self-destruct, requires confirmation)

Rule 2 — Managers can hibernate/wake sandboxes in their company:
  POST /api/admin/sandboxes/:userId/hibernate → requirePermission("sandbox:manage")
  POST /api/admin/sandboxes/:userId/wake → requirePermission("sandbox:manage")

Rule 3 — Admins can LIST and VIEW all sandboxes in company:
  GET /api/admin/sandboxes → requirePermission("sandbox:list")
  GET /api/admin/sandboxes/:userId → requirePermission("sandbox:view")
  (NO credential exposure — only status, resource usage, last active)

Rule 4 — Only system can PROVISION sandboxes:
  POST /api/admin/sandboxes/:userId/provision → requirePermission("sandbox:admin")
  (Or auto-provision on first login — see User Lifecycle section)

Rule 5 — No cross-company access:
  ALL routes MUST filter by req.user.companyId (enforced by RLS at DB layer too)
```

#### 3.2 RLS Enforcement

The `user_pods` table must have RLS policies matching the existing 48-table pattern:

```sql
-- Row-level security for user_pods
ALTER TABLE user_pods ENABLE ROW LEVEL SECURITY;

-- Users see only their own sandbox
CREATE POLICY user_pods_self_read ON user_pods
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = current_setting('app.company_id')::uuid);

-- Admins/managers see all sandboxes in their company
CREATE POLICY user_pods_admin_read ON user_pods
  FOR SELECT TO authenticated
  USING (
    company_id = current_setting('app.company_id')::uuid
    AND EXISTS (
      SELECT 1 FROM company_members
      WHERE user_id = auth.uid()
      AND company_id = current_setting('app.company_id')::uuid
      AND role IN ('admin', 'manager')
    )
  );

-- No direct user INSERT/UPDATE/DELETE — goes through service layer
```

#### 3.3 Admin Exec Access

**Critical Rule**: Admins CANNOT `exec` into another user's sandbox. The `execInSandbox` function is ONLY callable with the sandbox owner's `userId`.

Admin can only:
- View status, resource usage, last active timestamp
- Trigger lifecycle ops (hibernate, wake, destroy) via management API
- View audit log of sandbox operations

This is both a security requirement and a compliance/privacy requirement (user's work is private).

---

## 4. CRASH RECOVERY

### Current State
Container has `RestartPolicy: { Name: "unless-stopped" }`. If the container crashes, Docker restarts it. But if a run was in-progress during the crash, the run is orphaned.

### Design

#### 4.1 Container Crash → Auto-Restart

Docker's `unless-stopped` restart policy handles container crashes automatically. The container comes back within seconds. The DB status remains `"running"` (stale but self-correcting on next heartbeat check).

**Health check** (see Section 8) detects stale status and corrects it.

#### 4.2 Run Orphan Detection

When a sandbox crashes mid-run:
1. The run's `heartbeatRuns` record has `status: "running"` but the process is dead
2. On sandbox restart, no process is running for the orphaned run

**Recovery mechanism**: Startup probe on sandbox wake/restart:

```typescript
async function onSandboxRestart(sandboxId: string, userId: string, companyId: string): Promise<void> {
  // Find any runs that were "running" for this user's agent
  const orphanedRuns = await db.select()
    .from(heartbeatRuns)
    .where(
      and(
        eq(heartbeatRuns.status, "running"),
        eq(heartbeatRuns.userId, userId),  // scoped to user
      )
    );

  for (const run of orphanedRuns) {
    await db.update(heartbeatRuns)
      .set({
        status: "crashed",
        error: "Sandbox container restarted during run",
        endedAt: new Date(),
      })
      .where(eq(heartbeatRuns.id, run.id));

    // Emit live event so UI shows crash notification
    await publishLiveEvent("run:crashed", { runId: run.id, reason: "sandbox_restart" });
  }
}
```

#### 4.3 Run Retry Policy (Optional, Future)

For idempotent runs (pure reads, analysis tasks), auto-retry could be configured per-agent:

```typescript
interface AgentRetryConfig {
  maxRetries: number;       // 0 = no retry (default)
  retryOnCrash: boolean;    // only retry on container crash, not on agent error
  retryDelayMs: number;     // backoff before retry
}
```

**Default: no auto-retry**. Enterprises want human confirmation before retrying AI agent actions. Retry policy is an agent-level setting, not sandbox-level.

#### 4.4 Zombie Container Detection

Containers can appear "running" to Docker but have a zombie/stuck process. Health check via `docker inspect` state + process-level check:

```typescript
async function healthCheckSandbox(sandboxId: string, containerId: string): Promise<"healthy" | "zombie" | "stopped"> {
  try {
    const info = await docker.getContainer(containerId).inspect();
    if (!info.State.Running) return "stopped";

    // Check memory usage — zombie containers often have 0 RSS
    const stats = await docker.getContainer(containerId).stats({ stream: false });
    if (stats.memory_stats.usage === 0) return "zombie";

    return "healthy";
  } catch {
    return "stopped";
  }
}
```

---

## 5. RESOURCE LIMITS

### Current State
`cpuMillicores: 1000` (1 vCPU) and `memoryMb: 1024` (1 GB RAM) are set at provision time via `NanoCpus` and `Memory` in Docker. Disk limits are NOT set.

### Design

#### 5.1 Per-Sandbox Limits (Defaults)

```typescript
// Default resource profile — configurable per company/tier
const RESOURCE_PROFILES = {
  starter: { cpuMillicores: 500, memoryMb: 512, diskGb: 5 },
  standard: { cpuMillicores: 1000, memoryMb: 1024, diskGb: 10 },   // current default
  power: { cpuMillicores: 2000, memoryMb: 4096, diskGb: 50 },
  unlimited: { cpuMillicores: 4000, memoryMb: 8192, diskGb: 100 }, // enterprise top tier
};
```

#### 5.2 Disk Quotas

Docker named volumes have no built-in size limit. Solutions:

```
Option A — tmpfs overlay (for workspace only):
  HostConfig.Tmpfs: { "/workspace": "size=10g" }
  Pro: automatic enforcement
  Con: workspace lost on container restart (not for home dir)

Option B — Storage driver limits (devicemapper/overlay2):
  HostConfig.StorageOpt: { "size": "10G" }
  Pro: persists, enforced by Docker
  Con: requires devicemapper storage driver (not default on most systems)

Option C — Application-level monitoring:
  Health check polls `du -sh /workspace` inside container
  Alert when >80%, block provision of new runs when >95%
  Pro: works with any storage driver
  Con: not a hard limit, can burst
```

**Recommendation: Option C** for now, with Option B for enterprise customers who control their Docker host.

#### 5.3 Company-Wide Quotas

```typescript
// Enhanced quota checks in provisionSandbox():

interface CompanyResourcePolicy {
  maxSandboxes: number;          // current: 25
  maxTotalCpuMillicores: number; // total across all sandboxes
  maxTotalMemoryMb: number;      // total across all sandboxes
  maxIdleTimeMs: number;         // auto-hibernate after idle
}

async function checkCompanyResourceQuota(companyId: string, requesting: ResourceProfile): Promise<void> {
  const activeSandboxes = await db.select({
    count: sql<number>`count(*)`,
    totalCpu: sql<number>`sum(cpu_millicores)`,
    totalMem: sql<number>`sum(memory_mb)`,
  })
  .from(userPods)
  .where(
    and(
      eq(userPods.companyId, companyId),
      inArray(userPods.status, ["provisioning", "running", "idle"]),
    )
  );

  const policy = await getCompanyResourcePolicy(companyId);

  if (activeSandboxes.count >= policy.maxSandboxes) throw conflict("Sandbox quota exceeded");
  if (activeSandboxes.totalCpu + requesting.cpuMillicores > policy.maxTotalCpuMillicores) {
    throw conflict("CPU quota exceeded for company");
  }
  if (activeSandboxes.totalMem + requesting.memoryMb > policy.maxTotalMemoryMb) {
    throw conflict("Memory quota exceeded for company");
  }
}
```

#### 5.4 Idle Auto-Hibernation

Current constant: `IDLE_TIMEOUT_MS = 30 * 60 * 1000` (30 min). This needs to be enforced by a background job (not currently implemented):

```typescript
// Background job: runs every HEALTH_CHECK_INTERVAL_MS (30s)
async function autoHibernateIdleSandboxes(): Promise<void> {
  const cutoff = new Date(Date.now() - IDLE_TIMEOUT_MS);
  const idleSandboxes = await db.select()
    .from(userPods)
    .where(
      and(
        inArray(userPods.status, ["running", "idle"]),
        lt(userPods.lastActiveAt, cutoff),
      )
    );

  for (const sandbox of idleSandboxes) {
    await hibernateSandbox(sandbox.userId, sandbox.companyId);
    await auditLog("sandbox:auto_hibernated", { sandboxId: sandbox.id, reason: "idle_timeout" });
  }
}
```

---

## 6. USER LIFECYCLE

### Design

#### 6.1 User Deactivated → Sandbox Hibernated

When an admin deactivates a user:
1. Synchronous: Any active runs for this user are cancelled (emit run:cancelled events)
2. Synchronous: Sandbox container is stopped (`docker stop`)
3. DB: User status → `deactivated`, sandbox status → `hibernated`
4. Volume: Preserved (user may be re-activated)

```typescript
async function onUserDeactivated(userId: string, companyId: string): Promise<void> {
  // Cancel active runs
  await cancelActiveRunsForUser(userId);

  // Hibernate sandbox (gracefully)
  const sandbox = await getMySandbox(userId, companyId);
  if (sandbox && ["running", "idle"].includes(sandbox.status)) {
    await hibernateSandbox(userId, companyId);
    await auditLog("sandbox:hibernated_on_deactivation", { userId, sandboxId: sandbox.id });
  }
}
```

#### 6.2 User Deleted → Sandbox Destroyed (Deferred)

When an admin deletes a user:
1. **Immediate**: Sandbox hibernated (container stopped), all active runs cancelled
2. **Deferred** (30-day grace period): Sandbox and volumes scheduled for destruction
3. After grace period: Container removed, volumes deleted, DB record purged

The 30-day grace period allows:
- Audit trail preservation
- Recovery if deletion was accidental
- Workspace artifact export by admin

```typescript
interface SandboxDeletionSchedule {
  sandboxId: string;
  scheduledAt: Date;
  reason: "user_deleted" | "company_offboarded" | "admin_request";
}
// Stored in user_pods: deletionScheduledAt timestamp
```

#### 6.3 User Re-activated → Sandbox Woken

When a deactivated user is re-activated:
1. Sandbox woken (`docker start`)
2. Credentials still valid in volume (unless token expired — user re-authenticates)
3. Workspace intact

#### 6.4 Company Offboarding → All Sandboxes Destroyed

When a company is offboarded from MnM:
1. All active runs cancelled
2. All sandboxes hibernated (containers stopped)
3. Bulk destruction scheduled (30-day grace)
4. Data export offered to company admin before destruction
5. After grace: All containers, volumes, networks destroyed

---

## 7. AUDIT LOG

### Design

All sandbox operations are logged to an immutable `sandbox_audit_log` table. This is separate from the general `activity_log` to allow retention policies and access controls specific to sandbox security events.

#### 7.1 Events to Log

```typescript
type SandboxAuditEvent =
  | "sandbox:provisioned"           // container created
  | "sandbox:started"               // container started (wake)
  | "sandbox:hibernated"            // container stopped (explicit)
  | "sandbox:auto_hibernated"       // container stopped (idle timeout)
  | "sandbox:destroyed"             // container + volumes removed
  | "sandbox:destruction_scheduled" // scheduled for future deletion
  | "sandbox:exec_opened"           // terminal session opened (who, from IP)
  | "sandbox:exec_closed"           // terminal session closed
  | "sandbox:auth_set"              // claude token set/updated
  | "sandbox:auth_expired"          // health check detected expired token
  | "sandbox:auth_checked"          // manual auth status check
  | "sandbox:resource_alert"        // CPU/memory/disk threshold crossed
  | "sandbox:crash_detected"        // container crashed
  | "sandbox:run_orphaned"          // run marked crashed after sandbox restart
  | "sandbox:network_created"       // company network provisioned
  | "sandbox:network_destroyed";    // company network removed
```

#### 7.2 Audit Log Schema

```sql
CREATE TABLE sandbox_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sandbox_id UUID NOT NULL REFERENCES user_pods(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,                        -- sandbox owner
  actor_id TEXT,                                -- who performed the action (may differ from owner)
  actor_role TEXT,                              -- role at time of action
  company_id UUID NOT NULL,
  event TEXT NOT NULL,
  metadata JSONB,                               -- additional context (IP, session ID, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable: no UPDATE or DELETE allowed
CREATE RULE sandbox_audit_no_update AS ON UPDATE TO sandbox_audit_log DO INSTEAD NOTHING;
CREATE RULE sandbox_audit_no_delete AS ON DELETE TO sandbox_audit_log DO INSTEAD NOTHING;

-- RLS: company admins can read their company's audit log
-- No user can read others' sandbox audit entries
ALTER TABLE sandbox_audit_log ENABLE ROW LEVEL SECURITY;
```

#### 7.3 What Is NOT Logged

- Content of commands run inside the sandbox (privacy)
- File contents read or written
- Claude conversation content

The audit log is about **who did what to the sandbox infrastructure**, not **what the agent did inside**.

---

## 8. SCALING — 100 USERS

### Current State
No background health monitoring loop is implemented. The `HEALTH_CHECK_INTERVAL_MS` constant exists but is unused.

### Design

#### 8.1 Docker Daemon Capacity

| Metric | 100 containers | Notes |
|--------|---------------|-------|
| Docker daemon memory overhead | ~2 MB/container | ~200 MB total |
| Container startup time | ~1-3 seconds | Acceptable for wake-on-demand |
| Simultaneous active containers | 100 | Docker handles this fine |
| Docker daemon default limits | No container limit | But kernel limits apply |

**Linux kernel limits to configure**:
```
/proc/sys/kernel/pid_max = 4194304     # max PIDs (increase from default 32768)
ulimit -n (open files) = 524288        # max file descriptors
/proc/sys/fs/inotify/max_user_watches = 1048576  # for file-watching in sandboxes
```

These are documented as **deployment prerequisites** for 100+ sandbox deployments.

#### 8.2 Health Check Background Service

```typescript
// sandbox-health-monitor.ts — runs in server process as setInterval job
export function startSandboxHealthMonitor(db: Db, docker: Docker): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const activeSandboxes = await db.select()
        .from(userPods)
        .where(inArray(userPods.status, ["running", "idle", "provisioning"]));

      for (const sandbox of activeSandboxes) {
        if (!sandbox.dockerContainerId) continue;

        const health = await healthCheckSandbox(sandbox.id, sandbox.dockerContainerId);

        if (health === "stopped" && sandbox.status === "running") {
          // Container stopped unexpectedly — update DB
          await db.update(userPods)
            .set({ status: "failed", error: "Container stopped unexpectedly", updatedAt: new Date() })
            .where(eq(userPods.id, sandbox.id));
          await auditLog("sandbox:crash_detected", { sandboxId: sandbox.id });
          await onSandboxRestart(sandbox.id, sandbox.userId, sandbox.companyId);
        }
      }

      // Auto-hibernate idle sandboxes
      await autoHibernateIdleSandboxes(db, docker);

    } catch (err: any) {
      logger.error(`Sandbox health monitor error: ${err.message}`);
    }
  }, HEALTH_CHECK_INTERVAL_MS); // 30 seconds
}
```

#### 8.3 Monitoring Metrics (Prometheus)

Expose via `/metrics` endpoint (or ship to existing observability stack):

```
mnm_sandboxes_total{status="running",company_id="..."} 42
mnm_sandboxes_total{status="hibernated",company_id="..."} 58
mnm_sandbox_cpu_usage_millicores{sandbox_id="..."}
mnm_sandbox_memory_usage_mb{sandbox_id="..."}
mnm_sandbox_last_active_seconds_ago{sandbox_id="..."}
mnm_sandbox_auth_status{sandbox_id="...", status="authenticated|expired|unknown"}
```

#### 8.4 Graceful Degradation at Scale

When Docker host is under pressure (>90% CPU or memory):
1. Block new sandbox provisions until resources free up
2. Accelerate idle hibernation (reduce threshold from 30 min to 5 min)
3. Alert company admins via in-app notification
4. Log to `sandbox_audit_log` with event `sandbox:resource_pressure`

```typescript
async function checkHostCapacity(): Promise<"ok" | "degraded" | "critical"> {
  const info = await docker.info();
  const memUsageRatio = (info.MemTotal - info.MemAvailable) / info.MemTotal;
  if (memUsageRatio > 0.95) return "critical";
  if (memUsageRatio > 0.85) return "degraded";
  return "ok";
}
```

---

## 9. SECURITY HARDENING — ADDITIONAL ITEMS

### 9.1 Dockerfile Hardening (Current Gaps)

The current `Dockerfile.agent` drops all capabilities and adds only `NET_BIND_SERVICE`. Recommended additions:

```dockerfile
# Add seccomp profile — restricts dangerous syscalls
# (create mnm-agent-seccomp.json based on Docker default + remove setuid/mount/pivot_root)
```

```typescript
// In createAndStartSandbox:
HostConfig: {
  // ... existing ...
  SecurityOpt: [
    "no-new-privileges",
    "seccomp=/etc/docker/seccomp/mnm-agent.json",  // custom seccomp profile
  ],
  // No capability to call Docker daemon from inside sandbox
  // No access to host PID namespace
  PidMode: "",  // isolated PID namespace (default)
  UsernsMode: "", // isolated user namespace (future: user namespace remapping)
}
```

### 9.2 Mount Allowlist

The sandbox currently mounts:
- `mnm-sandbox-home-{userId}:/home/agent` (persistent credentials + dotfiles)
- `mnm-sandbox-workspace-{userId}:/workspace` (project files)

**Never mount**:
- Docker socket (`/var/run/docker.sock`) — would allow container escape
- Host filesystem paths
- Other users' volumes

This is enforced by ensuring all `Binds` in `createAndStartSandbox` ONLY use `mnm-sandbox-*-{userId}` volume names, validated before the Docker API call.

### 9.3 Container Name Collision

Current: `name: "mnm-sandbox-${userId.slice(0, 8)}"` — 8 chars of UUID may collide.

**Fix**: Use full userId or sandboxId for container name:
```typescript
name: `mnm-sandbox-${sandboxId}`,  // sandboxId is full UUID — guaranteed unique
```

### 9.4 Exec Session Isolation

When admin triggers a run on behalf of a user via the API (A2A or system automation), the exec must still use the user's sandbox — not a shared pool. The `userId` in the exec call MUST be the agent owner's userId, never the requesting admin's.

---

## 10. IMPLEMENTATION PRIORITY

| Priority | Item | Effort | Risk if Skipped |
|----------|------|--------|----------------|
| P0 | Network isolation — per-company Docker network | Medium | Cross-tenant data leak |
| P0 | Container name collision fix | Trivial | Provision failure at scale |
| P0 | RBAC — verify exec is owner-only | Small | Admin can intrude on user |
| P1 | Sandbox health monitor background job | Medium | Stale status, no auto-hibernate |
| P1 | Run orphan recovery on restart | Small | Hung "running" status forever |
| P1 | Audit log table + emission | Medium | No forensics, compliance fail |
| P1 | User lifecycle hooks (deactivate/delete) | Medium | Resources not cleaned up |
| P2 | Disk quota monitoring | Medium | Disk exhaustion |
| P2 | Resource pressure detection | Small | Host crash at 100 users |
| P3 | Seccomp profile | Large | Kernel exploit surface |
| P3 | Host-level volume encryption docs | Documentation | Compliance gap |

---

## 11. OPEN QUESTIONS FOR ARCHITECT A (Routing Design)

1. **Exec routing**: When the MnM server routes `claude exec` calls to the correct sandbox, does it validate ownership at the routing layer OR rely on the sandbox manager? Recommend: BOTH (defense in depth).

2. **Multi-agent in one sandbox**: If user has 3 agents, all run in their ONE sandbox. Does the routing design handle concurrent exec sessions in the same container? (Docker `exec` supports this natively.)

3. **Wake-on-demand latency**: If sandbox is hibernated and a run is triggered, the wake adds ~1-3 seconds. Is there a warm-pool mechanism considered? (Keep N sandboxes in "idle" state pre-warmed.)

4. **WebSocket for terminal**: The `PodConsole.tsx` uses WebSocket for terminal access. Does the routing layer handle WebSocket upgrade correctly when proxying to sandbox exec sessions?

5. **Volume cleanup on provision retry**: If `createAndStartSandbox` fails after volume creation but before container start, the volume is orphaned. Routing layer should not be affected, but cleanup logic needed.
