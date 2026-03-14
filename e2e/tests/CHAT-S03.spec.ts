/**
 * CHAT-S03: ChatService Pipe stdin -- E2E Tests
 *
 * These tests verify the deliverables of CHAT-S03:
 *   - Groupe 1: ContainerPipeService -- service file and exports (T01-T07)
 *   - Groupe 2: Stdout/stderr handling (T08-T10)
 *   - Groupe 3: Docker exec and auto-cleanup (T11-T13)
 *   - Groupe 4: ChatWsManager integration (T14-T16)
 *   - Groupe 5: Routes REST (T17-T27)
 *   - Groupe 6: Validator (T28-T30)
 *   - Groupe 7: Shared types (T31-T33)
 *   - Groupe 8: LiveEvent types (T34-T36)
 *   - Groupe 9: Barrel exports (T37-T41)
 *   - Groupe 10: Regressions (T42-T44)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const PIPE_SERVICE_FILE = resolve(ROOT, "server/src/services/container-pipe.ts");
const WS_MANAGER_FILE = resolve(ROOT, "server/src/services/chat-ws-manager.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/chat.ts");
const VALIDATOR_FILE = resolve(ROOT, "server/src/validators/chat-ws.ts");
const SHARED_TYPES_FILE = resolve(ROOT, "packages/shared/src/types/chat-ws.ts");
const SHARED_TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const CONSTANTS_FILE = resolve(ROOT, "packages/shared/src/constants.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const CONTAINER_MANAGER_FILE = resolve(ROOT, "server/src/services/container-manager.ts");

// ---------------------------------------------------------------------------
// Groupe 1: ContainerPipeService -- service file and exports (T01-T07)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: ContainerPipeService -- service and functions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PIPE_SERVICE_FILE, "utf-8");
  });

  test("T01 -- container-pipe.ts exists and exports createContainerPipeManager @chat-s03-pipe-service", () => {
    expect(content).toContain("export function createContainerPipeManager");
  });

  test("T02 -- container-pipe.ts contains attachPipe function @chat-s03-pipe-attach-fn", () => {
    expect(content).toMatch(/async function attachPipe/);
  });

  test("T03 -- container-pipe.ts contains detachPipe function @chat-s03-pipe-detach-fn", () => {
    expect(content).toMatch(/async function detachPipe/);
  });

  test("T04 -- container-pipe.ts contains getPipeStatus function @chat-s03-pipe-status-fn", () => {
    expect(content).toMatch(/function getPipeStatus/);
  });

  test("T05 -- container-pipe.ts contains pipeMessageToContainer function @chat-s03-pipe-to-container", () => {
    expect(content).toMatch(/async function pipeMessageToContainer/);
  });

  test("T06 -- container-pipe.ts contains listActivePipes function @chat-s03-list-active-pipes", () => {
    expect(content).toMatch(/function listActivePipes/);
  });

  test("T07 -- container-pipe.ts contains cleanup function @chat-s03-cleanup", () => {
    expect(content).toMatch(/async function cleanup/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Stdout/stderr handling (T08-T10)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Stdout/stderr handling", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PIPE_SERVICE_FILE, "utf-8");
  });

  test("T08 -- container-pipe.ts implements stdout debounce/buffer with 200ms timeout @chat-s03-debounce-flush", () => {
    // Verify debounce constant exists
    expect(content).toMatch(/STDOUT_DEBOUNCE_MS\s*=\s*200/);
    // Verify buffer max size exists
    expect(content).toMatch(/STDOUT_MAX_BUFFER\s*=\s*4000/);
    // Verify flush function
    expect(content).toContain("flushStdoutBuffer");
    // Verify appendToStdoutBuffer with debounce logic
    expect(content).toContain("appendToStdoutBuffer");
    expect(content).toContain("setTimeout");
  });

  test("T09 -- container-pipe.ts creates system messages from stderr @chat-s03-stderr-handler", () => {
    // Verify stderr creates messages with messageType system
    expect(content).toContain("flushStderrBuffer");
    expect(content).toContain("appendToStderrBuffer");
    // Verify system messageType for stderr
    expect(content).toMatch(/messageType.*system/);
    // Verify stream metadata
    expect(content).toMatch(/stream.*stderr/);
  });

  test("T10 -- container-pipe.ts creates agent messages from stdout via chatService.createMessage @chat-s03-stdout-handler", () => {
    // Verify stdout handler calls createMessage with agent senderType
    expect(content).toContain("svc.createMessage");
    // Verify senderType is agent in stdout handler
    expect(content).toMatch(/createMessage[\s\S]*?"agent"[\s\S]*?stream.*stdout/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Docker exec and auto-cleanup (T11-T13)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Docker exec and auto-cleanup", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PIPE_SERVICE_FILE, "utf-8");
  });

  test("T11 -- container-pipe.ts uses docker exec with stdin/stdout attached @chat-s03-pipe-service", () => {
    // Verify container.exec call with AttachStdin and AttachStdout
    expect(content).toContain("container.exec");
    expect(content).toContain("AttachStdin: true");
    expect(content).toContain("AttachStdout: true");
    expect(content).toContain("AttachStderr: true");
  });

  test("T12 -- container-pipe.ts auto-detaches pipe when stream ends @chat-s03-cleanup", () => {
    // Verify stream end handling with auto-detach
    expect(content).toMatch(/\.on\(\s*["']end["']/);
    // Verify status change on stream end
    expect(content).toMatch(/status.*=.*"detached"/);
    expect(content).toContain("cleanupPipeResources");
  });

  test("T13 -- container-pipe.ts prevents double attach (conflict check) @chat-s03-pipe-service", () => {
    // Verify double attach prevention
    expect(content).toContain("PIPE_ALREADY_ATTACHED");
    expect(content).toMatch(/activePipes\.has\(channelId\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: ChatWsManager integration (T14-T16)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: ChatWsManager integration", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(WS_MANAGER_FILE, "utf-8");
  });

  test("T14 -- chat-ws-manager.ts forwards user messages to pipe @chat-s03-ws-pipe-forward", () => {
    // Verify pipe forward logic in handleMessage
    expect(content).toContain("containerPipeManager");
    expect(content).toContain("pipeMessageToContainer");
    // Verify it only forwards user messages (not agent)
    expect(content).toMatch(/actorType\s*===\s*["']user["'].*containerPipeManager/);
  });

  test("T15 -- chat-ws-manager.ts has setContainerPipeManager setter @chat-s03-pipe-manager-setter", () => {
    // Verify setter method
    expect(content).toContain("setContainerPipeManager");
    expect(content).toMatch(/setContainerPipeManager\(manager:\s*ContainerPipeManager\)/);
  });

  test("T16 -- chat-ws-manager.ts checks pipeStatus before forward @chat-s03-ws-pipe-forward", () => {
    // Verify pipe status check before forwarding
    expect(content).toContain("getPipeStatus");
    expect(content).toMatch(/pipeStatus\?\.status\s*===\s*["']attached["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Routes REST (T17-T27)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Routes REST", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T17 -- chat.ts has POST /pipe route @chat-s03-pipe-attach", () => {
    expect(content).toMatch(
      /router\.post\(\s*\n?\s*["']\/companies\/:companyId\/chat\/channels\/:channelId\/pipe["']/,
    );
  });

  test("T18 -- chat.ts has DELETE /pipe route @chat-s03-pipe-detach", () => {
    expect(content).toMatch(
      /router\.delete\(\s*\n?\s*["']\/companies\/:companyId\/chat\/channels\/:channelId\/pipe["']/,
    );
  });

  test("T19 -- chat.ts has GET /pipe route @chat-s03-pipe-status", () => {
    // Find GET route for pipe (not the channel GET)
    const pipeGetMatch = content.match(
      /router\.get\(\s*\n?\s*["']\/companies\/:companyId\/chat\/channels\/:channelId\/pipe["']/,
    );
    expect(pipeGetMatch).toBeTruthy();
  });

  test("T20 -- POST /pipe validates instanceId with pipeAttachSchema @chat-s03-pipe-attach", () => {
    expect(content).toContain("pipeAttachSchema");
    expect(content).toContain("pipeAttachSchema.safeParse");
  });

  test("T21 -- POST /pipe verifies channel ownership (companyId) @chat-s03-pipe-attach", () => {
    // Verify assertCompanyAccess is called (already required)
    expect(content).toContain("assertCompanyAccess");
    // Verify channel.companyId check
    expect(content).toMatch(/channel\.companyId\s*!==\s*companyId/);
  });

  test("T22 -- POST /pipe verifies container running status @chat-s03-pipe-attach", () => {
    // The service checks CONTAINER_NOT_RUNNING error
    expect(content).toContain("CONTAINER_NOT_RUNNING");
  });

  test("T23 -- POST /pipe returns 409 if pipe already attached @chat-s03-pipe-attach", () => {
    expect(content).toContain("PIPE_ALREADY_ATTACHED");
    expect(content).toMatch(/throw\s+conflict/);
  });

  test("T24 -- POST /pipe emits audit chat.pipe_attached @chat-s03-audit-attached", () => {
    expect(content).toContain("chat-s03-audit-attached");
    expect(content).toMatch(/emitAudit[\s\S]*?action:\s*["']chat\.pipe_attached["']/);
  });

  test("T25 -- DELETE /pipe emits audit chat.pipe_detached @chat-s03-audit-detached", () => {
    expect(content).toContain("chat-s03-audit-detached");
    expect(content).toMatch(/emitAudit[\s\S]*?action:\s*["']chat\.pipe_detached["']/);
  });

  test("T26 -- POST /pipe emits LiveEvent chat.pipe_attached @chat-s03-live-event-attached", async () => {
    // Verified in the service (container-pipe.ts publishes the event)
    const pipeContent = await readFile(PIPE_SERVICE_FILE, "utf-8");
    expect(pipeContent).toMatch(/publishLiveEvent[\s\S]*?type:\s*["']chat\.pipe_attached["']/);
  });

  test("T27 -- DELETE /pipe emits LiveEvent chat.pipe_detached @chat-s03-live-event-detached", async () => {
    const pipeContent = await readFile(PIPE_SERVICE_FILE, "utf-8");
    expect(pipeContent).toMatch(/publishLiveEvent[\s\S]*?type:\s*["']chat\.pipe_detached["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Validator (T28-T30)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Validator", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(VALIDATOR_FILE, "utf-8");
  });

  test("T28 -- pipeAttachSchema validates instanceId as UUID @chat-s03-validator", () => {
    expect(content).toContain("pipeAttachSchema");
    expect(content).toMatch(/instanceId:\s*z\.string\(\)\.uuid\(\)/);
  });

  test("T29 -- pipeAttachSchema accepts optional execCommand array @chat-s03-validator", () => {
    expect(content).toMatch(
      /execCommand:\s*z\.array\(z\.string\(\)\)\.min\(1\)\.max\(10\)\.optional\(\)/,
    );
  });

  test("T30 -- pipeAttachSchema accepts optional tty boolean @chat-s03-validator", () => {
    expect(content).toMatch(/tty:\s*z\.boolean\(\)\.optional\(\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Shared types (T31-T33)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Shared types", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SHARED_TYPES_FILE, "utf-8");
  });

  test("T31 -- chat-ws.ts contains ContainerPipeStatus type @chat-s03-shared-types", () => {
    expect(content).toMatch(
      /export type ContainerPipeStatus\s*=\s*["']attached["']\s*\|\s*["']detached["']\s*\|\s*["']error["']/,
    );
  });

  test("T32 -- chat-ws.ts contains ChatPipeStatus interface @chat-s03-shared-types", () => {
    expect(content).toContain("export interface ChatPipeStatus");
    expect(content).toMatch(/channelId:\s*string/);
    expect(content).toMatch(/instanceId:\s*string/);
    expect(content).toMatch(/status:\s*ContainerPipeStatus/);
    expect(content).toMatch(/messagesPiped:\s*number/);
  });

  test("T33 -- chat-ws.ts contains ChatPipeAttachRequest interface @chat-s03-shared-types", () => {
    expect(content).toContain("export interface ChatPipeAttachRequest");
    expect(content).toMatch(/instanceId:\s*string/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: LiveEvent types (T34-T36)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: LiveEvent types", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(CONSTANTS_FILE, "utf-8");
  });

  test('T34 -- LIVE_EVENT_TYPES contains "chat.pipe_attached" @chat-s03-live-event-attached', () => {
    expect(content).toContain('"chat.pipe_attached"');
  });

  test('T35 -- LIVE_EVENT_TYPES contains "chat.pipe_detached" @chat-s03-live-event-detached', () => {
    expect(content).toContain('"chat.pipe_detached"');
  });

  test('T36 -- LIVE_EVENT_TYPES contains "chat.pipe_error" @chat-s03-live-event-error', () => {
    expect(content).toContain('"chat.pipe_error"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Barrel exports (T37-T41)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Barrel exports", () => {
  test("T37 -- services/index.ts exports createContainerPipeManager @chat-s03-barrel-svc", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toContain("createContainerPipeManager");
    expect(content).toMatch(
      /export\s*\{[^}]*createContainerPipeManager[^}]*\}\s*from\s*["']\.\/container-pipe/,
    );
  });

  test("T38 -- services/index.ts exports ContainerPipeManager type @chat-s03-barrel-svc", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toContain("ContainerPipeManager");
    expect(content).toMatch(/type\s+ContainerPipeManager/);
  });

  test("T39 -- types/index.ts exports ContainerPipeStatus @chat-s03-barrel-types", async () => {
    const content = await readFile(SHARED_TYPES_INDEX, "utf-8");
    expect(content).toContain("ContainerPipeStatus");
  });

  test("T40 -- types/index.ts exports ChatPipeStatus @chat-s03-barrel-types", async () => {
    const content = await readFile(SHARED_TYPES_INDEX, "utf-8");
    expect(content).toContain("ChatPipeStatus");
  });

  test("T41 -- types/index.ts exports ChatPipeAttachRequest @chat-s03-barrel-types", async () => {
    const content = await readFile(SHARED_TYPES_INDEX, "utf-8");
    expect(content).toContain("ChatPipeAttachRequest");
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Regressions (T42-T44)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Regressions", () => {
  test("T42 -- CHAT-S01 chat-ws-manager.ts has no breaking changes @regression", async () => {
    const content = await readFile(WS_MANAGER_FILE, "utf-8");
    // Verify all original functions still exist
    expect(content).toContain("addConnection");
    expect(content).toContain("removeConnection");
    expect(content).toContain("handleMessage");
    expect(content).toContain("handleSyncRequest");
    expect(content).toContain("closeChannel");
    expect(content).toContain("getConnectionCount");
    // Verify the export type is still present
    expect(content).toContain("export type ChatWsManager");
    // Verify the manager options interface
    expect(content).toContain("export interface ChatWsManagerOptions");
    // Verify createChatWsManager export
    expect(content).toContain("export function createChatWsManager");
  });

  test("T43 -- CHAT-S02 routes count in chat.ts is >= 10 (7 CHAT-S02 + 3 CHAT-S03) @regression", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Count router.METHOD calls
    const routeMatches = content.match(/router\.(get|post|put|patch|delete)\(/g);
    expect(routeMatches).toBeTruthy();
    expect(routeMatches!.length).toBeGreaterThanOrEqual(10);
  });

  test("T44 -- CONT-S01 container-manager.ts exports are intact @regression", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // Verify key exports still exist
    expect(content).toContain("export function containerManagerService");
    expect(content).toContain("export function buildDockerCreateOptions");
    expect(content).toContain("export function parseDockerStats");
    // Verify key functions
    expect(content).toContain("launchContainer");
    expect(content).toContain("stopContainer");
    expect(content).toContain("getContainerStatus");
    expect(content).toContain("listContainers");
    expect(content).toContain("checkDockerHealth");
  });
});
