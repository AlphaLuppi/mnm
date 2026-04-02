# Config Layers — Frontend Implementation Plan (3/3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the frontend for config layers — API client, query keys, layer editors (MCP, Skills, Hooks, Settings), agent "Layers" tab with attachment/conflict management, OAuth connect button, and merge preview panel.

**Architecture:** TanStack Query for server state (useQuery/useMutation). Layer editor uses local useReducer for form state. Merge preview fetched from backend (never computed client-side). OAuth via popup `window.open()` + `postMessage`. Live events WebSocket for OAuth status changes.

**Tech Stack:** React 18, TanStack Query, Tailwind CSS, Zod (client-side validation)

**Prerequisite:** Plans 1/3 and 2/3 (backend CRUD + runtime) must be completed first.

**Spec:** `docs/superpowers/specs/2026-04-02-config-layers-design.md` (sections 12)

---

## File Structure

### New Files — API (`ui/src/api/`)
- `config-layers.ts` — API client for all config layer endpoints

### New Files — Query Keys (`ui/src/lib/`)
- Modify: `queryKeys.ts` — Add config layer query keys

### New Files — Components (`ui/src/components/`)
- `config-layers/LayerEditor.tsx` — Full layer editor (metadata + items list)
- `config-layers/LayerItemList.tsx` — Sortable list of items within a layer
- `config-layers/McpItemEditor.tsx` — MCP server config form
- `config-layers/SkillItemEditor.tsx` — Skill editor with markdown preview
- `config-layers/HookItemEditor.tsx` — Hook config form (event, type, command/url)
- `config-layers/SettingItemEditor.tsx` — Key-value setting editor
- `config-layers/ConflictResolutionDialog.tsx` — Conflict display on attachment
- `config-layers/MergePreviewPanel.tsx` — Readonly merged config view
- `config-layers/McpOAuthConnectButton.tsx` — OAuth popup trigger with status badge

### New Files — Pages (`ui/src/pages/`)
- `config-layers/ConfigLayersPage.tsx` — Company-wide layer management page

### Modified Files
- `ui/src/pages/AgentDetail.tsx` — Add "Layers" tab
- `ui/src/App.tsx` — Add route for config layers page

---

### Task 1: API Client

**Files:**
- Create: `ui/src/api/config-layers.ts`

- [ ] **Step 1: Write the API client**

```typescript
import type {
  ConfigLayer,
  ConfigLayerDetail,
  ConfigLayerItem,
  ConfigLayerFile,
  ConfigLayerRevision,
  AgentConfigLayerAttachment,
  ConflictCheckResult,
  MergePreviewResult,
  UserMcpCredential,
  CreateConfigLayer,
  UpdateConfigLayer,
  CreateConfigLayerItem,
  UpdateConfigLayerItem,
  CreateConfigLayerFile,
  AttachConfigLayer,
  ApprovePromotion,
  RejectPromotion,
} from "@mnm/shared";
import { api } from "./client";

export const configLayersApi = {
  // ── Layer CRUD ──
  list: (companyId: string, opts?: { scope?: string; includeArchived?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.scope) params.set("scope", opts.scope);
    if (opts?.includeArchived) params.set("includeArchived", "true");
    const qs = params.toString();
    return api.get<ConfigLayer[]>(`/companies/${companyId}/config-layers${qs ? `?${qs}` : ""}`);
  },

  get: (layerId: string) =>
    api.get<ConfigLayerDetail>(`/config-layers/${layerId}`),

  create: (companyId: string, input: CreateConfigLayer) =>
    api.post<ConfigLayer>(`/companies/${companyId}/config-layers`, input),

  update: (layerId: string, input: UpdateConfigLayer) =>
    api.patch<ConfigLayer>(`/config-layers/${layerId}`, input),

  archive: (layerId: string) =>
    api.delete<ConfigLayer>(`/config-layers/${layerId}`),

  revisions: (layerId: string) =>
    api.get<ConfigLayerRevision[]>(`/config-layers/${layerId}/revisions`),

  // ── Item CRUD ──
  addItem: (layerId: string, input: CreateConfigLayerItem) =>
    api.post<ConfigLayerItem>(`/config-layers/${layerId}/items`, input),

  updateItem: (layerId: string, itemId: string, input: UpdateConfigLayerItem) =>
    api.patch<ConfigLayerItem>(`/config-layers/${layerId}/items/${itemId}`, input),

  removeItem: (layerId: string, itemId: string) =>
    api.delete<void>(`/config-layers/${layerId}/items/${itemId}`),

  // ── Files ──
  addFile: (layerId: string, itemId: string, input: CreateConfigLayerFile) =>
    api.post<ConfigLayerFile>(`/config-layers/${layerId}/items/${itemId}/files`, input),

  removeFile: (layerId: string, itemId: string, fileId: string) =>
    api.delete<void>(`/config-layers/${layerId}/items/${itemId}/files/${fileId}`),

  // ── Agent Attachment ──
  listAgentLayers: (companyId: string, agentId: string) =>
    api.get<AgentConfigLayerAttachment[]>(`/companies/${companyId}/agents/${agentId}/config-layers`),

  attachToAgent: (companyId: string, agentId: string, input: AttachConfigLayer) =>
    api.post<{ ok: boolean; conflicts: unknown[] }>(`/companies/${companyId}/agents/${agentId}/config-layers`, input),

  detachFromAgent: (companyId: string, agentId: string, layerId: string) =>
    api.delete<void>(`/companies/${companyId}/agents/${agentId}/config-layers/${layerId}`),

  checkConflicts: (companyId: string, agentId: string, input: AttachConfigLayer) =>
    api.post<ConflictCheckResult>(`/companies/${companyId}/agents/${agentId}/config-layers/check`, input),

  mergePreview: (companyId: string, agentId: string) =>
    api.get<MergePreviewResult>(`/companies/${companyId}/agents/${agentId}/config-layers/preview`),

  // ── Promotion ──
  promote: (layerId: string) =>
    api.post<ConfigLayer>(`/config-layers/${layerId}/promote`),

  approvePromotion: (layerId: string, input: ApprovePromotion) =>
    api.post<ConfigLayer>(`/config-layers/${layerId}/promotion/approve`, input),

  rejectPromotion: (layerId: string, input: RejectPromotion) =>
    api.post<ConfigLayer>(`/config-layers/${layerId}/promotion/reject`, input),

  // ── OAuth / Credentials ──
  listCredentials: (companyId: string) =>
    api.get<UserMcpCredential[]>(`/companies/${companyId}/mcp-credentials`),

  revokeCredential: (credentialId: string) =>
    api.delete<void>(`/mcp-credentials/${credentialId}`),
};
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/api/config-layers.ts
git commit -m "feat(config-layers): add frontend API client for all config layer endpoints"
```

---

### Task 2: Query Keys

**Files:**
- Modify: `ui/src/lib/queryKeys.ts`

- [ ] **Step 1: Add config layer query keys**

Add before the closing `};` in `ui/src/lib/queryKeys.ts`:

```typescript
  // CONFIG-LAYERS
  configLayers: {
    list: (companyId: string, scope?: string) =>
      ["config-layers", companyId, "list", scope] as const,
    detail: (layerId: string) =>
      ["config-layers", "detail", layerId] as const,
    revisions: (layerId: string) =>
      ["config-layers", "revisions", layerId] as const,
    forAgent: (companyId: string, agentId: string) =>
      ["config-layers", companyId, "agent", agentId] as const,
    mergePreview: (companyId: string, agentId: string) =>
      ["config-layers", companyId, "agent", agentId, "preview"] as const,
    credentials: (companyId: string) =>
      ["config-layers", companyId, "credentials"] as const,
  },
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/lib/queryKeys.ts
git commit -m "feat(config-layers): add query keys for config layers"
```

---

### Task 3: McpItemEditor Component

**Files:**
- Create: `ui/src/components/config-layers/McpItemEditor.tsx`

- [ ] **Step 1: Write the MCP item editor**

```tsx
import { useState } from "react";
import type { ConfigLayerItem } from "@mnm/shared";

interface McpItemEditorProps {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function McpItemEditor({ item, onSave, onCancel }: McpItemEditorProps) {
  const cfg = (item?.configJson ?? {}) as Record<string, unknown>;
  const [type, setType] = useState<string>((cfg.type as string) ?? "http");
  const [url, setUrl] = useState<string>((cfg.url as string) ?? "");
  const [command, setCommand] = useState<string>((cfg.command as string) ?? "");
  const [args, setArgs] = useState<string>(((cfg.args as string[]) ?? []).join(" "));
  const [envText, setEnvText] = useState<string>(
    cfg.env ? Object.entries(cfg.env as Record<string, string>).map(([k, v]) => `${k}=${v}`).join("\n") : "",
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const config: Record<string, unknown> = { type };

    if (type === "http" || type === "sse") {
      config.url = url;
    } else {
      config.command = command;
      config.args = args.split(/\s+/).filter(Boolean);
    }

    if (envText.trim()) {
      const env: Record<string, string> = {};
      for (const line of envText.split("\n")) {
        const [key, ...rest] = line.split("=");
        if (key?.trim()) env[key.trim()] = rest.join("=").trim();
      }
      config.env = env;
    }

    onSave(config);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300">Transport</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm"
        >
          <option value="http">HTTP</option>
          <option value="sse">SSE</option>
          <option value="stdio">stdio</option>
        </select>
      </div>

      {(type === "http" || type === "sse") && (
        <div>
          <label className="block text-sm font-medium text-gray-300">URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://mcp.example.com/sse"
            className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm"
            required
          />
        </div>
      )}

      {type === "stdio" && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300">Command</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npx -y @modelcontextprotocol/server-github"
              className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Arguments (space-separated)</label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300">Environment Variables (KEY=value, one per line)</label>
        <textarea
          value={envText}
          onChange={(e) => setEnvText(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm font-mono"
          placeholder="GITHUB_TOKEN=${GITHUB_TOKEN}"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">
          Cancel
        </button>
        <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded text-white">
          {item ? "Update" : "Add"} MCP Server
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/config-layers/McpItemEditor.tsx
git commit -m "feat(config-layers): add McpItemEditor component"
```

---

### Task 4: HookItemEditor + SkillItemEditor + SettingItemEditor

**Files:**
- Create: `ui/src/components/config-layers/HookItemEditor.tsx`
- Create: `ui/src/components/config-layers/SkillItemEditor.tsx`
- Create: `ui/src/components/config-layers/SettingItemEditor.tsx`

- [ ] **Step 1: Write the HookItemEditor**

```tsx
import { useState } from "react";
import type { ConfigLayerItem } from "@mnm/shared";
import { HOOK_EVENTS, HOOK_TYPES } from "@mnm/shared";

interface HookItemEditorProps {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function HookItemEditor({ item, onSave, onCancel }: HookItemEditorProps) {
  const cfg = (item?.configJson ?? {}) as Record<string, unknown>;
  const [event, setEvent] = useState<string>((cfg.event as string) ?? "PreToolUse");
  const [matcher, setMatcher] = useState<string>((cfg.matcher as string) ?? "");
  const [hookType, setHookType] = useState<string>((cfg.hookType as string) ?? "command");
  const [command, setCommand] = useState<string>((cfg.command as string) ?? "");
  const [url, setUrl] = useState<string>((cfg.url as string) ?? "");
  const [prompt, setPrompt] = useState<string>((cfg.prompt as string) ?? "");
  const [timeout, setTimeout_] = useState<number>((cfg.timeout as number) ?? 30);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const config: Record<string, unknown> = { event, hookType, timeout };
    if (matcher) config.matcher = matcher;
    if (hookType === "command") config.command = command;
    if (hookType === "http") config.url = url;
    if (hookType === "prompt" || hookType === "agent") config.prompt = prompt;
    onSave(config);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">Event</label>
          <select value={event} onChange={(e) => setEvent(e.target.value)}
            className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm">
            {HOOK_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Type</label>
          <select value={hookType} onChange={(e) => setHookType(e.target.value)}
            className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm">
            {HOOK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300">Matcher (regex, optional)</label>
        <input type="text" value={matcher} onChange={(e) => setMatcher(e.target.value)}
          placeholder="Bash|Edit" className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm" />
      </div>

      {hookType === "command" && (
        <div>
          <label className="block text-sm font-medium text-gray-300">Command</label>
          <input type="text" value={command} onChange={(e) => setCommand(e.target.value)} required
            className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm font-mono" />
        </div>
      )}
      {hookType === "http" && (
        <div>
          <label className="block text-sm font-medium text-gray-300">URL</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required
            className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm" />
        </div>
      )}
      {(hookType === "prompt" || hookType === "agent") && (
        <div>
          <label className="block text-sm font-medium text-gray-300">Prompt</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} required rows={4}
            className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm" />
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
        <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded text-white">
          {item ? "Update" : "Add"} Hook
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Write the SkillItemEditor**

```tsx
import { useState } from "react";
import type { ConfigLayerItem } from "@mnm/shared";

interface SkillItemEditorProps {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function SkillItemEditor({ item, onSave, onCancel }: SkillItemEditorProps) {
  const cfg = (item?.configJson ?? {}) as Record<string, unknown>;
  const fm = (cfg.frontmatter ?? {}) as Record<string, unknown>;
  const [name, setName] = useState<string>((fm.name as string) ?? "");
  const [description, setDescription] = useState<string>((fm.description as string) ?? "");
  const [allowedTools, setAllowedTools] = useState<string>((fm["allowed-tools"] as string) ?? "");
  const [content, setContent] = useState<string>((cfg.content as string) ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const frontmatter: Record<string, unknown> = { name };
    if (description) frontmatter.description = description;
    if (allowedTools) frontmatter["allowed-tools"] = allowedTools;
    onSave({ frontmatter, content });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">Skill Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Allowed Tools</label>
          <input type="text" value={allowedTools} onChange={(e) => setAllowedTools(e.target.value)}
            placeholder="Bash, Read, Edit" className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">Description</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">Content (Markdown)</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={12}
          className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm font-mono" />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
        <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded text-white">
          {item ? "Update" : "Add"} Skill
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Write the SettingItemEditor**

```tsx
import { useState } from "react";
import type { ConfigLayerItem } from "@mnm/shared";
import { SETTING_KEYS } from "@mnm/shared";

interface SettingItemEditorProps {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function SettingItemEditor({ item, onSave, onCancel }: SettingItemEditorProps) {
  const cfg = (item?.configJson ?? {}) as Record<string, unknown>;
  const [key, setKey] = useState<string>((cfg.key as string) ?? "");
  const [value, setValue] = useState<string>(cfg.value !== undefined ? String(cfg.value) : "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Try parsing as JSON, fall back to string
    let parsed: unknown = value;
    try { parsed = JSON.parse(value); } catch { /* keep as string */ }
    onSave({ key, value: parsed });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300">Setting Key</label>
        <select value={key} onChange={(e) => setKey(e.target.value)} required
          className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm">
          <option value="">Select...</option>
          {SETTING_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          <option value="__custom">Custom...</option>
        </select>
        {key === "__custom" && (
          <input type="text" onChange={(e) => setKey(e.target.value)} placeholder="custom.key"
            className="mt-2 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm" />
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">Value</label>
        <input type="text" value={value} onChange={(e) => setValue(e.target.value)} required
          className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm font-mono" />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
        <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded text-white">
          {item ? "Update" : "Add"} Setting
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/config-layers/HookItemEditor.tsx ui/src/components/config-layers/SkillItemEditor.tsx ui/src/components/config-layers/SettingItemEditor.tsx
git commit -m "feat(config-layers): add Hook, Skill, and Setting item editor components"
```

---

### Task 5: LayerEditor + LayerItemList

**Files:**
- Create: `ui/src/components/config-layers/LayerItemList.tsx`
- Create: `ui/src/components/config-layers/LayerEditor.tsx`

- [ ] **Step 1: Write LayerItemList**

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ConfigLayerItem, ConfigLayerItemType } from "@mnm/shared";
import { configLayersApi } from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { McpItemEditor } from "./McpItemEditor";
import { HookItemEditor } from "./HookItemEditor";
import { SkillItemEditor } from "./SkillItemEditor";
import { SettingItemEditor } from "./SettingItemEditor";

const TYPE_LABELS: Record<ConfigLayerItemType, string> = {
  mcp: "MCP Servers",
  skill: "Skills",
  hook: "Hooks",
  setting: "Settings",
};

const TYPE_ICONS: Record<ConfigLayerItemType, string> = {
  mcp: "server",
  skill: "book-open",
  hook: "zap",
  setting: "sliders",
};

interface LayerItemListProps {
  layerId: string;
  items: ConfigLayerItem[];
  itemType: ConfigLayerItemType;
  readOnly?: boolean;
}

export function LayerItemList({ layerId, items, itemType, readOnly }: LayerItemListProps) {
  const [editing, setEditing] = useState<string | null>(null); // itemId or "__new"
  const qc = useQueryClient();
  const filtered = items.filter((i) => i.itemType === itemType);

  const addMut = useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      configLayersApi.addItem(layerId, {
        itemType,
        name: (config.name as string) ?? `${itemType}-${Date.now()}`,
        configJson: config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.configLayers.detail(layerId) });
      setEditing(null);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ itemId, config }: { itemId: string; config: Record<string, unknown> }) =>
      configLayersApi.updateItem(layerId, itemId, { configJson: config }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.configLayers.detail(layerId) });
      setEditing(null);
    },
  });

  const removeMut = useMutation({
    mutationFn: (itemId: string) => configLayersApi.removeItem(layerId, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.configLayers.detail(layerId) });
    },
  });

  function renderEditor(item?: ConfigLayerItem) {
    const onSave = item
      ? (config: Record<string, unknown>) => updateMut.mutate({ itemId: item.id, config })
      : (config: Record<string, unknown>) => addMut.mutate(config);
    const onCancel = () => setEditing(null);

    switch (itemType) {
      case "mcp": return <McpItemEditor item={item} onSave={onSave} onCancel={onCancel} />;
      case "hook": return <HookItemEditor item={item} onSave={onSave} onCancel={onCancel} />;
      case "skill": return <SkillItemEditor item={item} onSave={onSave} onCancel={onCancel} />;
      case "setting": return <SettingItemEditor item={item} onSave={onSave} onCancel={onCancel} />;
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">{TYPE_LABELS[itemType]}</h3>
        {!readOnly && (
          <button onClick={() => setEditing("__new")}
            className="text-xs text-blue-400 hover:text-blue-300">+ Add</button>
        )}
      </div>

      {filtered.length === 0 && editing !== "__new" && (
        <p className="text-xs text-gray-500">No {TYPE_LABELS[itemType].toLowerCase()} configured.</p>
      )}

      {filtered.map((item) => (
        <div key={item.id} className="border border-gray-700 rounded p-3">
          {editing === item.id ? (
            renderEditor(item)
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-200">{item.name}</span>
                {!item.enabled && <span className="ml-2 text-xs text-yellow-500">(disabled)</span>}
              </div>
              {!readOnly && (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(item.id)} className="text-xs text-gray-400 hover:text-white">Edit</button>
                  <button onClick={() => removeMut.mutate(item.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {editing === "__new" && (
        <div className="border border-blue-600 rounded p-3">
          {renderEditor()}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write LayerEditor**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ConfigLayerItemType } from "@mnm/shared";
import { configLayersApi } from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { LayerItemList } from "./LayerItemList";

const ITEM_TYPES: ConfigLayerItemType[] = ["mcp", "skill", "hook", "setting"];

interface LayerEditorProps {
  layerId: string;
  readOnly?: boolean;
  onClose?: () => void;
}

export function LayerEditor({ layerId, readOnly, onClose }: LayerEditorProps) {
  const [activeTab, setActiveTab] = useState<ConfigLayerItemType>("mcp");
  const qc = useQueryClient();

  const { data: layer, isLoading } = useQuery({
    queryKey: queryKeys.configLayers.detail(layerId),
    queryFn: () => configLayersApi.get(layerId),
  });

  const updateMut = useMutation({
    mutationFn: (input: { name?: string; description?: string }) =>
      configLayersApi.update(layerId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.configLayers.detail(layerId) }),
  });

  if (isLoading || !layer) return <div className="p-4 text-gray-400">Loading...</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{layer.name}</h2>
          <p className="text-xs text-gray-400">
            {layer.scope} {layer.enforced && "| enforced"} | {layer.visibility}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-700">
        {ITEM_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm ${activeTab === t ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400 hover:text-white"}`}
          >
            {t === "mcp" ? "MCP Servers" : t.charAt(0).toUpperCase() + t.slice(1) + "s"}
            <span className="ml-1 text-xs text-gray-500">
              ({layer.items.filter((i) => i.itemType === t).length})
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <LayerItemList
          layerId={layerId}
          items={layer.items}
          itemType={activeTab}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/config-layers/LayerItemList.tsx ui/src/components/config-layers/LayerEditor.tsx
git commit -m "feat(config-layers): add LayerEditor + LayerItemList components"
```

---

### Task 6: Agent Layers Tab

**Files:**
- Create: `ui/src/components/config-layers/AgentLayersTab.tsx`
- Create: `ui/src/components/config-layers/MergePreviewPanel.tsx`
- Create: `ui/src/components/config-layers/ConflictResolutionDialog.tsx`
- Modify: `ui/src/pages/AgentDetail.tsx`

- [ ] **Step 1: Write MergePreviewPanel**

```tsx
import { useQuery } from "@tanstack/react-query";
import { configLayersApi } from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";

interface MergePreviewPanelProps {
  companyId: string;
  agentId: string;
}

export function MergePreviewPanel({ companyId, agentId }: MergePreviewPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.configLayers.mergePreview(companyId, agentId),
    queryFn: () => configLayersApi.mergePreview(companyId, agentId),
  });

  if (isLoading) return <div className="text-gray-400 text-sm">Loading preview...</div>;
  if (!data) return null;

  const grouped = {
    mcp: data.items.filter((i) => i.itemType === "mcp"),
    skill: data.items.filter((i) => i.itemType === "skill"),
    hook: data.items.filter((i) => i.itemType === "hook"),
    setting: data.items.filter((i) => i.itemType === "setting"),
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-200">Merged Config Preview</h3>
      <p className="text-xs text-gray-500">
        From {data.layerSources.length} layer(s): {data.layerSources.map((s) => s.layerName).join(", ")}
      </p>

      {Object.entries(grouped).map(([type, items]) => (
        items.length > 0 && (
          <div key={type}>
            <h4 className="text-xs font-medium text-gray-400 uppercase mb-1">
              {type === "mcp" ? "MCP Servers" : type + "s"} ({items.length})
            </h4>
            {items.map((item) => (
              <div key={item.id} className="border border-gray-700 rounded p-2 mb-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-200">{item.name}</span>
                  <span className="text-xs text-gray-500">priority {item.priority}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ))}

      {data.items.length === 0 && (
        <p className="text-xs text-gray-500">No config items resolved for this agent.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write ConflictResolutionDialog**

```tsx
import type { ConflictCheckResult } from "@mnm/shared";

interface ConflictResolutionDialogProps {
  result: ConflictCheckResult;
  onProceed: () => void;
  onCancel: () => void;
}

export function ConflictResolutionDialog({ result, onProceed, onCancel }: ConflictResolutionDialogProps) {
  const hasEnforced = result.conflicts.some((c) => c.severity === "enforced_conflict");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-lg w-full">
        <h3 className="text-lg font-semibold text-white mb-4">
          {hasEnforced ? "Cannot Attach Layer" : "Conflicts Detected"}
        </h3>

        <div className="space-y-2 mb-4">
          {result.conflicts.map((c, i) => (
            <div key={i} className={`rounded p-2 text-sm ${
              c.severity === "enforced_conflict" ? "bg-red-900/30 border border-red-700" :
              c.severity === "priority_conflict" ? "bg-yellow-900/30 border border-yellow-700" :
              "bg-blue-900/30 border border-blue-700"
            }`}>
              <span className="font-medium">{c.itemType}: {c.name}</span>
              <span className="text-xs ml-2 text-gray-400">
                from "{c.existingLayerName}" (priority {c.existingPriority})
                {c.severity === "enforced_conflict" && " — ENFORCED, cannot override"}
                {c.severity === "priority_conflict" && " — will be overridden by existing"}
                {c.severity === "override_conflict" && " — will override existing"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
          {!hasEnforced && (
            <button onClick={onProceed} className="px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-500 rounded text-white">
              Attach Anyway
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write AgentLayersTab**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ConflictCheckResult, ConfigLayer } from "@mnm/shared";
import { configLayersApi } from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { LayerEditor } from "./LayerEditor";
import { MergePreviewPanel } from "./MergePreviewPanel";
import { ConflictResolutionDialog } from "./ConflictResolutionDialog";

interface AgentLayersTabProps {
  companyId: string;
  agentId: string;
  baseLayerId: string | null;
}

export function AgentLayersTab({ companyId, agentId, baseLayerId }: AgentLayersTabProps) {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [attachDialog, setAttachDialog] = useState(false);
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
  const [pendingAttach, setPendingAttach] = useState<{ layerId: string; priority: number } | null>(null);
  const qc = useQueryClient();

  const { data: attachedLayers = [] } = useQuery({
    queryKey: queryKeys.configLayers.forAgent(companyId, agentId),
    queryFn: () => configLayersApi.listAgentLayers(companyId, agentId),
  });

  const { data: availableLayers = [] } = useQuery({
    queryKey: queryKeys.configLayers.list(companyId),
    queryFn: () => configLayersApi.list(companyId),
    enabled: attachDialog,
  });

  const attachMut = useMutation({
    mutationFn: (input: { layerId: string; priority: number }) =>
      configLayersApi.attachToAgent(companyId, agentId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.configLayers.forAgent(companyId, agentId) });
      qc.invalidateQueries({ queryKey: queryKeys.configLayers.mergePreview(companyId, agentId) });
      setAttachDialog(false);
      setConflictResult(null);
      setPendingAttach(null);
    },
  });

  const detachMut = useMutation({
    mutationFn: (layerId: string) =>
      configLayersApi.detachFromAgent(companyId, agentId, layerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.configLayers.forAgent(companyId, agentId) });
      qc.invalidateQueries({ queryKey: queryKeys.configLayers.mergePreview(companyId, agentId) });
    },
  });

  async function handleAttach(layerId: string) {
    const priority = 0; // Default, could let user choose
    const check = await configLayersApi.checkConflicts(companyId, agentId, { layerId, priority });

    if (check.conflicts.length > 0) {
      setConflictResult(check);
      setPendingAttach({ layerId, priority });
    } else {
      attachMut.mutate({ layerId, priority });
    }
  }

  if (editingLayerId) {
    return <LayerEditor layerId={editingLayerId} onClose={() => setEditingLayerId(null)} />;
  }

  return (
    <div className="grid grid-cols-3 gap-6 p-4">
      {/* Left: Attached Layers */}
      <div className="col-span-2 space-y-4">
        {/* Base Layer */}
        {baseLayerId && (
          <div className="border border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-semibold text-white">Base Layer</span>
                <span className="ml-2 text-xs text-gray-500">Priority 500</span>
              </div>
              <button onClick={() => setEditingLayerId(baseLayerId)}
                className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
            </div>
          </div>
        )}

        {/* Additional Layers */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">Additional Layers</h3>
          <button onClick={() => setAttachDialog(true)}
            className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white">
            + Attach Layer
          </button>
        </div>

        {attachedLayers.length === 0 && (
          <p className="text-xs text-gray-500">No additional layers attached.</p>
        )}

        {attachedLayers.map((att) => (
          <div key={att.layerId} className="border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-200">{att.layer.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {att.layer.scope} | priority {att.priority}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingLayerId(att.layerId)}
                  className="text-xs text-gray-400 hover:text-white">View</button>
                <button onClick={() => detachMut.mutate(att.layerId)}
                  className="text-xs text-red-400 hover:text-red-300">Detach</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Right: Merge Preview */}
      <div className="border-l border-gray-700 pl-4">
        <MergePreviewPanel companyId={companyId} agentId={agentId} />
      </div>

      {/* Attach dialog */}
      {attachDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Attach a Layer</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableLayers
                .filter((l) => !attachedLayers.some((a) => a.layerId === l.id) && l.id !== baseLayerId)
                .map((layer) => (
                  <button key={layer.id} onClick={() => handleAttach(layer.id)}
                    className="w-full text-left border border-gray-700 rounded p-3 hover:border-blue-500">
                    <div className="text-sm text-gray-200">{layer.name}</div>
                    <div className="text-xs text-gray-500">{layer.scope} | {layer.visibility}</div>
                  </button>
                ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setAttachDialog(false)}
                className="text-sm text-gray-400 hover:text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict dialog */}
      {conflictResult && pendingAttach && (
        <ConflictResolutionDialog
          result={conflictResult}
          onProceed={() => attachMut.mutate(pendingAttach)}
          onCancel={() => { setConflictResult(null); setPendingAttach(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add "Layers" tab to AgentDetail.tsx**

In `ui/src/pages/AgentDetail.tsx`:

1. Update the `AgentDetailView` type (around line 188):
```typescript
type AgentDetailView = "overview" | "configure" | "runs" | "layers";
```

2. Update the `parseAgentDetailView` function (around line 190):
```typescript
  if (value === "layers") return value;
```

3. Add tab button in the tab bar section (around the existing configure/runs tabs):
```tsx
<button onClick={() => navigate(`/agents/${canonicalAgentRef}/layers`)}
  className={activeView === "layers" ? "active-tab-class" : "inactive-tab-class"}>
  Layers
</button>
```

4. Add the rendering section (around line 685, after the runs tab):
```tsx
{activeView === "layers" && agent && (
  <AgentLayersTab
    companyId={agent.companyId}
    agentId={agent.id}
    baseLayerId={(agent as any).baseLayerId ?? null}
  />
)}
```

5. Add import at top:
```typescript
import { AgentLayersTab } from "../components/config-layers/AgentLayersTab";
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/config-layers/AgentLayersTab.tsx ui/src/components/config-layers/MergePreviewPanel.tsx ui/src/components/config-layers/ConflictResolutionDialog.tsx ui/src/pages/AgentDetail.tsx
git commit -m "feat(config-layers): add Agent Layers tab with attach, conflict detection, merge preview"
```

---

### Task 7: McpOAuthConnectButton

**Files:**
- Create: `ui/src/components/config-layers/McpOAuthConnectButton.tsx`

- [ ] **Step 1: Write the OAuth connect button**

```tsx
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";

interface McpOAuthConnectButtonProps {
  itemId: string;
  companyId: string;
  status?: "pending" | "connected" | "expired" | "revoked" | "error";
}

export function McpOAuthConnectButton({ itemId, companyId, status }: McpOAuthConnectButtonProps) {
  const [connecting, setConnecting] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "oauth_success" && event.data.itemId === itemId) {
        setConnecting(false);
        qc.invalidateQueries({ queryKey: queryKeys.configLayers.credentials(companyId) });
      }
      if (event.data?.type === "oauth_error") {
        setConnecting(false);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [itemId, companyId, qc]);

  function handleConnect() {
    setConnecting(true);
    const popup = window.open(
      `/api/oauth/authorize/${itemId}`,
      "mnm-oauth",
      "width=600,height=700,popup=yes",
    );

    // Fallback: if popup is blocked or closed early
    const checkInterval = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkInterval);
        setConnecting(false);
      }
    }, 1000);
  }

  const statusColors: Record<string, string> = {
    connected: "text-green-400",
    expired: "text-yellow-400",
    error: "text-red-400",
    pending: "text-gray-400",
    revoked: "text-gray-500",
  };

  return (
    <div className="flex items-center gap-2">
      {status && status !== "pending" && (
        <span className={`text-xs ${statusColors[status] ?? "text-gray-400"}`}>
          {status}
        </span>
      )}
      <button
        onClick={handleConnect}
        disabled={connecting}
        className={`px-3 py-1 text-xs rounded ${
          status === "connected"
            ? "bg-green-900/30 text-green-400 border border-green-700"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {connecting ? "Connecting..." : status === "connected" ? "Connected" : "Connect"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/config-layers/McpOAuthConnectButton.tsx
git commit -m "feat(config-layers): add McpOAuthConnectButton with popup + postMessage pattern"
```

---

### Task 8: Config Layers Admin Page + Routing

**Files:**
- Create: `ui/src/pages/config-layers/ConfigLayersPage.tsx`
- Modify: `ui/src/App.tsx`

- [ ] **Step 1: Write the config layers page**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { configLayersApi } from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";
import { LayerEditor } from "../../components/config-layers/LayerEditor";
import { useCompanyId } from "../../hooks/useCompanyId";
import type { CreateConfigLayer } from "@mnm/shared";

export function ConfigLayersPage() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scope, setScope] = useState<string>("");

  const { data: layers = [], isLoading } = useQuery({
    queryKey: queryKeys.configLayers.list(companyId, scope || undefined),
    queryFn: () => configLayersApi.list(companyId, { scope: scope || undefined }),
    enabled: !!companyId,
  });

  const createMut = useMutation({
    mutationFn: (input: CreateConfigLayer) => configLayersApi.create(companyId, input),
    onSuccess: (layer) => {
      qc.invalidateQueries({ queryKey: queryKeys.configLayers.list(companyId) });
      setCreating(false);
      setEditingId(layer.id);
    },
  });

  const archiveMut = useMutation({
    mutationFn: (layerId: string) => configLayersApi.archive(layerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.configLayers.list(companyId) }),
  });

  if (editingId) {
    return <LayerEditor layerId={editingId} onClose={() => setEditingId(null)} />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Config Layers</h1>
        <button onClick={() => setCreating(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm">
          + New Layer
        </button>
      </div>

      {/* Scope filter */}
      <div className="flex gap-2 mb-4">
        {["", "company", "shared", "private"].map((s) => (
          <button key={s} onClick={() => setScope(s)}
            className={`px-3 py-1 text-xs rounded ${scope === s ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Create dialog */}
      {creating && (
        <div className="border border-blue-600 rounded-lg p-4 mb-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            createMut.mutate({
              name: form.get("name") as string,
              scope: (form.get("scope") as "company" | "shared" | "private") ?? "private",
              visibility: (form.get("scope") === "private" ? "private" : "public") as any,
            });
          }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300">Name</label>
                <input name="name" required className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-300">Scope</label>
                <select name="scope" className="mt-1 w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-sm">
                  <option value="private">Private</option>
                  <option value="shared">Shared</option>
                  <option value="company">Company</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setCreating(false)} className="text-sm text-gray-400">Cancel</button>
              <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 rounded text-white">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* Layer list */}
      {isLoading && <div className="text-gray-400">Loading...</div>}

      <div className="space-y-2">
        {layers.map((layer) => (
          <div key={layer.id} className="border border-gray-700 rounded-lg p-4 flex items-center justify-between hover:border-gray-500">
            <div onClick={() => setEditingId(layer.id)} className="cursor-pointer flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200">{layer.name}</span>
                {layer.enforced && <span className="text-xs bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded">Enforced</span>}
                {layer.promotionStatus === "proposed" && <span className="text-xs bg-yellow-900/50 text-yellow-300 px-1.5 py-0.5 rounded">Pending Review</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {layer.scope} | {layer.visibility} | by {layer.createdByUserId}
              </p>
            </div>
            <button onClick={() => archiveMut.mutate(layer.id)}
              className="text-xs text-red-400 hover:text-red-300">Archive</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

Find the routes section in `ui/src/App.tsx` and add:

```tsx
<Route path="/admin/config-layers" element={<ConfigLayersPage />} />
```

Add import:
```typescript
import { ConfigLayersPage } from "./pages/config-layers/ConfigLayersPage";
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/pages/config-layers/ConfigLayersPage.tsx ui/src/App.tsx
git commit -m "feat(config-layers): add ConfigLayersPage + routing"
```

---

### Task 9: Final Build Verification

**Files:** (none — verification only)

- [ ] **Step 1: Verify frontend builds**

Run: `cd ui && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Verify full stack**

Run: `bun run typecheck`
Expected: All packages pass

- [ ] **Step 3: Start dev and smoke test**

Run: `bun run dev`

1. Navigate to `/admin/config-layers` — should show empty list
2. Create a new layer "Test Layer" (scope: private) — should appear in list
3. Click into it — should show tabbed editor (MCP/Skills/Hooks/Settings)
4. Navigate to an agent detail page — should see "Layers" tab
5. Click "Layers" tab — should show base layer + merge preview

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix(config-layers): resolve frontend build/integration issues"
```

---

## End of Plan 3/3

This plan adds the complete frontend:
- **API client** with typed methods for all 22 endpoints
- **Query keys** for cache management
- **Item editors** — MCP, Skills, Hooks, Settings (4 components)
- **LayerEditor** — Full layer editor with tabbed item management
- **AgentLayersTab** — "Layers" tab in agent detail with attach/detach/conflict detection
- **MergePreviewPanel** — Readonly merged config view from backend
- **ConflictResolutionDialog** — Shows conflicts with severity levels on attachment
- **McpOAuthConnectButton** — OAuth popup with postMessage pattern
- **ConfigLayersPage** — Admin page for company-wide layer management

## Full Feature Summary (All 3 Plans)

| Plan | Content | Files |
|------|---------|-------|
| **1/3 Backend** | DB schema, migrations, Zod, permissions, services, routes | 15 new, 6 modified |
| **2/3 Runtime** | Runtime merge, heartbeat integration, OAuth, data migration | 5 new, 2 modified |
| **3/3 Frontend** | API client, query keys, 10 components, 1 page | 12 new, 3 modified |
| **Total** | | **32 new files, 11 modified** |
