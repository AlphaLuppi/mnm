# OpenClaw Authentication & Web UI Architecture

## Technical Deep Dive
*Research Document for MnM Implementation*
*Last Updated: 2026-02-21*

---

## 1. Auth Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         OPENCLAW AUTHENTICATION FLOW                            │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   User/Client    │     │    Gateway       │     │  Model Provider  │
│   (CLI/Web UI)   │     │   (WebSocket)    │     │  (Anthropic...)  │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │ 1. connect request     │                        │
         │  (role, auth, device)  │                        │
         │───────────────────────►│                        │
         │                        │                        │
         │ 2. connect.challenge   │                        │
         │    (nonce, ts)         │                        │
         │◄───────────────────────│                        │
         │                        │                        │
         │ 3. signed connect      │                        │
         │    (device identity)   │                        │
         │───────────────────────►│                        │
         │                        │                        │
         │ 4. hello-ok response   │                        │
         │  + device token        │                        │
         │◄───────────────────────│                        │
         │                        │                        │
         │ 5. chat.send           │                        │
         │    (message)           │                        │
         │───────────────────────►│ 6. API call with       │
         │                        │    resolved token      │
         │                        │───────────────────────►│
         │                        │                        │
         │                        │ 7. Model response      │
         │                        │◄───────────────────────│
         │ 8. chat event          │                        │
         │    (streaming)         │                        │
         │◄───────────────────────│                        │
         │                        │                        │


┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ANTHROPIC SETUP-TOKEN FLOW                             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Claude Code    │     │   OpenClaw CLI   │     │    Gateway       │
│      CLI         │     │                  │     │                  │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │ claude setup-token     │                        │
         │  (interactive TTY)     │                        │
         │────────────┐           │                        │
         │            │ OAuth     │                        │
         │◄───────────┘ browser   │                        │
         │                        │                        │
         │ Token generated        │                        │
         │ (sk-ant-oat01-...)     │                        │
         │                        │                        │
         │────────────────────────►                        │
         │  User pastes token     │                        │
         │                        │ openclaw models auth   │
         │                        │   setup-token          │
         │                        │───────────────────────►│
         │                        │                        │
         │                        │ Writes to              │
         │                        │ auth-profiles.json     │
         │                        │───────────────────────►│
         │                        │                        │
```

---

## 2. Setup Token / OAuth Mechanism

### 2.1 Authentication Modes

OpenClaw supports **three credential types** per provider:

| Type | Description | Refresh | Use Case |
|------|-------------|---------|----------|
| `api_key` | Direct API key | Never | Standard API access |
| `token` | Static bearer token (setup-token) | Never* | Subscription auth (Claude Max/Pro) |
| `oauth` | OAuth2 with refresh | Automatic | ChatGPT OAuth (Codex) |

*\* Setup-tokens can expire but OpenClaw doesn't auto-refresh them — user must re-run `claude setup-token`*

### 2.2 Anthropic Setup-Token

The setup-token flow is the **recommended path for Claude subscription users**:

```bash
# Step 1: Generate token on ANY machine (requires Claude CLI)
claude setup-token

# Step 2: Paste into OpenClaw (on gateway host)
openclaw models auth setup-token --provider anthropic

# OR if generated elsewhere:
openclaw models auth paste-token --provider anthropic
```

**How it works internally:**
1. `claude setup-token` opens a browser for Anthropic OAuth
2. User authenticates with Claude subscription credentials
3. A long-lived access token is generated (format: `sk-ant-oat01-...`)
4. This token is NOT a traditional OAuth token — it's a static bearer token
5. OpenClaw stores it as `type: "token"` in `auth-profiles.json`

### 2.3 OAuth Flow (OpenAI Codex)

For providers that support full OAuth (like OpenAI Codex):

```
Flow shape (PKCE):
1. Generate PKCE verifier/challenge + random state
2. Open https://auth.openai.com/oauth/authorize?...
3. Capture callback on http://127.0.0.1:1455/auth/callback
4. Exchange at https://auth.openai.com/oauth/token
5. Store { access, refresh, expires, accountId }
```

### 2.4 Provider Plugin Auth

Some providers implement custom auth flows via plugins:

```bash
# Run provider-specific login
openclaw models auth login --provider <id>
```

Supported auth kinds in plugins:
- `oauth` — Full OAuth2 flow
- `api_key` — Simple API key input
- `token` — Paste bearer token
- `device_code` — Device code flow (GitHub style)
- `custom` — Provider-specific implementation

---

## 3. Token Storage & Refresh

### 3.1 Storage Locations

```
~/.openclaw/
├── agents/
│   └── <agentId>/
│       └── agent/
│           ├── auth-profiles.json    # ← PRIMARY TOKEN STORE
│           └── auth.json             # ← Runtime cache (auto-managed)
├── credentials/
│   └── oauth.json                    # ← Legacy import-only (migrated)
└── openclaw.json                     # ← Config (may contain API keys in env)
```

### 3.2 auth-profiles.json Structure

```typescript
type AuthProfileStore = {
  version: number;                           // Schema version (currently 1)
  profiles: Record<string, AuthProfileCredential>;
  order?: Record<string, string[]>;          // Per-provider priority
  lastGood?: Record<string, string>;         // Last working profile per provider
  usageStats?: Record<string, ProfileUsageStats>; // Round-robin tracking
};

// Example:
{
  "version": 1,
  "profiles": {
    "anthropic:default": {
      "type": "token",
      "provider": "anthropic",
      "token": "sk-ant-oat01-...",
      "email": "user@example.com"     // Optional
    },
    "anthropic:work": {
      "type": "api_key",
      "provider": "anthropic",
      "key": "sk-ant-api03-...",
    },
    "openai:default": {
      "type": "oauth",
      "provider": "openai",
      "access": "eyJ...",
      "refresh": "def...",
      "expires": 1735689600000,       // ms since epoch
      "clientId": "openai-cli"
    }
  },
  "lastGood": {
    "anthropic": "anthropic:default"
  },
  "usageStats": {
    "anthropic:default": {
      "lastUsed": 1735600000000,
      "errorCount": 0
    }
  }
}
```

### 3.3 Credential Types (TypeScript)

```typescript
type ApiKeyCredential = {
  type: "api_key";
  provider: string;
  key?: string;
  email?: string;
  metadata?: Record<string, string>;
};

type TokenCredential = {
  type: "token";
  provider: string;
  token: string;
  expires?: number;  // Optional expiry (ms since epoch)
  email?: string;
};

type OAuthCredential = {
  type: "oauth";
  provider: string;
  access: string;
  refresh: string;
  expires: number;
  clientId?: string;
  email?: string;
};

type AuthProfileCredential = ApiKeyCredential | TokenCredential | OAuthCredential;
```

### 3.4 Token Refresh Logic

```typescript
// Pseudocode from OpenClaw runtime
async function resolveApiKeyForProfile(params) {
  const profile = store.profiles[profileId];
  
  if (profile.type === "api_key") {
    return { apiKey: profile.key, provider: profile.provider };
  }
  
  if (profile.type === "token") {
    return { apiKey: profile.token, provider: profile.provider };
  }
  
  if (profile.type === "oauth") {
    const now = Date.now();
    if (profile.expires > now) {
      return { apiKey: profile.access, provider: profile.provider };
    }
    // Refresh needed — acquire file lock, refresh, update store
    const newTokens = await refreshOAuthToken(profile);
    await writeAuthProfiles(store);  // With file lock
    return { apiKey: newTokens.access, provider: profile.provider };
  }
}
```

### 3.5 Profile Rotation & Cooldown

OpenClaw supports multiple profiles per provider with automatic rotation:

```typescript
type ProfileUsageStats = {
  lastUsed?: number;
  cooldownUntil?: number;      // Temporary cooldown (rate limit)
  disabledUntil?: number;      // Longer disable (auth failure)
  disabledReason?: "auth" | "format" | "rate_limit" | "billing" | "timeout" | "unknown";
  errorCount?: number;
  failureCounts?: Record<string, number>;
  lastFailureAt?: number;
};
```

**Selection priority:**
1. `OPENCLAW_LIVE_<PROVIDER>_KEY` (single override)
2. Profile order from config (`auth.order`)
3. `<PROVIDER>_API_KEYS` (comma-separated rotation)
4. `<PROVIDER>_API_KEY`
5. `<PROVIDER>_API_KEY_*` (numbered fallbacks)

---

## 4. Web UI Architecture

### 4.1 Control UI Overview

The Control UI is a **Vite + Lit** single-page application served by the Gateway:

| Component | Technology |
|-----------|------------|
| Build tool | Vite |
| Framework | Lit (Web Components) |
| Transport | WebSocket (same port as Gateway) |
| Static hosting | Gateway HTTP server |

**Default URL:** `http://127.0.0.1:18789/`
**Assets location:** `dist/control-ui/`

### 4.2 Control UI Capabilities

```
┌─────────────────────────────────────────────────────────────────┐
│                      CONTROL UI FEATURES                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📝 Chat                                                        │
│  ├── chat.history — Fetch conversation                         │
│  ├── chat.send — Send message (non-blocking, streams events)   │
│  ├── chat.abort — Stop generation                              │
│  └── chat.inject — Append assistant note (no agent run)        │
│                                                                 │
│  📺 Channels                                                    │
│  ├── channels.status — WhatsApp/Telegram/Discord status        │
│  ├── web.login.* — QR login flows                              │
│  └── config.patch — Per-channel config                         │
│                                                                 │
│  👥 Sessions                                                    │
│  ├── sessions.list — All active sessions                       │
│  └── sessions.patch — Toggle thinking/verbose per session      │
│                                                                 │
│  🤖 Agents                                                      │
│  ├── agents.list — List agents                                 │
│  ├── agents.create — Create new agent                          │
│  └── agents.update — Update agent config                       │
│                                                                 │
│  📡 Nodes                                                       │
│  ├── node.list — List paired nodes                             │
│  └── node.invoke — Run commands on nodes                       │
│                                                                 │
│  ⚙️ Config                                                      │
│  ├── config.get — Read config                                  │
│  ├── config.set — Update config                                │
│  ├── config.apply — Apply + restart                            │
│  └── config.schema — Get form schema                           │
│                                                                 │
│  🔧 Debug                                                       │
│  ├── status — Gateway status                                   │
│  ├── health — Health snapshot                                  │
│  ├── logs.tail — Live log streaming                            │
│  └── update.run — Update + restart                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Session Creation via UI

When the Control UI connects:

1. **WebSocket handshake** with device identity
2. Gateway issues **device token** for future connects
3. UI can **spawn agent runs** via `chat.send` or `agent` methods
4. Each message creates/reuses a **session** based on `session.mainKey`

```json
// chat.send request
{
  "type": "req",
  "id": "unique-id",
  "method": "chat.send",
  "params": {
    "message": "Hello!",
    "idempotencyKey": "uuid-v4",
    "sessionKey": "agent:main:main"
  }
}

// Response (immediate ack)
{
  "type": "res",
  "id": "unique-id",
  "ok": true,
  "payload": {
    "runId": "run-uuid",
    "status": "started"
  }
}

// Streaming events follow
{
  "type": "event",
  "event": "chat",
  "payload": { "text": "Hello!", "delta": "Hello", ... }
}
```

### 4.4 Device Pairing (Web UI)

New browsers/devices require **one-time pairing approval**:

```bash
# List pending requests
openclaw devices list

# Approve device
openclaw devices approve <requestId>
```

**Note:** Local connections (`127.0.0.1`) are auto-approved. Remote requires explicit approval.

---

## 5. Gateway Protocol Summary

### 5.1 Transport

- **Protocol:** WebSocket with JSON text frames
- **Port:** Default `18789`
- **First frame:** Must be `connect` request

### 5.2 Frame Types

```typescript
// Request
type RequestFrame = {
  type: "req";
  id: string;           // Unique request ID
  method: string;       // API method name
  params?: unknown;     // Method parameters
};

// Response
type ResponseFrame = {
  type: "res";
  id: string;           // Matches request ID
  ok: boolean;
  payload?: unknown;
  error?: ErrorShape;
};

// Event (server-push)
type EventFrame = {
  type: "event";
  event: string;        // Event name
  payload?: unknown;
  seq?: number;         // Sequence number for gap detection
  stateVersion?: {
    presence: number;
    health: number;
  };
};
```

### 5.3 Handshake Flow

```json
// 1. Gateway sends challenge
{
  "type": "event",
  "event": "connect.challenge",
  "payload": { "nonce": "abc123", "ts": 1735689600000 }
}

// 2. Client sends connect
{
  "type": "req",
  "id": "conn-1",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "openclaw-control-ui",
      "version": "1.2.3",
      "platform": "web",
      "mode": "ui"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "auth": { "token": "gateway-token" },
    "device": {
      "id": "device-fingerprint",
      "publicKey": "...",
      "signature": "...",
      "signedAt": 1735689600000,
      "nonce": "abc123"
    }
  }
}

// 3. Gateway responds
{
  "type": "res",
  "id": "conn-1",
  "ok": true,
  "payload": {
    "type": "hello-ok",
    "protocol": 3,
    "policy": { "tickIntervalMs": 15000 },
    "auth": {
      "deviceToken": "issued-device-token",
      "role": "operator",
      "scopes": ["operator.read", "operator.write"]
    }
  }
}
```

### 5.4 Roles & Scopes

**Roles:**
- `operator` — Control plane client (CLI/UI/automation)
- `node` — Capability host (camera/screen/canvas/system.run)

**Operator Scopes:**
- `operator.read` — Read status, sessions, config
- `operator.write` — Modify sessions, send messages
- `operator.admin` — Administrative actions
- `operator.approvals` — Exec approval handling
- `operator.pairing` — Device pairing management

### 5.5 Key Methods

| Method | Description | Idempotent |
|--------|-------------|------------|
| `connect` | Handshake | - |
| `status` | Gateway status | Yes |
| `health` | Health snapshot | Yes |
| `system-presence` | Connected clients | Yes |
| `chat.send` | Send chat message | **Requires key** |
| `chat.history` | Get conversation | Yes |
| `chat.abort` | Stop generation | No |
| `agent` | Run agent | **Requires key** |
| `sessions.list` | List sessions | Yes |
| `sessions.patch` | Update session settings | No |
| `config.get` | Read config | Yes |
| `config.set` | Update config | No |
| `config.apply` | Apply + restart | No |

### 5.6 Events

| Event | Description |
|-------|-------------|
| `connect.challenge` | Server nonce for device auth |
| `agent` | Agent run progress (streaming) |
| `chat` | Chat message streaming |
| `presence` | Client connect/disconnect |
| `tick` | Keepalive (configurable interval) |
| `health` | Health state change |
| `heartbeat` | Scheduled heartbeat events |
| `shutdown` | Gateway shutting down |
| `exec.approval.requested` | Exec needs approval |

---

## 6. Code References

### 6.1 Key Files

| File | Purpose |
|------|---------|
| `/opt/homebrew/lib/node_modules/openclaw/dist/plugin-sdk/agents/auth-profiles/types.d.ts` | Auth profile TypeScript types |
| `/opt/homebrew/lib/node_modules/openclaw/dist/plugin-sdk/agents/auth-profiles/oauth.d.ts` | OAuth token resolution |
| `/opt/homebrew/lib/node_modules/openclaw/dist/plugin-sdk/gateway/protocol/index.d.ts` | Protocol schema definitions |
| `/opt/homebrew/lib/node_modules/openclaw/dist/plugin-sdk/gateway/client.d.ts` | Gateway client implementation |
| `/opt/homebrew/lib/node_modules/openclaw/dist/plugin-sdk/gateway/auth.d.ts` | Gateway auth logic |
| `/opt/homebrew/lib/node_modules/openclaw/dist/plugin-sdk/config/types.auth.d.ts` | Auth config types |
| `/opt/homebrew/lib/node_modules/openclaw/dist/control-ui/` | Built Control UI assets |

### 6.2 Documentation

| Doc | Path |
|-----|------|
| Auth | `/opt/homebrew/lib/node_modules/openclaw/docs/gateway/authentication.md` |
| Protocol | `/opt/homebrew/lib/node_modules/openclaw/docs/gateway/protocol.md` |
| Control UI | `/opt/homebrew/lib/node_modules/openclaw/docs/web/control-ui.md` |
| OAuth concept | `/opt/homebrew/lib/node_modules/openclaw/docs/concepts/oauth.md` |
| Architecture | `/opt/homebrew/lib/node_modules/openclaw/docs/concepts/architecture.md` |
| Sessions | `/opt/homebrew/lib/node_modules/openclaw/docs/concepts/session.md` |
| Configuration | `/opt/homebrew/lib/node_modules/openclaw/docs/gateway/configuration.md` |

### 6.3 CLI Commands

```bash
# Auth management
openclaw models status                  # Check auth status
openclaw models auth setup-token --provider anthropic  # Setup token
openclaw models auth paste-token --provider <id>       # Paste token
openclaw models auth login --provider <id>             # OAuth flow
openclaw models auth order get --provider <id>         # Get profile order
openclaw models auth order set --provider <id> <profiles...>

# Gateway
openclaw gateway                        # Start gateway
openclaw gateway status                 # Check status
openclaw gateway status --deep          # Deep status
openclaw dashboard                      # Open Control UI

# Sessions
openclaw sessions --json                # List sessions
openclaw sessions --active 60           # Active in last 60 min

# Devices
openclaw devices list                   # List paired devices
openclaw devices approve <id>           # Approve pairing
openclaw devices revoke --device <id>   # Revoke device
```

---

## 7. Implementation Guide for MnM

### 7.1 Minimal Web UI Requirements

To build a Web UI like OpenClaw's Control UI:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MnM WEB UI ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │    │   Gateway    │    │    LLM       │      │
│  │  (React/Lit) │◄──►│  (WebSocket) │◄──►│   Provider   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│        │                    │                                   │
│        │                    │                                   │
│        ▼                    ▼                                   │
│  ┌──────────────┐    ┌──────────────┐                          │
│  │  Device Auth │    │ Auth Profiles │                         │
│  │  (WebCrypto) │    │   (JSON)      │                         │
│  └──────────────┘    └──────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Key Components to Implement

#### A. Gateway Server
- WebSocket server on configurable port
- JSON frame parsing (req/res/event)
- Protocol version negotiation
- Device identity verification
- Token/password authentication

```typescript
// Minimal Gateway interface
interface GatewayServer {
  // Lifecycle
  start(port: number): Promise<void>;
  stop(): Promise<void>;
  
  // Auth
  resolveAuth(params: ConnectParams): Promise<AuthResult>;
  
  // Methods
  handleRequest(frame: RequestFrame): Promise<ResponseFrame>;
  
  // Events
  broadcast(event: EventFrame): void;
  emitToSession(sessionId: string, event: EventFrame): void;
}
```

#### B. Auth Profile Store
- JSON file storage
- Multiple profiles per provider
- Token/OAuth/API key types
- Usage stats tracking
- File locking for concurrent access

```typescript
// Minimal auth store interface
interface AuthStore {
  getProfile(profileId: string): AuthProfileCredential | null;
  setProfile(profileId: string, cred: AuthProfileCredential): Promise<void>;
  resolveForProvider(provider: string): Promise<{ apiKey: string } | null>;
  recordUsage(profileId: string, success: boolean): void;
}
```

#### C. Session Manager
- Session creation/retrieval
- JSONL transcript storage
- Session key routing
- Expiry/reset logic

```typescript
// Minimal session interface
interface SessionManager {
  getOrCreate(sessionKey: string): Session;
  appendToTranscript(sessionId: string, entry: TranscriptEntry): void;
  listSessions(): SessionInfo[];
  deleteSession(sessionId: string): void;
}
```

#### D. Web UI Client
- WebSocket connection with reconnect
- Device identity generation (WebCrypto)
- Token storage (localStorage)
- Frame serialization

```typescript
// Minimal client interface
class GatewayClient {
  constructor(url: string, options: ClientOptions);
  
  connect(): Promise<HelloOk>;
  request<T>(method: string, params?: unknown): Promise<T>;
  onEvent(callback: (event: EventFrame) => void): void;
  disconnect(): void;
}
```

### 7.3 OAuth Implementation (Without API Keys)

To support OAuth-style auth without direct API keys:

1. **Setup Token Flow (Anthropic-style)**
   ```typescript
   // User generates token externally, pastes into MnM
   async function handleSetupToken(token: string, provider: string) {
     const profile: TokenCredential = {
       type: "token",
       provider,
       token,
       // No expiry for setup tokens
     };
     await authStore.setProfile(`${provider}:default`, profile);
   }
   ```

2. **Full OAuth Flow (OpenAI-style)**
   ```typescript
   async function handleOAuthLogin(provider: string) {
     const { verifier, challenge } = generatePKCE();
     const state = randomHex(32);
     
     // Open browser to provider auth URL
     const authUrl = buildAuthUrl(provider, { challenge, state });
     await openBrowser(authUrl);
     
     // Start local callback server
     const code = await waitForCallback(1455);
     
     // Exchange code for tokens
     const tokens = await exchangeCode(provider, code, verifier);
     
     const profile: OAuthCredential = {
       type: "oauth",
       provider,
       access: tokens.access_token,
       refresh: tokens.refresh_token,
       expires: Date.now() + tokens.expires_in * 1000,
     };
     await authStore.setProfile(`${provider}:default`, profile);
   }
   ```

### 7.4 Device Pairing Flow

```typescript
// Gateway side
async function handleConnect(params: ConnectParams, req: IncomingMessage) {
  const deviceId = params.device?.id;
  
  // Check if device is known
  const knownDevice = await deviceStore.get(deviceId);
  if (!knownDevice) {
    // Require pairing approval
    const requestId = await createPairingRequest(deviceId, req);
    throw new PairingRequiredError(requestId);
  }
  
  // Verify signature
  if (!verifyDeviceSignature(params.device, knownDevice.publicKey)) {
    throw new AuthError("Invalid device signature");
  }
  
  // Issue/refresh device token
  const deviceToken = await issueDeviceToken(deviceId, params.role, params.scopes);
  
  return {
    type: "hello-ok",
    protocol: PROTOCOL_VERSION,
    auth: { deviceToken, role: params.role, scopes: params.scopes },
  };
}

// Client side
async function generateDeviceIdentity() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  
  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const id = sha256(publicKeyRaw).slice(0, 16);
  
  return {
    id,
    publicKey: base64encode(publicKeyRaw),
    privateKey: keyPair.privateKey,  // Keep in memory
  };
}

async function signConnect(identity: DeviceIdentity, nonce: string) {
  const message = `${nonce}:${Date.now()}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    identity.privateKey,
    new TextEncoder().encode(message)
  );
  
  return {
    id: identity.id,
    publicKey: identity.publicKey,
    signature: base64encode(signature),
    signedAt: Date.now(),
    nonce,
  };
}
```

### 7.5 Chat Implementation

```typescript
// Gateway method: chat.send
async function handleChatSend(params: ChatSendParams, session: Session) {
  const runId = uuidv4();
  
  // Immediate ack
  yield { status: "started", runId };
  
  // Resolve auth for model provider
  const auth = await authStore.resolveForProvider(session.model.provider);
  if (!auth) throw new Error("No auth available");
  
  // Stream to model
  const stream = await callModelProvider(session.model, {
    apiKey: auth.apiKey,
    messages: session.history,
    newMessage: params.message,
  });
  
  // Emit streaming events
  for await (const chunk of stream) {
    emit("chat", { delta: chunk.text, runId });
    session.appendPartial(chunk);
  }
  
  // Final response
  yield { status: "ok", runId, summary: session.lastMessage };
}

// Client usage
async function sendMessage(message: string) {
  const { runId } = await client.request("chat.send", {
    message,
    idempotencyKey: uuidv4(),
    sessionKey: currentSessionKey,
  });
  
  // Listen for streaming events
  client.onEvent((event) => {
    if (event.event === "chat" && event.payload.runId === runId) {
      appendToUI(event.payload.delta);
    }
  });
}
```

---

## 8. Security Considerations

### 8.1 Gateway Auth

```json5
// Recommended config
{
  "gateway": {
    "bind": "loopback",  // Only localhost by default
    "auth": {
      "mode": "token",
      "token": "strong-random-token"  // Or OPENCLAW_GATEWAY_TOKEN
    }
  }
}
```

### 8.2 Credential Storage Security

- `auth-profiles.json` should be `600` permissions (owner-only read/write)
- Never log token values
- Use file locking for concurrent access
- Consider encryption at rest for sensitive deployments

### 8.3 Device Auth

- Device identities use ECDSA P-256
- Challenge-response prevents replay attacks
- Device tokens are scoped and revocable
- Pairing approval required for new devices

---

## 9. Summary

OpenClaw's architecture provides a solid reference for building a Web UI that manages AI agents without direct API key exposure:

1. **Gateway as Hub** — Single WebSocket server handles all client types
2. **Multi-Provider Auth** — Flexible auth profiles with rotation and fallback
3. **Device Pairing** — Cryptographic device identity with approval flow
4. **Session Management** — Isolated conversations with configurable reset
5. **Streaming Protocol** — Efficient real-time chat with JSON frames

For MnM, the key innovations to adopt:
- **Setup token pattern** for Anthropic — Users generate tokens externally
- **Device pairing** for security without per-request API keys
- **Session-based routing** for multi-user/multi-agent scenarios
- **WebSocket control plane** for unified client access

