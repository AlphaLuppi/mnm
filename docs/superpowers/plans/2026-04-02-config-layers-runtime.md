# Config Layers — Runtime + OAuth Implementation Plan (2/3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the runtime merge engine (resolves config at agent run time), heartbeat integration, data migration from `adapterConfig` to base layers, and the OAuth flow for MCP credentials.

**Architecture:** `configLayerRuntime.resolveConfigForRun()` is the single entry point called by heartbeat. It merges layers, resolves credentials, generates config files (.mcp.json, settings.json, skills/), and injects them into the sandbox.

**Tech Stack:** Drizzle ORM, AES-256-GCM encryption, OAuth2+PKCE, Redis (state storage), Express

**Prerequisite:** Plan 1/3 (backend CRUD) must be completed first.

**Spec:** `docs/superpowers/specs/2026-04-02-config-layers-design.md` (sections 7, 9, 14)

---

## File Structure

### New Files
- `server/src/services/config-layer-runtime.ts` — Runtime merge, file generation, injection
- `server/src/services/mcp-credential.ts` — CRUD credentials, encryption, refresh
- `server/src/services/mcp-oauth.ts` — OAuth2 PKCE flow (authorize, callback)
- `server/src/routes/mcp-oauth.ts` — OAuth routes
- `packages/db/src/migrations/0054_migrate_adapter_config.sql` — Data migration

### Modified Files
- `server/src/services/heartbeat.ts` — Replace `adapterConfig` parse with `resolveConfigForRun()`
- `server/src/routes/index.ts` — Export OAuth routes
- `server/src/app.ts` — Mount OAuth routes

---

### Task 1: Runtime Merge Service

**Files:**
- Create: `server/src/services/config-layer-runtime.ts`

- [ ] **Step 1: Write the runtime merge service**

```typescript
import { sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { configLayerFiles, configLayerItems } from "@mnm/db";
import type { MergedConfigItem } from "@mnm/shared";
import { logger } from "../middleware/logger.js";

interface ResolvedMcpServer {
  name: string;
  type: string;
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

interface ResolvedSkill {
  name: string;
  frontmatter: Record<string, unknown>;
  content: string;
  files: Array<{ path: string; content: string }>;
}

interface ResolvedHook {
  event: string;
  matcher?: string;
  hookType: string;
  command?: string;
  url?: string;
  prompt?: string;
  timeout?: number;
  async?: boolean;
  once?: boolean;
}

interface ResolvedSettings {
  [key: string]: unknown;
}

export interface ResolvedConfig {
  mcpServers: ResolvedMcpServer[];
  skills: ResolvedSkill[];
  hooks: ResolvedHook[];
  settings: ResolvedSettings;
  /** Items that failed resolution (e.g. credential decryption failure) */
  warnings: string[];
}

// TTL cache for merge results (1 minute, same pattern as access.ts)
const CACHE_TTL_MS = 60_000;
const mergeCache = new Map<string, { result: MergedConfigItem[]; cachedAt: number }>();

export function configLayerRuntimeService(db: Db) {

  /**
   * Execute the merge query from the spec (section 5.3).
   * Returns deduplicated items with highest-priority wins.
   */
  async function executeMergeQuery(companyId: string, agentId: string): Promise<MergedConfigItem[]> {
    const cacheKey = `${companyId}:${agentId}`;
    const cached = mergeCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.result;
    }

    const rows = await db.execute<{
      id: string;
      item_type: string;
      name: string;
      config_json: Record<string, unknown>;
      priority: number;
      layer_id: string;
    }>(sql`
      WITH active_layers AS (
        SELECT cl.id AS layer_id, 999 AS priority
        FROM config_layers cl
        WHERE cl.company_id = ${companyId} AND cl.enforced = true AND cl.archived_at IS NULL

        UNION ALL

        SELECT a.base_layer_id AS layer_id, 500 AS priority
        FROM agents a WHERE a.id = ${agentId}::uuid AND a.base_layer_id IS NOT NULL

        UNION ALL

        SELECT acl.layer_id, acl.priority
        FROM agent_config_layers acl WHERE acl.agent_id = ${agentId}::uuid
      )
      SELECT DISTINCT ON (cli.item_type, cli.name)
        cli.id::text, cli.item_type, cli.name, cli.config_json, al.priority, al.layer_id::text
      FROM active_layers al
      JOIN config_layer_items cli ON cli.layer_id = al.layer_id AND cli.enabled = true
      ORDER BY cli.item_type, cli.name, al.priority DESC
    `);

    const items: MergedConfigItem[] = rows.rows.map((r) => ({
      id: r.id,
      itemType: r.item_type as MergedConfigItem["itemType"],
      name: r.name,
      configJson: r.config_json,
      priority: r.priority,
      layerId: r.layer_id,
    }));

    mergeCache.set(cacheKey, { result: items, cachedAt: Date.now() });
    return items;
  }

  /**
   * Invalidate cache for an agent (called when layers change).
   */
  function invalidateCache(companyId: string, agentId: string) {
    mergeCache.delete(`${companyId}:${agentId}`);
  }

  /**
   * Invalidate all caches for a company (called when enforced layers change).
   */
  function invalidateCompanyCache(companyId: string) {
    for (const key of mergeCache.keys()) {
      if (key.startsWith(`${companyId}:`)) {
        mergeCache.delete(key);
      }
    }
  }

  /**
   * Main entry point — resolve config for a run.
   * Called by heartbeat instead of parsing adapterConfig directly.
   */
  async function resolveConfigForRun(
    companyId: string,
    agentId: string,
    ownerUserId: string,
  ): Promise<ResolvedConfig> {
    const items = await executeMergeQuery(companyId, agentId);
    const warnings: string[] = [];

    // Group by type
    const mcpItems = items.filter((i) => i.itemType === "mcp");
    const skillItems = items.filter((i) => i.itemType === "skill");
    const hookItems = items.filter((i) => i.itemType === "hook");
    const settingItems = items.filter((i) => i.itemType === "setting");

    // ── Resolve MCP servers ──
    const mcpServers: ResolvedMcpServer[] = [];
    for (const item of mcpItems) {
      const cfg = item.configJson as Record<string, unknown>;
      mcpServers.push({
        name: item.name,
        type: (cfg.type as string) ?? "http",
        url: cfg.url as string | undefined,
        command: cfg.command as string | undefined,
        args: cfg.args as string[] | undefined,
        headers: cfg.headers as Record<string, string> | undefined,
        env: cfg.env as Record<string, string> | undefined,
      });
    }

    // ── Resolve Skills ──
    const skills: ResolvedSkill[] = [];
    for (const item of skillItems) {
      const cfg = item.configJson as { frontmatter?: Record<string, unknown>; content?: string };

      // Load supporting files
      const files = await db
        .select({ path: configLayerFiles.path, content: configLayerFiles.content })
        .from(configLayerFiles)
        .where(sql`${configLayerFiles.itemId} = ${item.id}::uuid`);

      skills.push({
        name: item.name,
        frontmatter: cfg.frontmatter ?? {},
        content: cfg.content ?? "",
        files: files.map((f) => ({ path: f.path, content: f.content })),
      });
    }

    // ── Resolve Hooks ──
    const hooks: ResolvedHook[] = hookItems.map((item) => {
      const cfg = item.configJson as Record<string, unknown>;
      return {
        event: cfg.event as string,
        matcher: cfg.matcher as string | undefined,
        hookType: cfg.hookType as string,
        command: cfg.command as string | undefined,
        url: cfg.url as string | undefined,
        prompt: cfg.prompt as string | undefined,
        timeout: cfg.timeout as number | undefined,
        async: cfg.async as boolean | undefined,
        once: cfg.once as boolean | undefined,
      };
    });

    // ── Resolve Settings ──
    const settings: ResolvedSettings = {};
    for (const item of settingItems) {
      const cfg = item.configJson as { key?: string; value?: unknown };
      if (cfg.key) {
        settings[cfg.key] = cfg.value;
      }
    }

    return { mcpServers, skills, hooks, settings, warnings };
  }

  /**
   * Generate .mcp.json content for Claude Code runtime.
   */
  function generateMcpJson(mcpServers: ResolvedMcpServer[]): Record<string, unknown> {
    const mcpConfig: Record<string, unknown> = {};
    for (const server of mcpServers) {
      if (server.type === "http" || server.type === "sse") {
        mcpConfig[server.name] = {
          type: server.type,
          url: server.url,
          ...(server.headers ? { headers: server.headers } : {}),
        };
      } else if (server.type === "stdio") {
        mcpConfig[server.name] = {
          type: "stdio",
          command: server.command,
          args: server.args ?? [],
          env: server.env ?? {},
        };
      }
    }
    return { mcpServers: mcpConfig };
  }

  /**
   * Generate settings.json content for Claude Code runtime.
   */
  function generateSettingsJson(
    hooks: ResolvedHook[],
    settings: ResolvedSettings,
  ): Record<string, unknown> {
    const hooksByEvent: Record<string, unknown[]> = {};
    for (const hook of hooks) {
      if (!hooksByEvent[hook.event]) hooksByEvent[hook.event] = [];
      const hookDef: Record<string, unknown> = { type: hook.hookType };
      if (hook.command) hookDef.command = hook.command;
      if (hook.url) hookDef.url = hook.url;
      if (hook.prompt) hookDef.prompt = hook.prompt;
      if (hook.matcher) hookDef.matcher = hook.matcher;
      if (hook.timeout) hookDef.timeout = hook.timeout;
      hooksByEvent[hook.event]!.push(hookDef);
    }

    return {
      ...settings,
      hooks: hooksByEvent,
    };
  }

  return {
    resolveConfigForRun,
    executeMergeQuery,
    invalidateCache,
    invalidateCompanyCache,
    generateMcpJson,
    generateSettingsJson,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/src/services/config-layer-runtime.ts
git commit -m "feat(config-layers): add runtime merge service with cache + file generation"
```

---

### Task 2: MCP Credential Service

**Files:**
- Create: `server/src/services/mcp-credential.ts`

- [ ] **Step 1: Write the credential service**

```typescript
import { and, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { userMcpCredentials } from "@mnm/db";
import { notFound } from "../errors.js";
import { auditService } from "./audit.js";
import { logger } from "../middleware/logger.js";

// AES-256-GCM encryption using existing pattern from local-encrypted-provider.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_KEY = process.env.MNM_SECRETS_KEY
  ? Buffer.from(process.env.MNM_SECRETS_KEY, "hex")
  : randomBytes(32); // Dev fallback — NOT for production

function encrypt(plaintext: string): { iv: string; ciphertext: string; tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    ciphertext: encrypted.toString("hex"),
    tag: tag.toString("hex"),
  };
}

function decrypt(material: { iv: string; ciphertext: string; tag: string }): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    ENCRYPTION_KEY,
    Buffer.from(material.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(material.tag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(material.ciphertext, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function mcpCredentialService(db: Db) {
  const audit = auditService(db);

  async function storeCredential(
    userId: string,
    companyId: string,
    itemId: string,
    provider: string,
    material: Record<string, unknown>,
    expiresAt?: Date,
  ) {
    const encrypted = encrypt(JSON.stringify(material));
    const maxTtlAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    const [cred] = await db
      .insert(userMcpCredentials)
      .values({
        userId,
        companyId,
        itemId,
        provider,
        material: encrypted,
        status: "connected",
        connectedAt: new Date(),
        expiresAt: expiresAt ?? null,
        maxTtlAt,
      })
      .onConflictDoUpdate({
        target: [userMcpCredentials.userId, userMcpCredentials.companyId, userMcpCredentials.itemId],
        set: {
          material: encrypted,
          status: "connected",
          connectedAt: new Date(),
          expiresAt: expiresAt ?? null,
          maxTtlAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    await audit.emit({
      companyId,
      actorId: userId,
      actorType: "user",
      action: "mcp_credential.connected",
      targetType: "mcp_credential",
      targetId: cred!.id,
      metadata: { itemId, provider },
    }).catch(() => {});

    return cred!;
  }

  async function getDecryptedMaterial(
    userId: string,
    companyId: string,
    itemId: string,
  ): Promise<Record<string, unknown> | null> {
    const [cred] = await db
      .select()
      .from(userMcpCredentials)
      .where(and(
        eq(userMcpCredentials.userId, userId),
        eq(userMcpCredentials.companyId, companyId),
        eq(userMcpCredentials.itemId, itemId),
        eq(userMcpCredentials.status, "connected"),
      ));

    if (!cred) return null;

    try {
      const material = cred.material as { iv: string; ciphertext: string; tag: string };
      const decrypted = decrypt(material);
      return JSON.parse(decrypted);
    } catch (err) {
      logger.error({ userId, itemId, error: err }, "Failed to decrypt MCP credential");

      await audit.emit({
        companyId,
        actorId: userId,
        actorType: "user",
        action: "mcp_credential.decryption_failed",
        targetType: "mcp_credential",
        targetId: cred.id,
        severity: "warn",
        metadata: { itemId },
      }).catch(() => {});

      return null;
    }
  }

  async function listUserCredentials(userId: string, companyId: string) {
    return db
      .select({
        id: userMcpCredentials.id,
        itemId: userMcpCredentials.itemId,
        provider: userMcpCredentials.provider,
        status: userMcpCredentials.status,
        statusMessage: userMcpCredentials.statusMessage,
        connectedAt: userMcpCredentials.connectedAt,
        expiresAt: userMcpCredentials.expiresAt,
        updatedAt: userMcpCredentials.updatedAt,
      })
      .from(userMcpCredentials)
      .where(and(
        eq(userMcpCredentials.userId, userId),
        eq(userMcpCredentials.companyId, companyId),
      ));
  }

  async function revoke(credentialId: string, userId: string, companyId: string) {
    const [cred] = await db
      .update(userMcpCredentials)
      .set({
        material: {} as any, // Clear material immediately
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(and(
        eq(userMcpCredentials.id, credentialId),
        eq(userMcpCredentials.userId, userId),
      ))
      .returning();

    if (!cred) throw notFound("Credential not found");

    await audit.emit({
      companyId,
      actorId: userId,
      actorType: "user",
      action: "mcp_credential.revoked",
      targetType: "mcp_credential",
      targetId: credentialId,
      metadata: { itemId: cred.itemId },
    }).catch(() => {});

    return cred;
  }

  /**
   * Background job: refresh expiring credentials.
   * Called periodically (every 5 min).
   */
  async function refreshExpiring() {
    const threshold = new Date(Date.now() + 15 * 60 * 1000); // 15 min from now
    const expiring = await db
      .select()
      .from(userMcpCredentials)
      .where(and(
        eq(userMcpCredentials.status, "connected"),
        lt(userMcpCredentials.expiresAt, threshold),
      ));

    for (const cred of expiring) {
      try {
        const material = cred.material as { iv: string; ciphertext: string; tag: string };
        const decrypted = JSON.parse(decrypt(material));

        if (!decrypted.refreshToken) {
          // No refresh token — mark as expired
          await db
            .update(userMcpCredentials)
            .set({ status: "expired", statusMessage: "No refresh token", updatedAt: new Date() })
            .where(eq(userMcpCredentials.id, cred.id));
          continue;
        }

        // TODO: Implement actual OAuth2 refresh token exchange
        // This depends on the MCP item's OAuth config (tokenUrl, clientId, etc.)
        // For now, mark as expired — the user will need to re-authenticate
        logger.warn({ credId: cred.id, itemId: cred.itemId }, "Credential refresh not yet implemented");
        await db
          .update(userMcpCredentials)
          .set({ status: "expired", statusMessage: "Refresh not yet implemented", updatedAt: new Date() })
          .where(eq(userMcpCredentials.id, cred.id));
      } catch (err) {
        logger.error({ credId: cred.id, error: err }, "Failed to refresh MCP credential");
        await db
          .update(userMcpCredentials)
          .set({ status: "error", statusMessage: String(err), updatedAt: new Date() })
          .where(eq(userMcpCredentials.id, cred.id));
      }
    }
  }

  return {
    storeCredential,
    getDecryptedMaterial,
    listUserCredentials,
    revoke,
    refreshExpiring,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/src/services/mcp-credential.ts
git commit -m "feat(config-layers): add MCP credential service with AES-256-GCM encryption"
```

---

### Task 3: OAuth Flow Service + Routes

**Files:**
- Create: `server/src/services/mcp-oauth.ts`
- Create: `server/src/routes/mcp-oauth.ts`

- [ ] **Step 1: Write the OAuth service**

```typescript
import { randomBytes, createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { configLayerItems } from "@mnm/db";
import { logger } from "../middleware/logger.js";
import { badRequest, notFound } from "../errors.js";
import { mcpCredentialService } from "./mcp-credential.js";

// In-memory state store (Redis in production)
const pendingStates = new Map<string, {
  userId: string;
  companyId: string;
  itemId: string;
  codeVerifier: string;
  createdAt: number;
}>();

// Cleanup expired states every minute
setInterval(() => {
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, val] of pendingStates) {
    if (val.createdAt < tenMinAgo) pendingStates.delete(key);
  }
}, 60_000);

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function mcpOauthService(db: Db) {
  const credSvc = mcpCredentialService(db);

  /**
   * Initiate OAuth flow — returns authorization URL for popup.
   */
  async function initiateAuthorize(
    userId: string,
    companyId: string,
    itemId: string,
    callbackUrl: string,
  ): Promise<string> {
    // Load the MCP item to get OAuth config
    const [item] = await db
      .select()
      .from(configLayerItems)
      .where(eq(configLayerItems.id, itemId));

    if (!item) throw notFound("MCP item not found");

    const config = item.configJson as Record<string, unknown>;
    const oauth = config.oauth as {
      authorizationUrl: string;
      tokenUrl: string;
      scopes?: string[];
      clientId: { type: string; secretId: string } | string;
    } | undefined;

    if (!oauth) throw badRequest("MCP item has no OAuth configuration");

    // Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = randomBytes(16).toString("hex");

    // Store state
    pendingStates.set(state, {
      userId,
      companyId,
      itemId,
      codeVerifier,
      createdAt: Date.now(),
    });

    // Resolve client ID (could be a secret_ref)
    let clientId: string;
    if (typeof oauth.clientId === "object" && oauth.clientId.type === "secret_ref") {
      // TODO: Resolve from company secrets
      throw badRequest("secret_ref client ID resolution not yet implemented");
    } else {
      clientId = String(oauth.clientId);
    }

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: callbackUrl,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    if (oauth.scopes?.length) {
      params.set("scope", oauth.scopes.join(" "));
    }

    return `${oauth.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback — exchange code for tokens.
   */
  async function handleCallback(
    state: string,
    code: string,
    callbackUrl: string,
  ): Promise<{ userId: string; companyId: string; itemId: string }> {
    const pending = pendingStates.get(state);
    if (!pending) throw badRequest("Invalid or expired OAuth state");

    // Remove state (one-time use)
    pendingStates.delete(state);

    // Check expiry (10 min)
    if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
      throw badRequest("OAuth state expired");
    }

    // Load MCP item OAuth config
    const [item] = await db
      .select()
      .from(configLayerItems)
      .where(eq(configLayerItems.id, pending.itemId));

    if (!item) throw notFound("MCP item not found");

    const config = item.configJson as Record<string, unknown>;
    const oauth = config.oauth as {
      tokenUrl: string;
      clientId: { type: string; secretId: string } | string;
      clientSecret?: { type: string; secretId: string } | string;
    };

    // Resolve client credentials
    const clientId = typeof oauth.clientId === "object" ? "TODO" : String(oauth.clientId);
    const clientSecret = oauth.clientSecret
      ? (typeof oauth.clientSecret === "object" ? "TODO" : String(oauth.clientSecret))
      : undefined;

    // Exchange code for tokens
    const tokenBody: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: clientId,
      code_verifier: pending.codeVerifier,
    };
    if (clientSecret) tokenBody.client_secret = clientSecret;

    const tokenResponse = await fetch(oauth.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenBody),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      logger.error({ status: tokenResponse.status, body: errText }, "OAuth token exchange failed");
      throw badRequest("OAuth token exchange failed");
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in?: number;
      scope?: string;
    };

    // Calculate expiry
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    // Store encrypted credential
    await credSvc.storeCredential(
      pending.userId,
      pending.companyId,
      pending.itemId,
      "oauth2",
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenType: tokens.token_type,
        expiresAt: expiresAt?.toISOString() ?? null,
        scopes: tokens.scope?.split(" ") ?? [],
      },
      expiresAt,
    );

    return {
      userId: pending.userId,
      companyId: pending.companyId,
      itemId: pending.itemId,
    };
  }

  return { initiateAuthorize, handleCallback };
}
```

- [ ] **Step 2: Write the OAuth routes**

```typescript
import { Router } from "express";
import type { Db } from "@mnm/db";
import { mcpOauthService } from "../services/mcp-oauth.js";
import { mcpCredentialService } from "../services/mcp-credential.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess } from "./authz.js";

export function mcpOauthRoutes(db: Db) {
  const router = Router();
  const oauth = mcpOauthService(db);
  const creds = mcpCredentialService(db);

  function actorId(req: Express.Request): string {
    return (req as any).actor?.type === "board"
      ? ((req as any).actor.userId ?? "system")
      : "system";
  }

  // ── GET /companies/:companyId/mcp-credentials ── List my connections
  router.get(
    "/companies/:companyId/mcp-credentials",
    requirePermission(db, "mcp:connect"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const userId = actorId(req);

      const credentials = await creds.listUserCredentials(userId, companyId);
      res.json(credentials);
    },
  );

  // ── GET /oauth/authorize/:itemId ── Initiate OAuth (popup redirect)
  router.get(
    "/oauth/authorize/:itemId",
    async (req, res) => {
      const itemId = req.params.itemId as string;
      const userId = actorId(req);
      const companyId = req.params.companyId as string ??
        (req as any).actor?.companyIds?.[0];

      if (!companyId) {
        res.status(400).send("No company context");
        return;
      }

      const callbackUrl = `${req.protocol}://${req.get("host")}/api/oauth/callback`;
      const authorizeUrl = await oauth.initiateAuthorize(userId, companyId, itemId, callbackUrl);
      res.redirect(authorizeUrl);
    },
  );

  // ── GET /oauth/callback ── OAuth callback
  router.get(
    "/oauth/callback",
    async (req, res) => {
      const { state, code, error } = req.query;

      if (error) {
        // Close popup with error
        res.send(`<html><body><script>
          window.opener?.postMessage({ type: 'oauth_error', error: '${String(error)}' }, '*');
          window.close();
        </script></body></html>`);
        return;
      }

      if (!state || !code) {
        res.status(400).send("Missing state or code");
        return;
      }

      try {
        const callbackUrl = `${req.protocol}://${req.get("host")}/api/oauth/callback`;
        const result = await oauth.handleCallback(
          String(state),
          String(code),
          callbackUrl,
        );

        // Close popup with success — parent window will invalidate queries
        res.send(`<html><body><script>
          window.opener?.postMessage({
            type: 'oauth_success',
            itemId: '${result.itemId}'
          }, '*');
          window.close();
        </script></body></html>`);
      } catch (err) {
        res.send(`<html><body><script>
          window.opener?.postMessage({
            type: 'oauth_error',
            error: '${String(err)}'
          }, '*');
          window.close();
        </script></body></html>`);
      }
    },
  );

  // ── DELETE /mcp-credentials/:id ── Revoke
  router.delete(
    "/mcp-credentials/:id",
    requirePermission(db, "mcp:connect"),
    async (req, res) => {
      const credentialId = req.params.id as string;
      const userId = actorId(req);
      const companyId = req.params.companyId as string ??
        (req as any).actor?.companyIds?.[0];

      if (!companyId) {
        res.status(400).json({ error: "No company context" });
        return;
      }

      await creds.revoke(credentialId, userId, companyId);
      res.status(204).end();
    },
  );

  return router;
}
```

- [ ] **Step 3: Register routes**

Add to `server/src/routes/index.ts`:
```typescript
export { mcpOauthRoutes } from "./mcp-oauth.js";
```

Add to `server/src/app.ts` after the config layer routes:
```typescript
  // CONFIG-LAYERS: OAuth routes for MCP credentials
  api.use(mcpOauthRoutes(db));
```

- [ ] **Step 4: Verify build**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add server/src/services/mcp-oauth.ts server/src/routes/mcp-oauth.ts server/src/routes/index.ts server/src/app.ts
git commit -m "feat(config-layers): add OAuth2 PKCE flow for MCP credentials"
```

---

### Task 4: Heartbeat Integration

**Files:**
- Modify: `server/src/services/heartbeat.ts`

- [ ] **Step 1: Add import for config layer runtime**

Add at top of `server/src/services/heartbeat.ts`:

```typescript
import { configLayerRuntimeService } from "./config-layer-runtime.js";
```

- [ ] **Step 2: Replace adapterConfig parsing with resolveConfigForRun**

In the heartbeat `runLoop` function, find the section around line 1313 where `adapterConfig` is parsed:

```typescript
      const config = parseObject(agent.adapterConfig);
      const mergedConfig = issueAssigneeOverrides?.adapterConfig
        ? { ...config, ...issueAssigneeOverrides.adapterConfig }
        : config;
```

Replace with:

```typescript
      // If agent has a base_layer_id, use config layers system
      let resolvedConfig: Record<string, unknown>;
      const configLayerRuntime = configLayerRuntimeService(db);

      if (agent.baseLayerId) {
        const layerConfig = await configLayerRuntime.resolveConfigForRun(
          agent.companyId,
          agent.id,
          agent.createdByUserId ?? actorUserId ?? "system",
        );

        // Build a legacy-compatible config from resolved layers
        const baseConfig: Record<string, unknown> = { ...layerConfig.settings };
        if (layerConfig.mcpServers.length > 0) {
          baseConfig.mcpServers = configLayerRuntime.generateMcpJson(layerConfig.mcpServers);
        }

        // Merge with issue overrides (if any)
        resolvedConfig = issueAssigneeOverrides?.adapterConfig
          ? { ...baseConfig, ...issueAssigneeOverrides.adapterConfig }
          : baseConfig;

        // Log warnings from layer resolution
        for (const warning of layerConfig.warnings) {
          await onLog("stderr", `[mnm] config-layer warning: ${warning}\n`);
        }
      } else {
        // Legacy path: parse adapterConfig directly
        const config = parseObject(agent.adapterConfig);
        resolvedConfig = issueAssigneeOverrides?.adapterConfig
          ? { ...config, ...issueAssigneeOverrides.adapterConfig }
          : config;
      }

      const mergedConfig = resolvedConfig;
```

Note: The variable `mergedConfig` is used downstream in the heartbeat. This preserves backward compatibility: agents without `base_layer_id` continue to use the old `adapterConfig` path.

- [ ] **Step 3: Verify build**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/src/services/heartbeat.ts
git commit -m "feat(config-layers): integrate runtime merge into heartbeat — dual-path with legacy fallback"
```

---

### Task 5: Data Migration — adapterConfig to Base Layers

**Files:**
- Create: `packages/db/src/migrations/0054_migrate_adapter_config.sql`

- [ ] **Step 1: Write the data migration**

```sql
-- CONFIG-LAYERS: Migrate existing agent adapterConfig to base layers
-- This runs AFTER 0052 (tables) and 0053 (base_layer_id column)
-- Safe: creates new data only, does not delete adapterConfig (kept as cache)

-- For each agent that has a non-empty adapterConfig and no base_layer_id yet:
-- 1. Create a config_layer (scope=private, is_base_layer=true)
-- 2. Extract model setting if present -> config_layer_item (type=setting)
-- 3. Extract env settings if present -> config_layer_items (type=setting)
-- 4. Set agents.base_layer_id

-- Note: This is a PL/pgSQL DO block for the data migration.
-- It runs within the migration transaction.

DO $$
DECLARE
  agent_rec RECORD;
  new_layer_id uuid;
  cfg jsonb;
  runtime_cfg jsonb;
  setting_key text;
  setting_value jsonb;
BEGIN
  FOR agent_rec IN
    SELECT id, company_id, name, adapter_config, runtime_config, created_by_user_id
    FROM agents
    WHERE base_layer_id IS NULL
      AND (adapter_config IS NOT NULL AND adapter_config != '{}'::jsonb)
  LOOP
    -- Create base layer
    INSERT INTO config_layers (company_id, name, scope, visibility, is_base_layer, created_by_user_id, owner_type)
    VALUES (
      agent_rec.company_id,
      'Base: ' || agent_rec.name,
      'private',
      'private',
      true,
      COALESCE(agent_rec.created_by_user_id, 'system'),
      'user'
    )
    RETURNING id INTO new_layer_id;

    cfg := agent_rec.adapter_config;
    runtime_cfg := COALESCE(agent_rec.runtime_config, '{}'::jsonb);

    -- Extract model setting
    IF cfg ? 'model' THEN
      INSERT INTO config_layer_items (company_id, layer_id, item_type, name, config_json)
      VALUES (agent_rec.company_id, new_layer_id, 'setting', 'model',
              jsonb_build_object('key', 'model', 'value', cfg->'model'));
    END IF;

    -- Extract cwd setting
    IF cfg ? 'cwd' THEN
      INSERT INTO config_layer_items (company_id, layer_id, item_type, name, config_json)
      VALUES (agent_rec.company_id, new_layer_id, 'setting', 'cwd',
              jsonb_build_object('key', 'cwd', 'value', cfg->'cwd'));
    END IF;

    -- Extract timeoutSec from runtime config
    IF runtime_cfg ? 'heartbeat' AND (runtime_cfg->'heartbeat') ? 'timeoutSec' THEN
      INSERT INTO config_layer_items (company_id, layer_id, item_type, name, config_json)
      VALUES (agent_rec.company_id, new_layer_id, 'setting', 'timeoutSec',
              jsonb_build_object('key', 'timeoutSec', 'value', runtime_cfg->'heartbeat'->'timeoutSec'));
    END IF;

    -- Extract env vars as individual settings
    IF cfg ? 'env' AND jsonb_typeof(cfg->'env') = 'object' THEN
      FOR setting_key, setting_value IN SELECT * FROM jsonb_each(cfg->'env')
      LOOP
        INSERT INTO config_layer_items (company_id, layer_id, item_type, name, config_json)
        VALUES (agent_rec.company_id, new_layer_id, 'setting', 'env.' || setting_key,
                jsonb_build_object('key', 'env.' || setting_key, 'value', setting_value));
      END LOOP;
    END IF;

    -- Create initial revision
    INSERT INTO config_layer_revisions (company_id, layer_id, version, changed_keys, after_snapshot, changed_by, change_source)
    VALUES (agent_rec.company_id, new_layer_id, 1, '["migration"]'::jsonb,
            jsonb_build_object('source', 'adapterConfig', 'agent_id', agent_rec.id::text),
            COALESCE(agent_rec.created_by_user_id, 'system'), 'migration');

    -- Link base layer to agent
    UPDATE agents SET base_layer_id = new_layer_id WHERE id = agent_rec.id;
  END LOOP;
END
$$;
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/migrations/0054_migrate_adapter_config.sql
git commit -m "feat(config-layers): add migration 0054 — migrate adapterConfig to base layers"
```

---

### Task 6: Verify Full Integration

**Files:** (none — verification only)

- [ ] **Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: All packages pass

- [ ] **Step 2: Start dev server**

Run: `bun run dev`
Expected: Migrations 0052-0054 apply. Server starts. Existing agents get base layers.

- [ ] **Step 3: Verify merge preview endpoint**

After creating a test agent, call the merge preview:

Run: `curl -s http://127.0.0.1:3100/api/agents/{agentId}/config-layers/preview | jq .`
Expected: JSON with merged items from the auto-created base layer

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix(config-layers): resolve integration issues from runtime + migration"
```

---

## End of Plan 2/3

This plan adds:
- **Runtime merge engine** with 1-min TTL cache and single `resolveConfigForRun()` entry point
- **Heartbeat dual-path** — agents with `base_layer_id` use config layers, others use legacy `adapterConfig`
- **MCP credential storage** with AES-256-GCM encryption
- **OAuth2 PKCE flow** with popup window pattern
- **Data migration** from `adapterConfig` to base layers

**Next plan:**
- **Plan 3/3:** `2026-04-02-config-layers-frontend.md` — API client, query keys, layer editors, agent layers tab, OAuth connect button, marketplace
