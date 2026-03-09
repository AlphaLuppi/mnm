# Story 6.1: BMAD Workflow Parser

Status: ready-for-dev

## Story

As a **user**,
I want **MnM to parse my BMAD workflow files (YAML/Markdown) into a graph structure**,
So that **they can be visualized and manipulated as diagrams**.

## Acceptance Criteria

### AC1 — Workflow file detection and parsing

**Given** un projet BMAD est ouvert
**When** MnM scanne le repertoire `_bmad/`
**Then** tous les fichiers workflow (`.yaml`, `.md` contenant des workflow definitions) sont detectes et parses (FR48)
**And** chaque workflow est transforme en une structure graph (noeuds + connexions)

### AC2 — YAML workflow parsing

**Given** un fichier workflow YAML est parse
**When** le parser (`js-yaml`) traite le fichier
**Then** chaque etape devient un noeud avec : id, titre, role, instructions
**And** les transitions entre etapes deviennent des connexions directionnelles

### AC3 — Markdown workflow parsing

**Given** un fichier workflow Markdown est parse
**When** le parser traite la structure des headers et des steps
**Then** la hierarchie est transformee en noeuds sequentiels avec branchements si applicable

### AC4 — Malformed file error handling

**Given** un fichier workflow est malforme
**When** le parser rencontre une erreur
**Then** un message d'erreur inline s'affiche avec le fichier et la ligne concernee
**And** les workflows valides restent accessibles

## Tasks / Subtasks

- [ ] Task 1: Define workflow graph types (AC: #1, #2, #3)
  - [ ] 1.1 Create `src/shared/types/workflow.types.ts` with `WorkflowGraph`, `WorkflowNode`, `WorkflowEdge`, `WorkflowNodeType`, `WorkflowSourceFormat` types
  - [ ] 1.2 Define `WorkflowNode` with fields: `id`, `label`, `type` (step/check/action), `role`, `instructions`, `conditions`, `sourceFile`, `sourceLine`
  - [ ] 1.3 Define `WorkflowEdge` with fields: `id`, `source`, `target`, `type` (sequential/conditional), `label` (condition text)
  - [ ] 1.4 Define `WorkflowGraph` with fields: `id`, `name`, `sourceFile`, `sourceFormat` (yaml/markdown), `nodes`, `edges`, `metadata`
  - [ ] 1.5 Write unit tests for type validation helpers

- [ ] Task 2: Implement YAML parser (AC: #2)
  - [ ] 2.1 Create `src/main/services/workflow-parser/yaml-parser.ts` using `js-yaml`
  - [ ] 2.2 Implement `parseYamlWorkflow(filePath: string, content: string): WorkflowParseResult` that loads YAML and extracts steps
  - [ ] 2.3 Map YAML `steps` array to `WorkflowNode[]` with id generation (e.g., `step-{index}`)
  - [ ] 2.4 Map YAML `transitions` / `next` fields to `WorkflowEdge[]` with sequential and conditional edge types
  - [ ] 2.5 Handle nested structures: parallel branches, conditional blocks, sub-workflows
  - [ ] 2.6 Preserve source line information for each node using `js-yaml` schema listeners
  - [ ] 2.7 Write unit tests: valid YAML, nested YAML, parallel branches, empty steps
  - [ ] 2.8 Write unit tests: malformed YAML returns `AppError` with line number

- [ ] Task 3: Implement XML parser (AC: #2)
  - [ ] 3.1 Create `src/main/services/workflow-parser/xml-parser.ts` using `fast-xml-parser`
  - [ ] 3.2 Implement `parseXmlWorkflow(filePath: string, content: string): WorkflowParseResult` that loads XML and extracts process nodes
  - [ ] 3.3 Map XML elements to `WorkflowNode[]` (support BPMN-like elements: `<task>`, `<gateway>`, `<event>`)
  - [ ] 3.4 Map XML sequence flows to `WorkflowEdge[]`
  - [ ] 3.5 Preserve source line/position information
  - [ ] 3.6 Write unit tests: valid XML, BPMN-like structure, malformed XML

- [ ] Task 4: Implement Markdown workflow parser (AC: #3)
  - [ ] 4.1 Create `src/main/services/workflow-parser/markdown-parser.ts`
  - [ ] 4.2 Implement `parseMarkdownWorkflow(filePath: string, content: string): WorkflowParseResult`
  - [ ] 4.3 Parse header hierarchy (## / ### / ####) as workflow steps
  - [ ] 4.4 Detect numbered lists as sequential steps within a section
  - [ ] 4.5 Detect conditional blocks (if/when/else patterns in text) as branch nodes
  - [ ] 4.6 Generate sequential edges between parsed steps
  - [ ] 4.7 Write unit tests: header hierarchy, numbered steps, conditional blocks

- [ ] Task 5: Implement workflow graph builder (AC: #1, #2, #3)
  - [ ] 5.1 Create `src/main/services/workflow-parser/workflow-graph-builder.ts`
  - [ ] 5.2 Implement `buildWorkflowGraph(parseResult: WorkflowParseResult): WorkflowGraph` that normalizes parser output into the unified graph model
  - [ ] 5.3 Validate graph structure: no orphaned nodes, no duplicate ids, all edge targets exist
  - [ ] 5.4 Assign unique ids to nodes and edges if not provided by parsers
  - [ ] 5.5 Compute entry/exit nodes for layout purposes
  - [ ] 5.6 Write unit tests: graph validation, id generation, entry/exit computation

- [ ] Task 6: Implement workflow scanner and orchestrator (AC: #1, #4)
  - [ ] 6.1 Create `src/main/services/workflow-parser/workflow-scanner.ts`
  - [ ] 6.2 Implement `scanWorkflowFiles(projectPath: string): Promise<string[]>` that finds workflow files in `_bmad/` directory
  - [ ] 6.3 Detect file format by extension (`.yaml`/`.yml` -> YAML, `.xml` -> XML, `.md` -> Markdown)
  - [ ] 6.4 Create `src/main/services/workflow-parser/workflow-parser.service.ts`
  - [ ] 6.5 Implement `parseWorkflow(filePath: string): Promise<WorkflowParseResult>` that delegates to the correct parser based on format
  - [ ] 6.6 Implement `parseAllWorkflows(projectPath: string): Promise<WorkflowGraph[]>` that scans and parses all workflow files
  - [ ] 6.7 Handle errors per-file: one malformed file does not prevent others from parsing
  - [ ] 6.8 Emit `AppError` with `code: 'WORKFLOW_PARSE_ERROR'` for malformed files
  - [ ] 6.9 Write unit tests: file scanning, format detection, error isolation

- [ ] Task 7: Create parser types and result types (AC: #4)
  - [ ] 7.1 Create `src/main/services/workflow-parser/workflow-parser.types.ts` with `WorkflowParseResult`, `WorkflowParseError`, `WorkflowRawStep`
  - [ ] 7.2 Define `WorkflowParseResult` as `{ nodes: WorkflowRawStep[]; edges: WorkflowRawEdge[]; metadata: WorkflowMetadata; errors: WorkflowParseError[] }`
  - [ ] 7.3 Define `WorkflowParseError` with `file`, `line`, `column`, `message` fields

- [ ] Task 8: Register IPC handlers (AC: #1)
  - [ ] 8.1 Add `workflow:parse` handler in `src/main/ipc/handlers.ts` that calls `parseWorkflow()`
  - [ ] 8.2 Add `workflow:list` handler that calls `parseAllWorkflows()` and returns graph summaries
  - [ ] 8.3 Wire handlers in main process startup
  - [ ] 8.4 Write integration test: IPC round-trip for workflow parsing

## Dev Notes

### FRs Covered

- **FR25** (partial): Fournit la structure graph (noeuds + connexions) necessaire pour le diagramme visuel. Le rendu visuel est dans Story 6.2.
- **FR26** (partial): L'ordre d'execution est encode dans les edges sequentiels. Les branches paralleles sont modelisees par des edges multiples depuis un noeud fork. Le rendu est dans Story 6.2.
- **FR48** (complete): Parsing complet des fichiers workflow BMAD (YAML/Markdown) pour restitution dans l'editeur visuel.

### Dependencies on Previous Stories

- **Story 1.1** (Project Scaffold, IPC Bridge & Event Bus): Provides the IPC infrastructure (`handlers.ts`, `streams.ts`), event bus, path aliases, `AppError`, `AsyncState<T>`.
- **Story 1.3** (Open Project & BMAD Detection): Provides `project:open` and BMAD structure detection (knows where `_bmad/` is located).

### Workflow Types (Shared)

```typescript
// src/shared/types/workflow.types.ts

export type WorkflowNodeType = 'step' | 'check' | 'action';

export type WorkflowEdgeType = 'sequential' | 'conditional';

export type WorkflowSourceFormat = 'yaml' | 'xml' | 'markdown';

export type WorkflowNodeStatus = 'pending' | 'active' | 'done' | 'error';

export type WorkflowNode = {
  id: string;
  label: string;
  type: WorkflowNodeType;
  role?: string;
  instructions?: string;
  conditions?: string;
  sourceFile: string;
  sourceLine?: number;
  metadata?: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  type: WorkflowEdgeType;
  label?: string;
};

export type WorkflowGraph = {
  id: string;
  name: string;
  sourceFile: string;
  sourceFormat: WorkflowSourceFormat;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  entryNodeId?: string;
  exitNodeIds?: string[];
  metadata?: Record<string, unknown>;
};
```

[Source: architecture.md#Gap-Resolution GAP-3]

### Parser Types (Internal)

```typescript
// src/main/services/workflow-parser/workflow-parser.types.ts

export type WorkflowRawStep = {
  id?: string;
  label: string;
  type: WorkflowNodeType;
  role?: string;
  instructions?: string;
  conditions?: string;
  next?: string | string[];
  sourceLine?: number;
};

export type WorkflowRawEdge = {
  source: string;
  target: string;
  type: WorkflowEdgeType;
  label?: string;
};

export type WorkflowParseError = {
  file: string;
  line?: number;
  column?: number;
  message: string;
};

export type WorkflowMetadata = {
  name?: string;
  description?: string;
  sourceFormat: WorkflowSourceFormat;
  [key: string]: unknown;
};

export type WorkflowParseResult = {
  nodes: WorkflowRawStep[];
  edges: WorkflowRawEdge[];
  metadata: WorkflowMetadata;
  errors: WorkflowParseError[];
};
```

### YAML Parser Implementation Pattern

```typescript
// src/main/services/workflow-parser/yaml-parser.ts
import jsYaml from 'js-yaml';
import type { WorkflowParseResult, WorkflowRawStep, WorkflowRawEdge } from './workflow-parser.types';

export function parseYamlWorkflow(filePath: string, content: string): WorkflowParseResult {
  const errors: WorkflowParseError[] = [];

  let doc: unknown;
  try {
    doc = jsYaml.load(content, { filename: filePath });
  } catch (err) {
    if (err instanceof jsYaml.YAMLException) {
      return {
        nodes: [],
        edges: [],
        metadata: { sourceFormat: 'yaml' },
        errors: [{
          file: filePath,
          line: err.mark?.line,
          column: err.mark?.column,
          message: err.message,
        }],
      };
    }
    throw err;
  }

  // Extract steps from parsed YAML document
  const nodes: WorkflowRawStep[] = [];
  const edges: WorkflowRawEdge[] = [];

  // Implementation: walk the YAML structure, extract steps/transitions
  // Support common BMAD workflow patterns:
  // - steps: [{name, role, instructions, next}]
  // - phases with nested steps
  // - conditional branches (if/else → multiple edges)

  return { nodes, edges, metadata: { sourceFormat: 'yaml', name: extractName(doc) }, errors };
}
```

[Source: architecture.md#Dependencies-to-Add — js-yaml]

### XML Parser Implementation Pattern

```typescript
// src/main/services/workflow-parser/xml-parser.ts
import { XMLParser } from 'fast-xml-parser';
import type { WorkflowParseResult } from './workflow-parser.types';

const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: false,
  trimValues: true,
};

export function parseXmlWorkflow(filePath: string, content: string): WorkflowParseResult {
  const parser = new XMLParser(xmlParserOptions);
  try {
    const doc = parser.parse(content);
    // Extract BPMN-like elements: <process>, <task>, <gateway>, <sequenceFlow>
    // Map to WorkflowRawStep[] and WorkflowRawEdge[]
    return { nodes: [], edges: [], metadata: { sourceFormat: 'xml' }, errors: [] };
  } catch (err) {
    return {
      nodes: [],
      edges: [],
      metadata: { sourceFormat: 'xml' },
      errors: [{ file: filePath, message: String(err) }],
    };
  }
}
```

[Source: architecture.md#Dependencies-to-Add — fast-xml-parser]

### Graph Builder Pattern

```typescript
// src/main/services/workflow-parser/workflow-graph-builder.ts
import type { WorkflowGraph, WorkflowNode, WorkflowEdge } from '@shared/types/workflow.types';
import type { WorkflowParseResult } from './workflow-parser.types';

export function buildWorkflowGraph(
  filePath: string,
  parseResult: WorkflowParseResult
): WorkflowGraph {
  const nodeMap = new Map<string, WorkflowNode>();
  const edges: WorkflowEdge[] = [];

  // 1. Generate unique ids for nodes without ids
  const nodes = parseResult.nodes.map((raw, index) => {
    const id = raw.id ?? `node-${index}`;
    const node: WorkflowNode = {
      id,
      label: raw.label,
      type: raw.type,
      role: raw.role,
      instructions: raw.instructions,
      conditions: raw.conditions,
      sourceFile: filePath,
      sourceLine: raw.sourceLine,
    };
    nodeMap.set(id, node);
    return node;
  });

  // 2. Build edges from raw edges + validate targets exist
  for (const rawEdge of parseResult.edges) {
    if (!nodeMap.has(rawEdge.source) || !nodeMap.has(rawEdge.target)) {
      continue; // skip orphan edges, could log warning
    }
    edges.push({
      id: `edge-${rawEdge.source}-${rawEdge.target}`,
      source: rawEdge.source,
      target: rawEdge.target,
      type: rawEdge.type,
      label: rawEdge.label,
    });
  }

  // 3. Compute entry/exit nodes
  const targetSet = new Set(edges.map(e => e.target));
  const sourceSet = new Set(edges.map(e => e.source));
  const entryNodeId = nodes.find(n => !targetSet.has(n.id))?.id;
  const exitNodeIds = nodes.filter(n => !sourceSet.has(n.id)).map(n => n.id);

  return {
    id: `workflow-${filePath}`,
    name: parseResult.metadata.name ?? filePath,
    sourceFile: filePath,
    sourceFormat: parseResult.metadata.sourceFormat,
    nodes,
    edges,
    entryNodeId,
    exitNodeIds,
    metadata: parseResult.metadata,
  };
}
```

### IPC Channel Registration

```typescript
// In src/main/ipc/handlers.ts — add to registerInvokeHandlers()

// Workflow parsing
ipcMain.handle('workflow:parse', async (_event, args: { filePath: string }) => {
  try {
    const content = await fs.readFile(args.filePath, 'utf-8');
    const result = await workflowParserService.parseWorkflow(args.filePath);
    return result;
  } catch (err) {
    throw normalizeToAppError(err, 'workflow-parser');
  }
});

ipcMain.handle('workflow:list', async (_event, args: { projectPath: string }) => {
  try {
    return await workflowParserService.parseAllWorkflows(args.projectPath);
  } catch (err) {
    throw normalizeToAppError(err, 'workflow-parser');
  }
});
```

[Source: architecture.md#IPC-Channel-Design]

### File Structure

```
src/
  main/
    services/
      workflow-parser/
        yaml-parser.ts
        yaml-parser.test.ts
        xml-parser.ts
        xml-parser.test.ts
        markdown-parser.ts
        markdown-parser.test.ts
        workflow-graph-builder.ts
        workflow-graph-builder.test.ts
        workflow-scanner.ts
        workflow-scanner.test.ts
        workflow-parser.service.ts
        workflow-parser.service.test.ts
        workflow-parser.types.ts
        index.ts                      # Barrel export
  shared/
    types/
      workflow.types.ts               # WorkflowGraph, WorkflowNode, WorkflowEdge
```

[Source: architecture.md#Complete-Project-Directory-Structure]

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Service file | kebab-case + `.service.ts` | `workflow-parser.service.ts` |
| Parser files | kebab-case + `.ts` | `yaml-parser.ts` |
| Types file | kebab-case + `.types.ts` | `workflow-parser.types.ts` |
| Tests | co-located, same name + `.test.ts` | `yaml-parser.test.ts` |
| Functions | camelCase, named exports | `export function parseYamlWorkflow()` |
| Types | PascalCase, named exports | `export type WorkflowGraph = ...` |
| IPC channels | namespace:action | `'workflow:parse'`, `'workflow:list'` |
| Error codes | UPPER_SNAKE prefixed | `'WORKFLOW_PARSE_ERROR'` |

[Source: architecture.md#Naming-Patterns]

### Testing Strategy

**Unit tests (co-located):**
- `yaml-parser.test.ts`: Parse valid BMAD YAML workflows, handle nested steps, conditional branches, parallel paths, malformed YAML with line numbers
- `xml-parser.test.ts`: Parse valid XML workflows, BPMN-like elements, malformed XML error handling
- `markdown-parser.test.ts`: Parse header hierarchies, numbered lists, conditional text patterns
- `workflow-graph-builder.test.ts`: Graph construction, id generation, entry/exit node computation, orphan edge handling, duplicate id detection
- `workflow-scanner.test.ts`: File discovery in `_bmad/`, format detection by extension
- `workflow-parser.service.test.ts`: Orchestration, per-file error isolation, multi-format project

**Test patterns:**
- Use fixture files in `__fixtures__/` subdirectory for each parser
- Mock `fs.readFile` for scanner tests
- Verify `AppError` format for all error paths
- Test that one malformed file does not prevent other files from parsing

**Performance:**
- No specific perf requirement for parsing, but keep parsing under 1s for typical BMAD workflows (< 50 nodes)

### What NOT to Do

- Do NOT render anything in the renderer — this story is purely main process (parsing). Visual rendering is Story 6.2.
- Do NOT create React components or Zustand stores — those are in Story 6.2+.
- Do NOT implement serializers (graph -> YAML/XML) — those are in Story 6.4.
- Do NOT install `@xyflow/react` or `dagre` — those are needed in Story 6.2.
- Do NOT use `any` — use `unknown` + type guards for parsed YAML/XML content.
- Do NOT use `export default` — named exports only.
- Do NOT hardcode workflow file patterns — make them configurable via constants.
- Do NOT modify BMAD files — this is read-only parsing.

### References

- [Source: architecture.md#Dependencies-to-Add] — js-yaml, fast-xml-parser versions
- [Source: architecture.md#Gap-Resolution GAP-3] — Workflow serializer design (serializer is Story 6.4, but types are shared)
- [Source: architecture.md#Gap-Resolution GAP-4] — Workflow execution tracking (types shared with Story 6.5)
- [Source: architecture.md#Complete-Project-Directory-Structure] — File location for workflow-parser service
- [Source: architecture.md#IPC-Channel-Design] — `workflow:save` and related channels
- [Source: architecture.md#Process-Patterns] — Error handling, `AppError` normalization
- [Source: architecture.md#Naming-Patterns] — File and function naming conventions
- [Source: epics.md#Story-6.1] — Original acceptance criteria
- [Source: epics.md#FR25-FR26-FR48] — Functional requirements covered

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
