# json-render Integration Plan

> **Date:** 2026-04-06
> **Author:** System Architect
> **Status:** Ready for review
> **Scope:** Replace custom BlockRenderer with `@json-render/core` + `@json-render/react` + `@json-render/shadcn`

---

## A. Packages to Install

```bash
bun add @json-render/core@^0.16.0 @json-render/react@^0.16.0 @json-render/shadcn@^0.16.0
```

All three packages are published on npm (verified `0.16.0` as current latest). Install in the `ui/` workspace only.

**Peer dependencies to verify:** `@json-render/shadcn` depends on Radix UI and Tailwind CSS — both already present in `ui/package.json` (`radix-ui@^1.4.3`, `tailwindcss@^4.0.7`). Also requires `zod` — already a dependency via `@mnm/shared`.

---

## B. What to KEEP (No Changes Needed)

| Asset | Why it stays |
|---|---|
| **Migrations 0058, 0059** (DB `content_blocks` JSONB columns) | DB schema is renderer-agnostic. JSON stored is the same shape. |
| **Drizzle schemas** (`content_blocks` column definitions) | Same reason — DB layer is decoupled from rendering. |
| **Shared types** (`UserWidget`, `InboxItem`, etc.) | No dependency on the renderer. |
| **Backend routes** (`user-widgets`, `inbox-items`, `issues`, `comments`) | API layer passes JSON through. It doesn't render anything. |
| **Admin View Presets page** | Uses its own Widget Registry, not BlockRenderer. |
| **Frontend API clients** (`api/client.ts`) and TanStack hooks | Data fetching layer is unchanged. |
| **`ContentRenderer` concept** (markdown vs blocks detection) | The concept stays. The implementation gets a small refactor (see Section C). |
| **`usePermissions` hook** | Still used for permission checks in action handlers. |
| **`packages/shared/src/validators/content-blocks.ts`** | Server-side validation stays — Zod schemas are reused inside `defineCatalog()`. |

---

## C. What to REFACTOR

### C1. `packages/shared/src/types/content-blocks.ts` — Zod Catalogue

**Current state:** 12 block types defined as Zod schemas with a `type` discriminator field, composed into a `ContentDocument` wrapper.

**json-render compatibility:** `defineCatalog()` accepts custom components defined as `{ props: z.object({...}), description: string }`. This is exactly a Zod schema for props, but WITHOUT the `type` discriminator (json-render uses the component name key in the catalog as the type discriminator instead).

**Required changes:**

1. **Split each Zod schema into a `type` discriminator version (for DB validation) and a `props`-only version (for the catalog).**
2. The `ContentDocument` and discriminated union stay for server-side validation.
3. Export a new `blockPropsSchemas` map for use in `defineCatalog()`.

```typescript
// packages/shared/src/types/content-blocks.ts — NEW ADDITIONS

// Props-only versions (no `type` field) for json-render catalog
export const MetricCardProps = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  trend: z.enum(["up", "down", "flat"]).optional(),
  description: z.string().optional(),
});

export const StatusBadgeProps = z.object({
  text: z.string(),
  variant: z.enum(["success", "warning", "error", "info", "neutral"]),
});

export const DataTableProps = z.object({
  title: z.string().optional(),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    align: z.enum(["left", "center", "right"]).optional(),
  })),
  rows: z.array(z.record(z.unknown())),
  maxRows: z.number().optional(),
});

export const CodeBlockProps = z.object({
  language: z.string().optional(),
  code: z.string(),
  title: z.string().optional(),
});

export const ProgressBarProps = z.object({
  label: z.string(),
  value: z.number().min(0).max(100),
  variant: z.enum(["default", "success", "warning", "error"]).optional(),
});

export const MarkdownProps = z.object({
  content: z.string(),
});

export const ChartProps = z.object({
  chartType: z.enum(["line", "bar", "pie", "donut"]),
  title: z.string().optional(),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })),
});

export const ActionButtonProps = z.object({
  label: z.string(),
  action: z.string(),
  payload: z.record(z.unknown()).optional(),
  variant: z.enum(["default", "destructive", "outline", "ghost"]).optional(),
  confirm: z.string().optional(),
  permission: z.string().optional(),
  icon: z.string().optional(),
});

export const QuickFormProps = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(["text", "textarea", "select", "checkbox", "number", "date"]),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    defaultValue: z.unknown().optional(),
  })),
  submitLabel: z.string().optional(),
  submitAction: z.string(),
  submitPayload: z.record(z.unknown()).optional(),
});

// Reusable map for defineCatalog() and for the block-catalogue API
export const blockPropsSchemas = {
  MetricCard:  { props: MetricCardProps,  description: "KPI metric with label, value, and optional trend indicator" },
  StatusBadge: { props: StatusBadgeProps, description: "Colored badge with semantic variant (success/warning/error/info/neutral)" },
  DataTable:   { props: DataTableProps,   description: "Structured table with columns and rows" },
  CodeBlock:   { props: CodeBlockProps,   description: "Syntax-highlighted code block" },
  ProgressBar: { props: ProgressBarProps, description: "Progress indicator with label and percentage" },
  Markdown:    { props: MarkdownProps,    description: "Markdown text content" },
  Chart:       { props: ChartProps,       description: "Chart visualization (line, bar, pie, donut)" },
  ActionButton:{ props: ActionButtonProps, description: "Interactive button that triggers an action" },
  QuickForm:   { props: QuickFormProps,   description: "Dynamic form with fields and submit action" },
} as const;
```

**Note on naming convention:** json-render uses PascalCase component names (`MetricCard`), while our current system uses kebab-case type discriminators (`metric-card`). The `defineCatalog()` keys become the component type names in the JSON spec. This means the JSON format agents produce will change from:
```json
{ "type": "metric-card", "label": "Revenue", "value": "$42K" }
```
to:
```json
{ "type": "MetricCard", "props": { "label": "Revenue", "value": "$42K" } }
```

**Impact:** The JSON shape changes. This requires updating agent system prompts and the block-catalogue API. Since we have no production data yet (content_blocks columns were just added), this is a clean migration. The DB-stored `ContentDocument` schema must also be updated to match json-render's spec format.

**The existing `ContentBlock` discriminated union and `ContentDocument` should be KEPT for backward compat but marked as `@deprecated`.** A new `JsonRenderSpec` type will be the canonical format going forward.

---

### C2. `ui/src/components/blocks/BlockRenderer.tsx` — Replace with `<Renderer>`

**Current state:** A manual `switch`/lookup-table mapping `block.type` to React components, with a `BlockContext` passed through props.

**json-render replacement:**

```tsx
// ui/src/components/blocks/BlockRenderer.tsx — REWRITTEN

import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { defineRegistry, Renderer, ActionProvider } from "@json-render/react";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { shadcnComponents } from "@json-render/shadcn";
import { blockPropsSchemas } from "@mnm/shared";
import type { Spec } from "@json-render/core";

// Custom MnM component implementations
import { MnmMetricCard } from "./MetricCardBlock";
import { MnmStatusBadge } from "./StatusBadgeBlock";
import { MnmDataTable } from "./DataTableBlock";
import { MnmCodeBlock } from "./CodeBlockComp";
import { MnmProgressBar } from "./ProgressBarBlock";
import { MnmMarkdown } from "./MarkdownBlock";
import { MnmChart } from "./ChartBlock";
import { MnmActionButton } from "./ActionButtonBlock";
import { MnmQuickForm } from "./QuickFormBlock";

// ─── CATALOG ───────────────────────────────────────
// Defines WHAT components exist and their schemas

export const mnmCatalog = defineCatalog(schema, {
  components: {
    // Built-in shadcn from json-render (used directly)
    Card: shadcnComponentDefinitions.Card,
    Stack: shadcnComponentDefinitions.Stack,
    Heading: shadcnComponentDefinitions.Heading,
    Button: shadcnComponentDefinitions.Button,
    Input: shadcnComponentDefinitions.Input,
    Badge: shadcnComponentDefinitions.Badge,
    Separator: shadcnComponentDefinitions.Separator,

    // Custom MnM components
    MetricCard:  blockPropsSchemas.MetricCard,
    StatusBadge: blockPropsSchemas.StatusBadge,
    DataTable:   blockPropsSchemas.DataTable,
    CodeBlock:   blockPropsSchemas.CodeBlock,
    ProgressBar: blockPropsSchemas.ProgressBar,
    Markdown:    blockPropsSchemas.Markdown,
    Chart:       blockPropsSchemas.Chart,
    ActionButton:blockPropsSchemas.ActionButton,
    QuickForm:   blockPropsSchemas.QuickForm,
  },
  actions: {
    // Defined in Section C4 below
  },
});

// ─── REGISTRY ──────────────────────────────────────
// Defines HOW components render

export const { registry, handlers } = defineRegistry(mnmCatalog, {
  components: {
    // Built-in shadcn renderers
    Card: shadcnComponents.Card,
    Stack: shadcnComponents.Stack,
    Heading: shadcnComponents.Heading,
    Button: shadcnComponents.Button,
    Input: shadcnComponents.Input,
    Badge: shadcnComponents.Badge,
    Separator: shadcnComponents.Separator,

    // Custom MnM renderers (refactored from current block components)
    MetricCard:  MnmMetricCard,
    StatusBadge: MnmStatusBadge,
    DataTable:   MnmDataTable,
    CodeBlock:   MnmCodeBlock,
    ProgressBar: MnmProgressBar,
    Markdown:    MnmMarkdown,
    Chart:       MnmChart,
    ActionButton:MnmActionButton,
    QuickForm:   MnmQuickForm,
  },
  actions: {
    // See Section C4
  },
});

// ─── BLOCK RENDERER ────────────────────────────────
// Drop-in replacement — same external interface

export interface BlockRendererProps {
  spec: Spec;
  loading?: boolean;
}

export function BlockRenderer({ spec, loading }: BlockRendererProps) {
  return <Renderer spec={spec} registry={registry} loading={loading} />;
}
```

**Key differences from current:**
1. No more manual `BLOCK_COMPONENTS` lookup table
2. No more `BlockContext` prop threading — actions go through `ActionProvider` (see C4)
3. The `spec` input is a json-render `Spec` object (tree with `root` + `elements`), not a flat `ContentBlock[]`
4. `<Renderer>` handles recursive children automatically — no manual recursion in Stack/Section

---

### C3. Individual Block Components — Become Registry Entries

Each block component needs a signature change. json-render passes `{ props }` (not `{ block, context }`).

**Pattern for each component:**

```tsx
// BEFORE (current)
export function MetricCardBlock({ block }: { block: MetricCardBlockType; context: BlockContext }) {
  return <div>...{block.label}...{block.value}...</div>;
}

// AFTER (json-render registry entry)
export function MnmMetricCard({ props }: { props: MetricCardProps }) {
  return <div>...{props.label}...{props.value}...</div>;
}
```

**Component-by-component assessment:**

| Component | Can use json-render built-in shadcn? | Action needed |
|---|---|---|
| **Stack** | YES — `shadcnComponents.Stack` | DELETE `StackBlock.tsx`. Use built-in. json-render's Stack supports `direction` and `gap`. |
| **Separator/Divider** | YES — `shadcnComponents.Separator` | DELETE `DividerBlock.tsx`. Use built-in. |
| **StatusBadge** | PARTIAL — `shadcnComponents.Badge` exists but lacks our 5-variant color system | KEEP as custom. Rename export to `MnmStatusBadge`. Change `block.xxx` to `props.xxx`. |
| **MetricCard** | NO — no built-in equivalent | KEEP as custom. Rename, re-prop. |
| **DataTable** | NO — json-render has no built-in table | KEEP as custom. Rename, re-prop. |
| **CodeBlock** | NO — json-render has no syntax-highlighted code block | KEEP as custom. Rename, re-prop. |
| **ProgressBar** | NO — no built-in progress component | KEEP as custom. Rename, re-prop. |
| **Markdown** | NO — json-render doesn't render markdown | KEEP as custom. Rename, re-prop. |
| **Chart** | NO — json-render has no chart component | KEEP as custom. Rename, re-prop. |
| **ActionButton** | PARTIAL — `shadcnComponents.Button` exists with `on.press` actions, but lacks our confirmation dialog, permission check, icon map | KEEP as custom. Integrate json-render's action system for the `on.press` dispatch but keep the confirmation dialog and permission logic. |
| **QuickForm** | NO — json-render has individual `Input`, `Select`, `Checkbox` but no composite form | KEEP as custom. This is our most complex component. |
| **Section** (collapsible) | NO — no built-in collapsible section | KEEP as custom. Rename, re-prop. But remove manual recursion — json-render handles `children` automatically. |

**Components to DELETE (replaced by json-render built-ins):** `StackBlock.tsx`, `DividerBlock.tsx`
**Components to REFACTOR (rename + re-prop):** All 10 others
**Components to ADD:** None for v1

---

### C4. `ui/src/hooks/useBlockActions.ts` — Integrates with json-render's Action System

**How json-render actions work (from documentation):**

1. Actions are defined in the catalog: `actions: { submit_form: ... }`
2. Actions are implemented in the registry: `actions: { submit_form: async (params, setState) => { ... } }`
3. JSON spec triggers actions via `on` property: `{ "type": "Button", "on": { "press": [{ "action": "submit_form", "params": { "formId": "123" } }] } }`
4. `ActionProvider` component wraps the tree and provides handlers

**Integration strategy:** Our `useBlockActions` hook returns a `context` object with `onAction`, `hasPermission`, and surface metadata. With json-render, this becomes:

```tsx
// ui/src/hooks/useBlockActions.ts — REFACTORED

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useCompany } from "../context/CompanyContext";
import { usePermissions } from "./usePermissions";
import { queryKeys } from "../lib/queryKeys";
import type { ActionHandler } from "@json-render/react";

interface UseBlockActionsOptions {
  surface: "issue" | "inbox" | "dashboard";
  surfaceId?: string;
}

/**
 * Returns a `handlers` record compatible with json-render's ActionProvider.
 *
 * json-render actions use: { action: "action_name", params: { ... } }
 * We map our surface-aware routing into this system.
 */
export function useBlockActions({ surface, surfaceId }: UseBlockActionsOptions) {
  const { selectedCompanyId } = useCompany();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  // Generic API action — the main handler for all agent-generated actions
  const apiAction: ActionHandler = useCallback(async (params) => {
    if (!selectedCompanyId) throw new Error("No company selected");

    const action = params.action as string;
    const payload = params.payload as Record<string, unknown> | undefined;

    if (surface === "inbox" && surfaceId) {
      await api.post(
        `/companies/${selectedCompanyId}/inbox-items/${surfaceId}/action`,
        { action, payload },
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.inboxItems.list(selectedCompanyId) });
      return;
    }

    if (surface === "issue" && surfaceId) {
      const body = `**Action:** ${action}${payload ? `\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`` : ""}`;
      await api.post(
        `/companies/${selectedCompanyId}/issues/${surfaceId}/comments`,
        { body },
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(surfaceId) });
      return;
    }

    throw new Error(`Unsupported action surface: ${surface}`);
  }, [selectedCompanyId, surface, surfaceId, queryClient]);

  // Form submission — wraps formData into the generic action
  const submitForm: ActionHandler = useCallback(async (params) => {
    await apiAction({
      action: params.submitAction as string,
      payload: { ...params.submitPayload as object, formData: params.formData },
    });
  }, [apiAction]);

  const handlers: Record<string, ActionHandler> = {
    block_action: apiAction,
    submit_form: submitForm,
  };

  return { handlers, hasPermission };
}
```

**Usage at the call site:**

```tsx
// In CommentThread.tsx or any surface
import { ActionProvider } from "@json-render/react";

function MyComponent({ spec }) {
  const { handlers } = useBlockActions({ surface: "issue", surfaceId: issueId });

  return (
    <ActionProvider handlers={handlers}>
      <BlockRenderer spec={spec} />
    </ActionProvider>
  );
}
```

**ActionButton and QuickForm changes:** Instead of calling `context.onAction(action, payload)` directly, they now dispatch through json-render's action system:
- `ActionButton` uses `on: { press: [{ action: "block_action", params: { action: "...", payload: {...} } }] }` in the spec
- `QuickForm` calls `submit_form` action with `{ submitAction, submitPayload, formData }` params

**However**, for ActionButton's confirmation dialog and permission check, these remain in the custom component implementation — json-render's action system doesn't have built-in confirm/permission gates.

---

### C5. `server/src/routes/block-catalogue.ts` — Expose json-render Catalog

**Current state:** Uses `zodToJsonSchema(ContentDocument)` to expose the full JSON Schema.

**With json-render:** The catalog itself can be serialized. `defineCatalog()` returns a catalog object that contains the JSON Schema for each component. We can serialize this for agent consumption.

**Refactored route:**

```typescript
// server/src/routes/block-catalogue.ts — REFACTORED

import { Router } from "express";
import type { Db } from "@mnm/db";
import { blockPropsSchemas } from "@mnm/shared";
import { zodToJsonSchema } from "zod-to-json-schema";

export function blockCatalogueRoutes(_db: Db) {
  const router = Router();

  router.get(
    "/companies/:companyId/block-catalogue",
    (_req, res) => {
      // Generate JSON Schema for each component's props
      const components: Record<string, unknown> = {};
      for (const [name, def] of Object.entries(blockPropsSchemas)) {
        components[name] = {
          description: def.description,
          propsSchema: zodToJsonSchema(def.props, { $refStrategy: "none" }),
        };
      }

      // Built-in shadcn components available to agents
      const builtInComponents = [
        "Card", "Stack", "Heading", "Button", "Input", "Badge", "Separator",
      ];

      res.json({
        schemaVersion: 2,  // Bump version for json-render format
        format: "json-render-spec",
        customComponents: components,
        builtInComponents,
        actions: ["block_action", "submit_form"],
        specFormat: {
          description: "json-render Spec format",
          example: {
            root: "main",
            elements: {
              main: {
                type: "Stack",
                props: { direction: "vertical", gap: "md" },
                children: ["metric-1"],
              },
              "metric-1": {
                type: "MetricCard",
                props: { label: "Revenue", value: "$42K", trend: "up" },
                children: [],
              },
            },
          },
        },
      });
    },
  );

  // POST /blocks/validate stays the same but validates json-render Spec format
  router.post(
    "/companies/:companyId/blocks/validate",
    (req, res) => {
      // TODO: use @json-render/core validation utilities
      // For now, basic structure check
      const { spec } = req.body;
      if (spec?.root && spec?.elements && typeof spec.elements === "object") {
        res.json({ valid: true });
      } else {
        res.status(400).json({ valid: false, error: "Invalid json-render spec format" });
      }
    },
  );

  return router;
}
```

---

## D. json-render Catalogue Design

### D1. Complete `defineCatalog()` Code

```typescript
// ui/src/components/blocks/catalog.ts — NEW FILE

import { z } from "zod";
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { blockPropsSchemas } from "@mnm/shared";

export const mnmCatalog = defineCatalog(schema, {
  components: {
    // ─── BUILT-IN SHADCN (7) ──────────────────────────
    // These use json-render's pre-built shadcn components directly.
    // Agents can use them for basic layout and common UI primitives.
    Card:      shadcnComponentDefinitions.Card,
    Stack:     shadcnComponentDefinitions.Stack,
    Heading:   shadcnComponentDefinitions.Heading,
    Button:    shadcnComponentDefinitions.Button,
    Input:     shadcnComponentDefinitions.Input,
    Badge:     shadcnComponentDefinitions.Badge,
    Separator: shadcnComponentDefinitions.Separator,

    // ─── CUSTOM MNM — DISPLAY (7) ────────────────────
    MetricCard:  blockPropsSchemas.MetricCard,
    StatusBadge: blockPropsSchemas.StatusBadge,
    DataTable:   blockPropsSchemas.DataTable,
    CodeBlock:   blockPropsSchemas.CodeBlock,
    ProgressBar: blockPropsSchemas.ProgressBar,
    Markdown:    blockPropsSchemas.Markdown,
    Chart:       blockPropsSchemas.Chart,

    // ─── CUSTOM MNM — INTERACTIVE (2) ────────────────
    ActionButton: blockPropsSchemas.ActionButton,
    QuickForm:    blockPropsSchemas.QuickForm,

    // ─── CUSTOM MNM — LAYOUT (1) ─────────────────────
    Section: {
      props: z.object({
        title: z.string().optional(),
        collapsible: z.boolean().optional(),
      }),
      description: "Collapsible section with title and children",
    },
  },

  actions: {
    block_action: {
      params: z.object({
        action: z.string().describe("Action identifier (e.g. 'approve', 'reject')"),
        payload: z.record(z.unknown()).optional().describe("Action payload data"),
      }),
      description: "Trigger a generic block action (routed by surface)",
    },
    submit_form: {
      params: z.object({
        submitAction: z.string().describe("Form submission action identifier"),
        submitPayload: z.record(z.unknown()).optional(),
        formData: z.record(z.unknown()).describe("Form field values"),
      }),
      description: "Submit a QuickForm with collected field data",
    },
    validate_form: {
      params: z.object({
        statePath: z.string().describe("State path to write validation result"),
      }),
      description: "Validate all form fields before submission",
    },
  },
});
```

### D2. Complete `defineRegistry()` Code

```typescript
// ui/src/components/blocks/registry.ts — NEW FILE

import { defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { mnmCatalog } from "./catalog";

// Custom MnM component implementations
import { MnmMetricCard } from "./MetricCardBlock";
import { MnmStatusBadge } from "./StatusBadgeBlock";
import { MnmDataTable } from "./DataTableBlock";
import { MnmCodeBlock } from "./CodeBlockComp";
import { MnmProgressBar } from "./ProgressBarBlock";
import { MnmMarkdown } from "./MarkdownBlock";
import { MnmChart } from "./ChartBlock";
import { MnmActionButton } from "./ActionButtonBlock";
import { MnmQuickForm } from "./QuickFormBlock";
import { MnmSection } from "./SectionBlock";

export const { registry } = defineRegistry(mnmCatalog, {
  components: {
    // Built-in shadcn
    Card:      shadcnComponents.Card,
    Stack:     shadcnComponents.Stack,
    Heading:   shadcnComponents.Heading,
    Button:    shadcnComponents.Button,
    Input:     shadcnComponents.Input,
    Badge:     shadcnComponents.Badge,
    Separator: shadcnComponents.Separator,

    // Custom MnM
    MetricCard:  MnmMetricCard,
    StatusBadge: MnmStatusBadge,
    DataTable:   MnmDataTable,
    CodeBlock:   MnmCodeBlock,
    ProgressBar: MnmProgressBar,
    Markdown:    MnmMarkdown,
    Chart:       MnmChart,
    ActionButton: MnmActionButton,
    QuickForm:   MnmQuickForm,
    Section:     MnmSection,
  },

  // Action implementations are provided via ActionProvider at runtime,
  // not here — because they depend on surface context (issue/inbox/dashboard).
  // See useBlockActions.ts for the handler implementations.
});
```

### D3. JSON Spec Format (what agents produce)

**Old format (current custom system):**
```json
{
  "schemaVersion": 1,
  "blocks": [
    { "type": "metric-card", "label": "Revenue", "value": "$42K", "trend": "up" },
    { "type": "status-badge", "text": "Healthy", "variant": "success" }
  ]
}
```

**New format (json-render spec):**
```json
{
  "root": "main",
  "elements": {
    "main": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "md" },
      "children": ["metric-1", "badge-1"]
    },
    "metric-1": {
      "type": "MetricCard",
      "props": { "label": "Revenue", "value": "$42K", "trend": "up" },
      "children": []
    },
    "badge-1": {
      "type": "StatusBadge",
      "props": { "text": "Healthy", "variant": "success" },
      "children": []
    }
  }
}
```

**Key structural differences:**
- Flat element map with string ID references instead of nested array
- `props` object separates component data from structural metadata
- `children` is an array of element IDs (strings), enabling trees
- `root` points to the top-level element
- This format enables streaming — patches can add elements incrementally

---

## E. Migration Strategy

### E1. No Commits to Revert

We do NOT revert any commits. The current implementation (commits `7166991b` through `62be3c2d`) is working code that we refactor in place. The DB migrations, Drizzle schemas, and server routes are keeper code.

### E2. Order of Operations

**Phase 1: Install and scaffold (1 commit)**
1. `bun add @json-render/core @json-render/react @json-render/shadcn` in `ui/`
2. Create `ui/src/components/blocks/catalog.ts` (defineCatalog)
3. Create `ui/src/components/blocks/registry.ts` (defineRegistry)
4. Add `blockPropsSchemas` to `packages/shared/src/types/content-blocks.ts`
5. Verify: `bun run typecheck` passes

**Phase 2: Refactor block components (1 commit per batch)**
1. DELETE `StackBlock.tsx` and `DividerBlock.tsx` (replaced by built-in)
2. Refactor all 10 remaining components: change signature from `({ block, context })` to `({ props })` and rename exports
3. Update `index.ts` barrel file
4. Verify: `bun run typecheck` passes

**Phase 3: Replace BlockRenderer (1 commit)**
1. Rewrite `BlockRenderer.tsx` to use json-render's `<Renderer>`
2. Refactor `ContentRenderer.tsx` to convert `ContentDocument` to json-render `Spec` format (or accept `Spec` directly)
3. Refactor `useBlockActions.ts` to return `handlers` for `ActionProvider`
4. Update all consumers (`CommentThread.tsx`) to wrap with `ActionProvider`
5. Verify: `bun run typecheck` passes, manual UI test

**Phase 4: Update server-side (1 commit)**
1. Update `block-catalogue.ts` to expose json-render format
2. Add a `contentDocumentToSpec()` converter in shared for backward compat
3. Update server-side validation for the new spec format
4. Verify: `bun run typecheck` passes, API test

**Phase 5: Update agent prompts (1 commit)**
1. Update system prompt injection to use json-render spec format
2. Update any agent templates that generate blocks

### E3. Verification Checklist

- [ ] `bun run typecheck` — all 13 packages pass
- [ ] `bun run build` — clean build
- [ ] Manual test: issue with content_blocks renders correctly
- [ ] Manual test: inbox item with blocks renders correctly
- [ ] Manual test: ActionButton click triggers action
- [ ] Manual test: QuickForm submit works
- [ ] Manual test: collapsible Section works
- [ ] Manual test: Chart renders
- [ ] Manual test: markdown fallback still works (no content_blocks)

---

## F. Risks and Mitigations

### F1. json-render Spec Format vs Our ContentDocument Format

**Risk:** Agents currently generate `ContentDocument` format (flat array of blocks). json-render expects a `Spec` format (flat map with root + element IDs). Every existing stored `content_blocks` JSONB is in the old format.

**Mitigation:** Write a `contentDocumentToSpec()` converter:

```typescript
// packages/shared/src/utils/spec-converter.ts

import type { ContentDocument } from "../types/content-blocks";

interface JsonRenderSpec {
  root: string;
  elements: Record<string, {
    type: string;
    props: Record<string, unknown>;
    children: string[];
  }>;
}

export function contentDocumentToSpec(doc: ContentDocument): JsonRenderSpec {
  const elements: JsonRenderSpec["elements"] = {};
  const childIds: string[] = [];

  function processBlock(block: any, prefix: string, index: number): string {
    const id = `${prefix}-${index}`;
    const type = kebabToPascal(block.type);
    const { type: _type, children: blockChildren, ...props } = block;

    const childRefs: string[] = [];
    if (blockChildren && Array.isArray(blockChildren)) {
      for (let i = 0; i < blockChildren.length; i++) {
        childRefs.push(processBlock(blockChildren[i], id, i));
      }
    }

    elements[id] = { type, props, children: childRefs };
    return id;
  }

  for (let i = 0; i < doc.blocks.length; i++) {
    childIds.push(processBlock(doc.blocks[i], "block", i));
  }

  elements["root"] = {
    type: "Stack",
    props: { direction: "vertical", gap: "md" },
    children: childIds,
  };

  return { root: "root", elements };
}

function kebabToPascal(s: string): string {
  return s.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}
```

This converter runs at render time in `ContentRenderer.tsx` for backward compat with existing data. New data from agents should be generated directly in Spec format.

### F2. json-render Library Stability

**Risk:** Library is 3 months old (v0.16.0), API may break.

**Mitigation:** 
- All json-render usage is confined to 3 files: `catalog.ts`, `registry.ts`, `BlockRenderer.tsx`
- If the library dies or breaks, we revert these 3 files back to the current manual implementation (~60 lines of switch/case)
- Lock the version with `@json-render/core@0.16.0` (exact, no caret) until stable

### F3. json-render Lacks Built-in Support for Our Key Features

| Feature | json-render support | Our solution |
|---|---|---|
| Confirmation dialogs on actions | NO built-in | Keep in custom `MnmActionButton` |
| Permission-gated buttons | NO built-in | Keep in custom `MnmActionButton` |
| Collapsible sections | NO built-in | Keep custom `MnmSection` |
| Charts (recharts) | NO built-in | Keep custom `MnmChart` |
| DataTable with sorting | NO built-in | Keep custom `MnmDataTable` |
| QuickForm composite | NO built-in | Keep custom `MnmQuickForm` |
| Markdown rendering | NO built-in | Keep custom `MnmMarkdown` |

**Conclusion:** 10 of our 12 block types remain custom. json-render gives us:
1. The catalog/registry pattern (type-safe, extensible)
2. Built-in `Stack` and `Separator` (deletes 2 files)
3. The streaming `Spec` format with JSONL patches
4. `ActionProvider` for decoupled action dispatch
5. The `<Renderer>` component with automatic child resolution

The ROI is moderate for the current feature set, but **high for future extensibility** — any new shadcn component json-render adds becomes immediately available.

### F4. Bundle Size Impact

**Risk:** Adding 3 new packages increases bundle.

**Mitigation:** 
- `@json-render/core` is lightweight (schema + compiler, no React)
- `@json-render/shadcn` is tree-shakeable — only imported components are bundled
- We already have all the shadcn UI primitives installed
- Net impact estimate: +15-25KB gzipped (acceptable)

### F5. Streaming Not Immediately Needed

**Risk:** The main selling point of json-render (JSONL streaming) requires SSE/WebSocket integration work that isn't in scope for this refactor.

**Mitigation:** 
- Phase 1 uses static specs (no streaming). The `Renderer` component works identically with static specs.
- Streaming can be added later via `useUIStream` hook + `createSpecStreamCompiler` when we integrate with the live-events WebSocket.
- This is explicitly a Phase 2 enhancement, not a blocker.

---

## G. Summary — Decision Matrix

| Criterion | Current custom system | After json-render integration |
|---|---|---|
| Files in `ui/src/components/blocks/` | 14 | 13 (delete Stack, Divider; add catalog.ts, registry.ts) |
| Manual type dispatch code | 12-entry lookup table | 0 (Renderer handles it) |
| Streaming support | None | Ready (Spec format + compiler available) |
| New component effort | New .tsx file + add to lookup + add to Zod union | Add to catalog + add to registry (2 lines each) |
| Action system | Custom `BlockContext` prop threading | `ActionProvider` + handlers (decoupled) |
| Agent JSON format | Flat array (proprietary) | json-render Spec (industry standard) |
| Fallback if lib dies | N/A (we are the lib) | Revert 3 files, back to current system |
| New packages | 0 | 3 (`@json-render/core`, `@json-render/react`, `@json-render/shadcn`) |

**Recommendation:** Proceed with the integration. The risk is low (3-file containment), the immediate benefit is moderate (cleaner architecture, 2 fewer files, standard spec format), and the future benefit is high (streaming, easy component expansion, cross-framework potential).

---

*Generated by System Architect — 2026-04-06*
