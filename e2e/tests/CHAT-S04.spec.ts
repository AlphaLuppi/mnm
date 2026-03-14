/**
 * CHAT-S04: AgentChatPanel UI -- E2E Tests
 *
 * These tests verify the deliverables of CHAT-S04:
 *   - Groupe 1: File existence (T01-T07)
 *   - Groupe 2: API client chat.ts (T08-T16)
 *   - Groupe 3: Query keys (T17-T20)
 *   - Groupe 4: useAgentChat hook (T21-T25)
 *   - Groupe 5: MessageBubble component (T26-T29)
 *   - Groupe 6: TypingIndicator component (T30-T31)
 *   - Groupe 7: ConnectionStatus component (T32-T34)
 *   - Groupe 8: PipeStatusIndicator component (T35-T37)
 *   - Groupe 9: AgentChatPanel component (T38-T42)
 *   - Groupe 10: Chat page + Route + Sidebar (T43-T47)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const API_CHAT_FILE = resolve(ROOT, "ui/src/api/chat.ts");
const API_INDEX_FILE = resolve(ROOT, "ui/src/api/index.ts");
const QUERY_KEYS_FILE = resolve(ROOT, "ui/src/lib/queryKeys.ts");
const HOOK_FILE = resolve(ROOT, "ui/src/hooks/useAgentChat.ts");
const MESSAGE_BUBBLE_FILE = resolve(ROOT, "ui/src/components/chat/MessageBubble.tsx");
const TYPING_INDICATOR_FILE = resolve(ROOT, "ui/src/components/chat/TypingIndicator.tsx");
const CONNECTION_STATUS_FILE = resolve(ROOT, "ui/src/components/chat/ConnectionStatus.tsx");
const PIPE_STATUS_FILE = resolve(ROOT, "ui/src/components/chat/PipeStatusIndicator.tsx");
const AGENT_CHAT_PANEL_FILE = resolve(ROOT, "ui/src/components/AgentChatPanel.tsx");
const CHAT_PAGE_FILE = resolve(ROOT, "ui/src/pages/Chat.tsx");
const APP_FILE = resolve(ROOT, "ui/src/App.tsx");
const SIDEBAR_FILE = resolve(ROOT, "ui/src/components/Sidebar.tsx");

// ---------------------------------------------------------------------------
// Groupe 1: File existence (T01-T07)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence", () => {
  test("T01 -- api/chat.ts exists", async () => {
    await expect(fsAccess(API_CHAT_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T02 -- hooks/useAgentChat.ts exists", async () => {
    await expect(fsAccess(HOOK_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T03 -- components/AgentChatPanel.tsx exists", async () => {
    await expect(fsAccess(AGENT_CHAT_PANEL_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T04 -- components/chat/MessageBubble.tsx exists", async () => {
    await expect(fsAccess(MESSAGE_BUBBLE_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T05 -- components/chat/TypingIndicator.tsx exists", async () => {
    await expect(fsAccess(TYPING_INDICATOR_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T06 -- components/chat/ConnectionStatus.tsx exists", async () => {
    await expect(fsAccess(CONNECTION_STATUS_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T07 -- components/chat/PipeStatusIndicator.tsx exists", async () => {
    await expect(fsAccess(PIPE_STATUS_FILE).then(() => true)).resolves.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: API client chat.ts (T08-T16)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: API client chat.ts", () => {
  test("T08 -- exports chatApi object", async () => {
    const content = await readFile(API_CHAT_FILE, "utf-8");
    expect(content).toMatch(/export\s+(const|function)\s+chatApi/);
  });

  test("T09 -- chatApi.listChannels calls GET /companies/:companyId/chat/channels", async () => {
    const content = await readFile(API_CHAT_FILE, "utf-8");
    expect(content).toContain("listChannels");
    expect(content).toMatch(/\/companies\/.*\/chat\/channels/);
    expect(content).toContain("api.get");
  });

  test("T10 -- chatApi.getChannel calls GET /companies/:companyId/chat/channels/:channelId", async () => {
    const content = await readFile(API_CHAT_FILE, "utf-8");
    expect(content).toContain("getChannel");
    expect(content).toMatch(/\/companies\/.*\/chat\/channels\/.*channelId/);
  });

  test("T11 -- chatApi.createChannel calls POST /companies/:companyId/chat/channels", async () => {
    const content = await readFile(API_CHAT_FILE, "utf-8");
    expect(content).toContain("createChannel");
    expect(content).toContain("api.post");
  });

  test("T12 -- chatApi.closeChannel calls PATCH /companies/:companyId/chat/channels/:channelId", async () => {
    const content = await readFile(API_CHAT_FILE, "utf-8");
    expect(content).toContain("closeChannel");
    expect(content).toContain("api.patch");
    expect(content).toContain("manual_close");
  });

  test("T13 -- chatApi.getMessages calls GET with /messages path", async () => {
    const content = await readFile(API_CHAT_FILE, "utf-8");
    expect(content).toContain("getMessages");
    expect(content).toMatch(/\/messages/);
  });

  test("T14 -- chatApi.getPipeStatus calls GET with /pipe path", async () => {
    const content = await readFile(API_CHAT_FILE, "utf-8");
    expect(content).toContain("getPipeStatus");
    expect(content).toMatch(/\/pipe/);
  });

  test("T15 -- imports api from ./client", async () => {
    const content = await readFile(API_CHAT_FILE, "utf-8");
    expect(content).toMatch(/import\s+.*\bapi\b.*from\s+["']\.\/client["']/);
  });

  test("T16 -- barrel export chatApi in api/index.ts", async () => {
    const content = await readFile(API_INDEX_FILE, "utf-8");
    expect(content).toMatch(/export\s+\{.*chatApi.*\}\s+from\s+["']\.\/chat["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Query keys (T17-T20)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Query keys", () => {
  test("T17 -- queryKeys.chat.channels key exists", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    expect(content).toMatch(/chat\s*:\s*\{/);
    expect(content).toContain("channels:");
  });

  test("T18 -- queryKeys.chat.detail key exists", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    // Find chat section and check for detail
    const chatSection = content.substring(content.indexOf("// CHAT-S04"));
    expect(chatSection).toContain("detail:");
  });

  test("T19 -- queryKeys.chat.messages key exists", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const chatSection = content.substring(content.indexOf("// CHAT-S04"));
    expect(chatSection).toContain("messages:");
  });

  test("T20 -- queryKeys.chat.pipeStatus key exists", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const chatSection = content.substring(content.indexOf("// CHAT-S04"));
    expect(chatSection).toContain("pipeStatus:");
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: useAgentChat hook (T21-T25)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: useAgentChat hook", () => {
  test("T21 -- exports useAgentChat function", async () => {
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+useAgentChat/);
  });

  test("T22 -- manages WebSocket connection state (ConnectionState type)", async () => {
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toContain("ConnectionState");
    expect(content).toContain("connectionState");
    expect(content).toContain('"connected"');
    expect(content).toContain('"reconnecting"');
    expect(content).toContain('"disconnected"');
  });

  test("T23 -- handles messages array with setMessages", async () => {
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toContain("messages");
    expect(content).toContain("setMessages");
    expect(content).toContain("ChatMessage");
  });

  test("T24 -- provides sendMessage function", async () => {
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toContain("sendMessage");
    expect(content).toContain("chat_message");
    expect(content).toContain("clientMessageId");
  });

  test("T25 -- tracks typing indicator state", async () => {
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toContain("isTyping");
    expect(content).toContain("typing_indicator");
    expect(content).toContain("typingSenderName");
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: MessageBubble component (T26-T29)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: MessageBubble component", () => {
  test("T26 -- exports MessageBubble component", async () => {
    const content = await readFile(MESSAGE_BUBBLE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+MessageBubble/);
  });

  test("T27 -- renders data-testid chat-s04-message", async () => {
    const content = await readFile(MESSAGE_BUBBLE_FILE, "utf-8");
    expect(content).toContain('data-testid="chat-s04-message"');
  });

  test("T28 -- distinguishes user vs agent via data-testid", async () => {
    const content = await readFile(MESSAGE_BUBBLE_FILE, "utf-8");
    expect(content).toContain("chat-s04-message-user");
    expect(content).toContain("chat-s04-message-agent");
  });

  test("T29 -- renders message content and timestamp", async () => {
    const content = await readFile(MESSAGE_BUBBLE_FILE, "utf-8");
    expect(content).toContain('data-testid="chat-s04-message-content"');
    expect(content).toContain('data-testid="chat-s04-message-time"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: TypingIndicator component (T30-T31)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: TypingIndicator component", () => {
  test("T30 -- exports TypingIndicator component", async () => {
    const content = await readFile(TYPING_INDICATOR_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+TypingIndicator/);
  });

  test("T31 -- renders data-testid chat-s04-typing", async () => {
    const content = await readFile(TYPING_INDICATOR_FILE, "utf-8");
    expect(content).toContain('data-testid="chat-s04-typing"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: ConnectionStatus component (T32-T34)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: ConnectionStatus component", () => {
  test("T32 -- exports ConnectionStatus component", async () => {
    const content = await readFile(CONNECTION_STATUS_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+ConnectionStatus/);
  });

  test("T33 -- renders data-testid chat-s04-connection", async () => {
    const content = await readFile(CONNECTION_STATUS_FILE, "utf-8");
    expect(content).toContain('data-testid="chat-s04-connection"');
  });

  test("T34 -- has connected/reconnecting/disconnected states", async () => {
    const content = await readFile(CONNECTION_STATUS_FILE, "utf-8");
    expect(content).toContain("chat-s04-connection-connected");
    expect(content).toContain("chat-s04-connection-reconnecting");
    expect(content).toContain("chat-s04-connection-disconnected");
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: PipeStatusIndicator component (T35-T37)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: PipeStatusIndicator component", () => {
  test("T35 -- exports PipeStatusIndicator component", async () => {
    const content = await readFile(PIPE_STATUS_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+PipeStatusIndicator/);
  });

  test("T36 -- renders data-testid chat-s04-pipe-status", async () => {
    const content = await readFile(PIPE_STATUS_FILE, "utf-8");
    expect(content).toContain('data-testid="chat-s04-pipe-status"');
  });

  test("T37 -- has attached/detached states", async () => {
    const content = await readFile(PIPE_STATUS_FILE, "utf-8");
    expect(content).toContain("chat-s04-pipe-attached");
    expect(content).toContain("chat-s04-pipe-detached");
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: AgentChatPanel component (T38-T42)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: AgentChatPanel component", () => {
  test("T38 -- exports AgentChatPanel component", async () => {
    const content = await readFile(AGENT_CHAT_PANEL_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+AgentChatPanel/);
  });

  test("T39 -- renders data-testid chat-s04-panel", async () => {
    const content = await readFile(AGENT_CHAT_PANEL_FILE, "utf-8");
    expect(content).toContain('data-testid="chat-s04-panel"');
  });

  test("T40 -- contains messages area with data-testid chat-s04-messages", async () => {
    const content = await readFile(AGENT_CHAT_PANEL_FILE, "utf-8");
    expect(content).toContain('data-testid="chat-s04-messages"');
  });

  test("T41 -- contains input with data-testid chat-s04-input", async () => {
    const content = await readFile(AGENT_CHAT_PANEL_FILE, "utf-8");
    expect(content).toContain('data-testid="chat-s04-input"');
  });

  test("T42 -- contains send button with data-testid chat-s04-send-btn", async () => {
    const content = await readFile(AGENT_CHAT_PANEL_FILE, "utf-8");
    expect(content).toContain('data-testid="chat-s04-send-btn"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Chat page + Route + Sidebar (T43-T47)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Chat page + Route + Sidebar", () => {
  test("T43 -- Chat.tsx page exists and exports Chat component", async () => {
    const content = await readFile(CHAT_PAGE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+Chat/);
  });

  test("T44 -- renders data-testid chat-s04-page", async () => {
    const content = await readFile(CHAT_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="chat-s04-page"');
  });

  test("T45 -- route registered in App.tsx with /chat path", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/path=["']chat["']/);
    expect(content).toContain("<Chat");
  });

  test("T46 -- sidebar nav item with data-testid chat-s04-nav-chat", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toContain('data-testid="chat-s04-nav-chat"');
    expect(content).toContain('to="/chat"');
    expect(content).toContain('label="Chat"');
  });

  test("T47 -- RequirePermission wraps chat route with chat:agent", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    // Find the chat route line and check it has RequirePermission with chat:agent
    const chatRouteLines = content.split("\n").filter(
      (line) => line.includes("chat") && line.includes("RequirePermission"),
    );
    expect(chatRouteLines.length).toBeGreaterThanOrEqual(1);
    const chatRouteLine = chatRouteLines.find((l) => l.includes('path="chat"'));
    expect(chatRouteLine).toBeDefined();
    expect(chatRouteLine).toContain("chat:agent");
  });
});
