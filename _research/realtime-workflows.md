# Real-Time Workflow Updates — WebSocket, SSE, Streaming

**Date:** 2026-02-19  
**Auteur:** Atlas (Subagent Research)

## Résumé Exécutif

- **WebSocket** : Meilleur pour communication bidirectionnelle (agent interaction, chat), connexion persistante, overhead initial mais efficient pour flux continus
- **SSE (Server-Sent Events)** : Plus simple pour streaming unidirectionnel (logs, status updates), fonctionne avec HTTP standard, reconnexion automatique
- **Polling** : À éviter sauf cas très simples, latence élevée et gaspillage de ressources
- **Pattern recommandé pour MnM** : WebSocket pour l'orchestration (comme OpenClaw), SSE pour les logs en streaming

---

## 1. Comparaison des Techniques

| Technique | Direction | Connexion | Latence | Complexité | Use Case |
|-----------|-----------|-----------|---------|------------|----------|
| **WebSocket** | Bidirectionnelle | Persistante | ~ms | Moyenne | Chat, gaming, collaboration |
| **SSE** | Serveur → Client | Persistante (HTTP) | ~ms | Basse | Logs, notifications, feeds |
| **Long Polling** | Bidirectionnelle | Semi-persistante | ~100ms | Moyenne | Fallback pour WS |
| **Polling** | Bidirectionnelle | Courte | ~seconds | Basse | Status checks simples |

---

## 2. WebSocket

### Architecture

```
┌─────────────┐                    ┌─────────────┐
│   Browser   │◄──── WebSocket ────►│   Server    │
│   (Client)  │      Full-duplex   │  (Gateway)  │
└─────────────┘                    └─────────────┘
     │                                    │
     │ Event: agent.started              │
     │◄──────────────────────────────────│
     │                                    │
     │ Event: tool.executing              │
     │◄──────────────────────────────────│
     │                                    │
     │ Request: send_message              │
     │───────────────────────────────────►│
     │                                    │
     │ Event: agent.completed             │
     │◄──────────────────────────────────│
```

### Implémentation (TypeScript)

**Server (Node.js avec ws) :**

```typescript
import WebSocket, { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

// Connection state
const clients = new Map<string, WebSocket>();

wss.on('connection', (ws, req) => {
  const clientId = generateId();
  clients.set(clientId, ws);
  
  // Send initial state
  ws.send(JSON.stringify({
    type: 'hello',
    clientId,
    timestamp: Date.now()
  }));
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    handleMessage(clientId, msg);
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
  });
});

// Broadcast to all clients
function broadcast(event: object) {
  const data = JSON.stringify(event);
  for (const ws of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

// Broadcast agent updates
function emitAgentEvent(agentId: string, event: AgentEvent) {
  broadcast({
    type: 'agent',
    agentId,
    event,
    timestamp: Date.now()
  });
}
```

**Client (React) :**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: any) => void;
  reconnectInterval?: number;
}

function useWebSocket({ url, onMessage, reconnectInterval = 3000 }: UseWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const connect = useCallback(() => {
    ws.current = new WebSocket(url);
    
    ws.current.onopen = () => {
      setIsConnected(true);
      // Send auth/handshake
      ws.current?.send(JSON.stringify({ type: 'connect', token: getToken() }));
    };
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    
    ws.current.onclose = () => {
      setIsConnected(false);
      // Reconnect
      setTimeout(connect, reconnectInterval);
    };
    
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.current?.close();
    };
  }, [url, onMessage, reconnectInterval]);
  
  useEffect(() => {
    connect();
    return () => ws.current?.close();
  }, [connect]);
  
  const send = useCallback((data: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);
  
  return { isConnected, send };
}

// Usage
function AgentDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  
  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'agent':
        setAgents(prev => updateAgent(prev, data));
        break;
      case 'hello':
        console.log('Connected:', data.clientId);
        break;
    }
  }, []);
  
  const { isConnected, send } = useWebSocket({
    url: 'ws://localhost:8080',
    onMessage: handleMessage
  });
  
  return (
    <div>
      <ConnectionStatus connected={isConnected} />
      <AgentList agents={agents} />
    </div>
  );
}
```

### Avantages WebSocket

- Communication bidirectionnelle
- Latence très basse (~ms)
- Une seule connexion pour tout
- Support natif des messages binaires

### Inconvénients WebSocket

- Plus complexe à implémenter
- Besoin de gérer la reconnexion
- Load balancing plus complexe (sticky sessions)
- Firewall/proxy parfois bloquants

---

## 3. Server-Sent Events (SSE)

### Architecture

```
┌─────────────┐                    ┌─────────────┐
│   Browser   │◄──── SSE Stream ───│   Server    │
│   (Client)  │    (unidirectional)│             │
└─────────────┘                    └─────────────┘
     │                                    │
     │ data: {"event": "started"}        │
     │◄──────────────────────────────────│
     │                                    │
     │ data: {"event": "progress", ...}  │
     │◄──────────────────────────────────│
     │                                    │
     │ data: {"event": "completed"}      │
     │◄──────────────────────────────────│
```

### Implémentation (TypeScript)

**Server (Express) :**

```typescript
import express from 'express';

const app = express();

// SSE endpoint for workflow updates
app.get('/api/workflows/:id/stream', (req, res) => {
  const { id } = req.params;
  
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx
  
  // Send initial state
  res.write(`data: ${JSON.stringify({ event: 'connected', workflowId: id })}\n\n`);
  
  // Subscribe to workflow events
  const unsubscribe = workflowEvents.subscribe(id, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
  
  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);
  
  // Cleanup on close
  req.on('close', () => {
    unsubscribe();
    clearInterval(heartbeat);
  });
});

// Helper for structured events
function sendSSE(res: Response, event: string, data: object) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
```

**Client (React) :**

```typescript
import { useEffect, useState, useCallback } from 'react';

interface UseSSEOptions {
  url: string;
  onMessage: (event: MessageEvent) => void;
}

function useSSE({ url, onMessage }: UseSSEOptions) {
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    const eventSource = new EventSource(url);
    
    eventSource.onopen = () => setIsConnected(true);
    eventSource.onmessage = onMessage;
    eventSource.onerror = () => setIsConnected(false);
    
    // Auto-reconnect is built into EventSource
    
    return () => eventSource.close();
  }, [url, onMessage]);
  
  return { isConnected };
}

// Usage for agent logs
function AgentLogs({ agentId }: { agentId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const handleMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    setLogs(prev => [...prev, data]);
  }, []);
  
  const { isConnected } = useSSE({
    url: `/api/agents/${agentId}/logs`,
    onMessage: handleMessage
  });
  
  return (
    <div className="logs">
      {logs.map((log, i) => (
        <LogLine key={i} log={log} />
      ))}
    </div>
  );
}
```

### Format SSE

```
: This is a comment (ignored)
event: agent-update
data: {"nodeId": "abc", "status": "running"}

event: node-completed
data: {"nodeId": "abc", "result": "success", "duration": 1234}

event: workflow-complete
data: {"status": "success", "totalDuration": 5678}
```

### Avantages SSE

- Simple à implémenter
- Fonctionne avec HTTP standard
- Reconnexion automatique native
- Pas de problème de firewall/proxy

### Inconvénients SSE

- Unidirectionnel seulement
- Limité à ~6 connexions par domaine (HTTP/1.1)
- Pas de messages binaires

---

## 4. Patterns de Streaming pour Agents

### Pattern 1: Log Streaming

```typescript
// Server: Stream agent logs as they happen
async function* streamAgentLogs(agentId: string): AsyncGenerator<LogEvent> {
  const startTime = Date.now();
  
  while (true) {
    const logs = await getNewLogs(agentId, startTime);
    for (const log of logs) {
      yield log;
    }
    
    if (isAgentDone(agentId)) break;
    
    await sleep(100); // Poll interval
  }
}

// API endpoint
app.get('/api/agents/:id/logs', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  
  for await (const log of streamAgentLogs(req.params.id)) {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  }
  
  res.write(`event: done\ndata: {}\n\n`);
  res.end();
});
```

### Pattern 2: Workflow Status Updates

```typescript
interface WorkflowUpdate {
  type: 'node-started' | 'node-completed' | 'node-failed' | 'workflow-done';
  nodeId?: string;
  status?: string;
  result?: any;
  error?: string;
  timestamp: number;
}

// Event bus for workflow updates
class WorkflowEventBus {
  private subscribers = new Map<string, Set<(event: WorkflowUpdate) => void>>();
  
  subscribe(workflowId: string, callback: (event: WorkflowUpdate) => void) {
    if (!this.subscribers.has(workflowId)) {
      this.subscribers.set(workflowId, new Set());
    }
    this.subscribers.get(workflowId)!.add(callback);
    
    return () => this.subscribers.get(workflowId)?.delete(callback);
  }
  
  emit(workflowId: string, event: WorkflowUpdate) {
    const subs = this.subscribers.get(workflowId);
    if (subs) {
      for (const callback of subs) {
        callback(event);
      }
    }
  }
}
```

### Pattern 3: Token Streaming (LLM)

```typescript
// Stream LLM tokens to frontend
async function streamLLMResponse(prompt: string, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    stream: true
  });
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
    }
  }
  
  res.write(`event: done\ndata: {}\n\n`);
  res.end();
}
```

---

## 5. Real-Time avec OpenClaw

OpenClaw utilise **WebSocket** pour tout :

```typescript
// Se connecter à OpenClaw Gateway
const ws = new WebSocket('ws://localhost:18789');

// Handshake
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'req',
    id: uuid(),
    method: 'connect',
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      role: 'operator',
      auth: { token: 'your-token' }
    }
  }));
};

// Handle events
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  switch (msg.type) {
    case 'res':
      if (msg.payload?.type === 'hello-ok') {
        console.log('Connected to OpenClaw');
      }
      break;
    
    case 'event':
      switch (msg.event) {
        case 'agent':
          handleAgentEvent(msg.payload);
          break;
        case 'presence':
          handlePresenceUpdate(msg.payload);
          break;
        case 'health':
          handleHealthUpdate(msg.payload);
          break;
      }
      break;
  }
};

function handleAgentEvent(payload: AgentEventPayload) {
  const { runId, stream, content, phase } = payload;
  
  switch (stream) {
    case 'assistant':
      // Token streaming
      appendToChat(runId, content);
      break;
    case 'tool':
      // Tool execution update
      updateToolStatus(runId, payload);
      break;
    case 'lifecycle':
      // start/end/error
      updateAgentStatus(runId, phase);
      break;
  }
}
```

---

## 6. Gestion de la Déconnexion

### Reconnexion Automatique

```typescript
class ReconnectingWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  
  constructor(
    private url: string,
    private onMessage: (data: any) => void,
    private onStatusChange: (connected: boolean) => void
  ) {
    this.connect();
  }
  
  private connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onStatusChange(true);
    };
    
    this.ws.onmessage = (event) => {
      this.onMessage(JSON.parse(event.data));
    };
    
    this.ws.onclose = () => {
      this.onStatusChange(false);
      this.scheduleReconnect();
    };
    
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }
  
  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
        30000 // Max 30 seconds
      );
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    }
  }
  
  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  
  close() {
    this.maxReconnectAttempts = 0; // Prevent reconnect
    this.ws?.close();
  }
}
```

### State Recovery

```typescript
// Après reconnexion, récupérer l'état manqué
async function recoverState(lastSeq: number) {
  // 1. Fetch missed events
  const missedEvents = await api.get('/events', {
    params: { afterSeq: lastSeq }
  });
  
  // 2. Apply them to local state
  for (const event of missedEvents) {
    applyEvent(event);
  }
  
  // 3. Optionally fetch full state refresh
  const fullState = await api.get('/state');
  mergeState(fullState);
}
```

---

## 7. Recommandations pour MnM

### Architecture Recommandée

```
┌─────────────────────────────────────────────────────┐
│                    MnM Frontend                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  WebSocket   │  │     SSE      │  │   REST    │ │
│  │  (Control)   │  │   (Logs)     │  │  (CRUD)   │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────┘
          │                 │                │
          │ Commands        │ Stream         │ Queries
          │ + Events        │ (read-only)    │
          ▼                 ▼                ▼
┌─────────────────────────────────────────────────────┐
│                    MnM Backend                       │
│  ┌──────────────────────────────────────────────┐  │
│  │              Event Bus                        │  │
│  │   (Redis Pub/Sub or In-Memory)               │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
          │
          │ Proxy to
          ▼
┌─────────────────────────────────────────────────────┐
│              OpenClaw Gateway                        │
│        (Actual Agent Execution)                      │
└─────────────────────────────────────────────────────┘
```

### Choix Technique

| Besoin | Solution | Pourquoi |
|--------|----------|----------|
| Agent control (start/stop/interact) | WebSocket | Bidirectionnel, faible latence |
| Agent status updates | WebSocket | Inclus dans la connexion |
| Log streaming | SSE | Simple, efficace, auto-reconnect |
| Tool outputs | WebSocket | Part of agent stream |
| Workflow state | WebSocket + REST fallback | Temps réel + récupération |

### Code d'intégration suggéré

```typescript
// hooks/useAgentConnection.ts
export function useAgentConnection(agentId: string) {
  const [status, setStatus] = useState<AgentStatus>('disconnected');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // WebSocket for control
  const { send, isConnected } = useWebSocket({
    url: `ws://localhost:8080/agents/${agentId}`,
    onMessage: (data) => {
      if (data.type === 'status') {
        setStatus(data.status);
      }
    }
  });
  
  // SSE for logs
  useSSE({
    url: `/api/agents/${agentId}/logs`,
    onMessage: (event) => {
      setLogs(prev => [...prev.slice(-1000), JSON.parse(event.data)]);
    }
  });
  
  const startAgent = () => send({ action: 'start' });
  const stopAgent = () => send({ action: 'stop' });
  
  return { status, logs, isConnected, startAgent, stopAgent };
}
```

---

## Sources

- https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- https://community.temporal.io/t/its-good-practice-implement-temporal-workflows-to-push-events-to-websockets/15276
- https://www.codingwithmuhib.com/blogs/real-time-ui-updates-with-sse-simpler-than-websockets
- OpenClaw Gateway Protocol documentation
