# CHAT-S04 — AgentChatPanel UI

> **Epic** : CHAT — Chat Temps Reel
> **Sprint** : 10 (Batch 10 — Container avance + Chat)
> **Assignation** : Cofondateur (frontend)
> **Effort** : M (3 SP, 2-3j)
> **Bloque par** : CHAT-S01 (WebSocket bidirectionnel — DONE), CHAT-S02 (Tables chat — DONE), CHAT-S03 (ChatService pipe stdin — DONE)
> **Debloque** : —
> **Statut** : IN_PROGRESS

---

## 1. Contexte

L'infrastructure chat est complete cote backend :
- **CHAT-S01** : WebSocket bidirectionnel avec protocole type (`ChatClientPayload`, `ChatServerPayload`), auth, rate limiting, buffer 30s
- **CHAT-S02** : Tables enrichies `chat_channels` + `chat_messages` avec messageType, replyToId, editedAt, deletedAt, lastMessageAt
- **CHAT-S03** : ContainerPipeService pour pipe stdin/stdout entre chat et container Docker, avec attach/detach/status REST routes

Il manque la couche UI React : le composant **AgentChatPanel** qui permet a un utilisateur de communiquer en temps reel avec un agent AI dans un container, via le WebSocket et le pipe container.

C'est le "moment emotionnel de la demo CBA" : un utilisateur tape dans le chat, voit l'agent repondre en temps reel.

## 2. Objectif

Creer :
1. **API client chat** (`ui/src/api/chat.ts`) — fonctions REST pour channels et messages
2. **Hook useAgentChat** (`ui/src/hooks/useAgentChat.ts`) — WebSocket bidirectionnel + state management
3. **AgentChatPanel** (`ui/src/components/AgentChatPanel.tsx`) — composant panel de chat
4. **MessageBubble** (`ui/src/components/chat/MessageBubble.tsx`) — bulle de message user vs agent
5. **TypingIndicator** (`ui/src/components/chat/TypingIndicator.tsx`) — indicateur de saisie
6. **ConnectionStatus** (`ui/src/components/chat/ConnectionStatus.tsx`) — indicateur connexion WebSocket
7. **PipeStatusIndicator** (`ui/src/components/chat/PipeStatusIndicator.tsx`) — statut pipe container
8. **Chat page** (`ui/src/pages/Chat.tsx`) — page pour lister/ouvrir les channels
9. **Route + Sidebar** — integration dans App.tsx + Sidebar.tsx
10. **Query keys** — `queryKeys.chat` dans `ui/src/lib/queryKeys.ts`

## 3. Acceptance Criteria (Given/When/Then)

### AC-01: Page Chat accessible
- **Given** un utilisateur avec permission `chat:agent`
- **When** il navigue vers `/chat`
- **Then** la page Chat s'affiche avec la liste des channels

### AC-02: Liste des channels
- **Given** la page Chat chargee
- **When** des channels existent
- **Then** la liste affiche : nom du channel, agent associe, statut (open/closed), dernier message, date

### AC-03: Ouvrir un channel
- **Given** la liste des channels
- **When** l'utilisateur clique sur un channel
- **Then** l'AgentChatPanel s'ouvre a droite avec l'historique des messages

### AC-04: Affichage des messages
- **Given** l'AgentChatPanel ouvert sur un channel
- **When** des messages existent
- **Then** les messages s'affichent avec : contenu, sender (user vs agent avec styles distincts), timestamp
- **Then** les messages user sont alignes a droite (bleu)
- **Then** les messages agent sont alignes a gauche (gris)

### AC-05: Envoyer un message
- **Given** l'AgentChatPanel ouvert sur un channel ouvert
- **When** l'utilisateur tape un message et appuie Entree (ou clique Envoyer)
- **Then** le message apparait immediatement (optimistic)
- **Then** le message est envoye via WebSocket

### AC-06: Recevoir un message agent en temps reel
- **Given** l'AgentChatPanel ouvert
- **When** l'agent envoie un message (via pipe stdout)
- **Then** le message apparait dans le panel en temps reel

### AC-07: Typing indicator
- **Given** l'AgentChatPanel ouvert
- **When** l'agent est en train de taper
- **Then** un indicateur "Agent is typing..." s'affiche

### AC-08: Auto-scroll
- **Given** l'AgentChatPanel avec des messages
- **When** un nouveau message arrive
- **Then** le panel scroll automatiquement vers le bas
- **When** l'utilisateur a scrolle manuellement vers le haut
- **Then** l'auto-scroll est desactive (respecter la position de lecture)

### AC-09: Connection status indicator
- **Given** l'AgentChatPanel ouvert
- **When** le WebSocket est connecte
- **Then** un indicateur vert "Connected" s'affiche
- **When** le WebSocket se reconnecte
- **Then** un indicateur orange "Reconnecting..." s'affiche
- **When** le WebSocket est deconnecte
- **Then** un indicateur rouge "Disconnected" s'affiche

### AC-10: Pipe status
- **Given** l'AgentChatPanel ouvert
- **When** un pipe container est attache
- **Then** un indicateur "Pipe attached" vert s'affiche avec le nombre de messages pipes
- **When** aucun pipe n'est attache
- **Then** un indicateur "Pipe detached" gris s'affiche

### AC-11: Empty state channel
- **Given** l'AgentChatPanel ouvert sur un channel sans messages
- **When** le panel charge
- **Then** un etat vide s'affiche : "No messages yet. Start the conversation!"

### AC-12: Sidebar navigation
- **Given** un utilisateur avec permission `chat:agent`
- **When** il regarde la sidebar
- **Then** un item "Chat" est visible dans la section "Work"

---

## 4. Data-test-id Mapping

| Element | data-testid | Usage |
|---------|-------------|-------|
| Page Chat container | `chat-s04-page` | Page wrapper |
| Page title | `chat-s04-title` | H1 title |
| Channel list | `chat-s04-channel-list` | Channel list container |
| Channel item | `chat-s04-channel-item` | Individual channel row |
| Channel name | `chat-s04-channel-name` | Channel name text |
| Channel status badge | `chat-s04-channel-status` | Open/closed badge |
| Channel agent name | `chat-s04-channel-agent` | Agent name |
| Channel last message | `chat-s04-channel-last-msg` | Last message preview |
| Empty channels state | `chat-s04-empty-channels` | No channels state |
| Loading state | `chat-s04-loading` | Loading skeleton |
| Error state | `chat-s04-error` | Error display |
| AgentChatPanel container | `chat-s04-panel` | Chat panel wrapper |
| Panel header | `chat-s04-panel-header` | Panel header with channel info |
| Panel close button | `chat-s04-panel-close` | Close panel button |
| Messages container | `chat-s04-messages` | Scrollable messages area |
| Message bubble | `chat-s04-message` | Individual message |
| Message content | `chat-s04-message-content` | Message text |
| Message sender | `chat-s04-message-sender` | Sender name |
| Message timestamp | `chat-s04-message-time` | Time display |
| User message | `chat-s04-message-user` | User-sent message (right) |
| Agent message | `chat-s04-message-agent` | Agent-sent message (left) |
| System message | `chat-s04-message-system` | System message (center) |
| Input area | `chat-s04-input-area` | Message input container |
| Message input | `chat-s04-input` | Textarea/input field |
| Send button | `chat-s04-send-btn` | Send message button |
| Typing indicator | `chat-s04-typing` | Typing indicator |
| Connection status | `chat-s04-connection` | WebSocket connection status |
| Connection connected | `chat-s04-connection-connected` | Green connected state |
| Connection reconnecting | `chat-s04-connection-reconnecting` | Orange reconnecting |
| Connection disconnected | `chat-s04-connection-disconnected` | Red disconnected |
| Pipe status | `chat-s04-pipe-status` | Container pipe status |
| Pipe attached | `chat-s04-pipe-attached` | Pipe attached indicator |
| Pipe detached | `chat-s04-pipe-detached` | Pipe detached indicator |
| Empty messages state | `chat-s04-empty-messages` | No messages state |
| Scroll to bottom button | `chat-s04-scroll-bottom` | Scroll to latest |
| Sidebar nav item | `chat-s04-nav-chat` | Sidebar Chat item |

---

## 5. Deliverables

### D1: API Client (`ui/src/api/chat.ts`)

```typescript
export const chatApi = {
  listChannels(companyId, filters?) -> { channels, total }
  getChannel(companyId, channelId) -> channel + messageCount
  createChannel(companyId, body) -> channel
  closeChannel(companyId, channelId) -> channel
  getMessages(companyId, channelId, opts?) -> { messages, hasMore }
  getPipeStatus(companyId, channelId) -> pipeStatus
}
```

### D2: Hook useAgentChat (`ui/src/hooks/useAgentChat.ts`)

Custom hook managing:
- WebSocket connection to `/ws/chat/:channelId`
- Message send/receive
- Typing indicators
- Connection state (connected/reconnecting/disconnected)
- Auto-reconnect with exponential backoff
- Message history loading via REST

### D3: AgentChatPanel (`ui/src/components/AgentChatPanel.tsx`)

- Split into header (channel info + close), messages area (scrollable), input area
- Auto-scroll to bottom on new messages
- Scroll-to-bottom button when scrolled up
- Supports user, agent, and system messages

### D4: Chat Sub-components (`ui/src/components/chat/`)

- `MessageBubble.tsx` — user (right, blue) vs agent (left, gray) vs system (center, muted)
- `TypingIndicator.tsx` — animated dots with sender name
- `ConnectionStatus.tsx` — green/orange/red indicator
- `PipeStatusIndicator.tsx` — pipe attached/detached status

### D5: Chat Page (`ui/src/pages/Chat.tsx`)

- Channel list with status filter
- Click channel to open AgentChatPanel
- Empty state when no channels

### D6: Route + Sidebar Integration

- Route: `/chat` in App.tsx with `RequirePermission` `chat:agent`
- Sidebar: "Chat" item in Work section with `MessageSquare` icon

### D7: Query Keys (`ui/src/lib/queryKeys.ts`)

```typescript
chat: {
  channels: (companyId, filters?) => [...]
  detail: (companyId, channelId) => [...]
  messages: (companyId, channelId) => [...]
  pipeStatus: (companyId, channelId) => [...]
}
```

### D8: Barrel Export (`ui/src/api/index.ts`)

Add `export { chatApi } from "./chat"`.

---

## 6. Test Cases (47 tests)

### Groupe 1: File existence (T01-T07)
- T01: `ui/src/api/chat.ts` exists
- T02: `ui/src/hooks/useAgentChat.ts` exists
- T03: `ui/src/components/AgentChatPanel.tsx` exists
- T04: `ui/src/components/chat/MessageBubble.tsx` exists
- T05: `ui/src/components/chat/TypingIndicator.tsx` exists
- T06: `ui/src/components/chat/ConnectionStatus.tsx` exists
- T07: `ui/src/components/chat/PipeStatusIndicator.tsx` exists

### Groupe 2: API client chat.ts (T08-T16)
- T08: exports chatApi object
- T09: chatApi.listChannels calls GET `/companies/:companyId/chat/channels`
- T10: chatApi.getChannel calls GET `/companies/:companyId/chat/channels/:channelId`
- T11: chatApi.createChannel calls POST `/companies/:companyId/chat/channels`
- T12: chatApi.closeChannel calls PATCH `/companies/:companyId/chat/channels/:channelId`
- T13: chatApi.getMessages calls GET `/companies/:companyId/chat/channels/:channelId/messages`
- T14: chatApi.getPipeStatus calls GET `/companies/:companyId/chat/channels/:channelId/pipe`
- T15: imports `api` from `./client`
- T16: barrel export in `api/index.ts`

### Groupe 3: Query keys (T17-T20)
- T17: queryKeys.chat.channels key
- T18: queryKeys.chat.detail key
- T19: queryKeys.chat.messages key
- T20: queryKeys.chat.pipeStatus key

### Groupe 4: useAgentChat hook (T21-T25)
- T21: exports useAgentChat function
- T22: manages WebSocket connection state
- T23: handles messages array
- T24: provides sendMessage function
- T25: tracks typing indicator

### Groupe 5: MessageBubble component (T26-T29)
- T26: exports MessageBubble component
- T27: renders data-testid `chat-s04-message`
- T28: distinguishes user vs agent via data-testid
- T29: renders message content and timestamp

### Groupe 6: TypingIndicator component (T30-T31)
- T30: exports TypingIndicator component
- T31: renders data-testid `chat-s04-typing`

### Groupe 7: ConnectionStatus component (T32-T34)
- T32: exports ConnectionStatus component
- T33: renders data-testid `chat-s04-connection`
- T34: has connected/reconnecting/disconnected states

### Groupe 8: PipeStatusIndicator component (T35-T37)
- T35: exports PipeStatusIndicator component
- T36: renders data-testid `chat-s04-pipe-status`
- T37: has attached/detached states

### Groupe 9: AgentChatPanel component (T38-T42)
- T38: exports AgentChatPanel component
- T39: renders data-testid `chat-s04-panel`
- T40: contains messages area with data-testid `chat-s04-messages`
- T41: contains input area with data-testid `chat-s04-input`
- T42: contains send button with data-testid `chat-s04-send-btn`

### Groupe 10: Chat page (T43-T47)
- T43: Chat.tsx page exists and exports Chat component
- T44: renders data-testid `chat-s04-page`
- T45: route registered in App.tsx with `/chat` path
- T46: sidebar nav item with data-testid `chat-s04-nav-chat`
- T47: RequirePermission wraps chat route with `chat:agent`

---

## 7. Architecture Decisions

- **No page reload**: WebSocket + React state for real-time updates
- **Optimistic sends**: Messages appear immediately, ack updates message ID
- **Exponential backoff**: WebSocket reconnection with 1s, 2s, 4s, 8s, max 30s
- **Auto-scroll logic**: Scroll to bottom on new message only if user is within 100px of bottom
- **Message history**: Load initial 50 messages via REST, then real-time via WS
- **Desktop-first**: Chat panel is a right-side panel (320px), not a full page
