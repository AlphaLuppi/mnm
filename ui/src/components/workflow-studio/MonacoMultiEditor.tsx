/**
 * MonacoMultiEditor — single Monaco instance with per-file model caching (U13.6).
 *
 * The Workflow Studio edits multiple files simultaneously. Rather than
 * mount a separate Monaco editor per file (expensive + loses state), we
 * keep ONE editor and swap the attached ITextModel whenever `activePath`
 * changes. Each file gets its own model keyed by path, so selection,
 * undo-stack, and folding persist across tab switches.
 *
 * beforeMount registers:
 *   - the governed-workflow JSON Schema against any *.json file named
 *     `workflow.json` so the JSON language service surfaces diagnostics
 *     and autocomplete
 *   - a minimal @mnm/governed-workflows TypeScript extraLib so *.gate.ts
 *     files get autocomplete on `defineGate` + `GateContext` without
 *     bundling the real types
 * Callers can layer their own beforeMount via the `onBeforeMount` prop;
 * it runs AFTER the defaults so they can override.
 */
import { lazy, Suspense, useEffect, useRef } from "react";
import { workflowJsonSchema } from "@mnm/governed-workflows";
import { Skeleton } from "@/components/ui/skeleton";
import type { BeforeMount, OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditorNS } from "monaco-editor";

const Monaco = lazy(() => import("@monaco-editor/react"));

/** URI for the governed-workflow JSON schema registration. */
const WORKFLOW_SCHEMA_URI = "mnm://schemas/workflow.json";

/** Extension → Monaco language id. */
export function detectLanguage(path: string): string {
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".md")) return "markdown";
  return "plaintext";
}

/**
 * Ambient types shipped to Monaco so `.gate.ts` files get autocomplete on
 * `defineGate` + `GateContext` without pulling the real package into the
 * editor runtime.
 */
const GATE_RUNTIME_DTS = `
declare module "@mnm/governed-workflows" {
  export interface GateContext<Artifact = unknown, Config = Record<string, unknown>> {
    artifact: Artifact | undefined;
    run: {
      id: string;
      workflow_name: string;
      git_tag: string;
      params: Record<string, unknown>;
    };
    step: {
      id: string;
      previous_artifacts: Record<string, unknown>;
    };
    config: Config;
    kind: string;
    helpers: Record<string, unknown>;
  }
  export interface GateOutput {
    pass: boolean;
    report: string;
    error_code?: string;
    hints?: string[];
  }
  export function defineGate<
    A = unknown,
    C extends Record<string, unknown> = Record<string, unknown>,
  >(
    fn: (ctx: GateContext<A, C>) => Promise<GateOutput> | GateOutput,
  ): (ctx: GateContext<A, C>) => Promise<GateOutput> | GateOutput;
}
`;

export interface MonacoMultiEditorProps {
  files: Record<string, { content: string; dirty: boolean }>;
  activePath: string | null;
  onChange: (path: string, content: string) => void;
  /**
   * Called once, before the editor mounts. Runs AFTER the component's own
   * defaults so the caller can override JSON schema / TS config if needed.
   */
  onBeforeMount?: BeforeMount;
  readOnly?: boolean;
}

export function MonacoMultiEditor(props: MonacoMultiEditorProps) {
  const { files, activePath, onChange, onBeforeMount, readOnly } = props;

  // Refs survive renders. We keep:
  //  - the editor instance
  //  - the monaco namespace (to create models lazily in effects)
  //  - a map of path → { model, changeSub } so we can dispose listeners
  //  - a flag to suppress onChange while we programmatically call setValue()
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const modelsRef = useRef<
    Map<string, { model: MonacoEditorNS.ITextModel; sub: { dispose(): void } }>
  >(new Map());
  const suppressChangeRef = useRef<boolean>(false);

  /**
   * Returns (creating if needed) the model for a given path, wired up to
   * emit onChange via `onDidChangeContent`. Listener is captured once per
   * model to avoid leaks on re-renders.
   */
  const ensureModel = (
    path: string,
    content: string,
  ): MonacoEditorNS.ITextModel | null => {
    const monaco = monacoRef.current;
    if (!monaco) return null;
    const existing = modelsRef.current.get(path);
    if (existing) return existing.model;

    const uri = monaco.Uri.parse(`file:///${path}`);
    // React 18 Strict Mode (and HMR) can double-mount us, so reuse any model
    // Monaco already holds for this URI instead of throwing a duplicate error.
    const model =
      monaco.editor.getModel(uri) ??
      monaco.editor.createModel(content, detectLanguage(path), uri);

    const sub = model.onDidChangeContent(() => {
      if (suppressChangeRef.current) return;
      onChange(path, model.getValue());
    });

    modelsRef.current.set(path, { model, sub });
    return model;
  };

  /**
   * Combined beforeMount: register the JSON schema + TS extraLib, then
   * delegate to caller's override (if any).
   */
  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;

    // JSON schema for workflow.json
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [
        {
          uri: WORKFLOW_SCHEMA_URI,
          fileMatch: ["*/workflow.json", "workflow.json"],
          schema: workflowJsonSchema as object,
        },
      ],
    });

    // TS extraLib for .gate.ts autocomplete
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      GATE_RUNTIME_DTS,
      "file:///node_modules/@mnm/governed-workflows/index.d.ts",
    );
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2022,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowNonTsExtensions: true,
      strict: true,
    });

    // Caller override runs LAST so it can stomp on our defaults.
    onBeforeMount?.(monaco);
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Attach the model for the currently-active path (if any). The
    // activePath effect below handles subsequent switches.
    if (activePath && files[activePath]) {
      const model = ensureModel(activePath, files[activePath].content);
      if (model) editor.setModel(model);
    }
  };

  // Swap the attached model when activePath changes (or when the file first
  // appears in `files`). We also sync content if the file's buffer changed
  // externally — e.g. a discard-changes action from the parent.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activePath) return;
    const file = files[activePath];
    if (!file) return;

    const model = ensureModel(activePath, file.content);
    if (!model) return;

    // Set the model first (may be the same one on re-render; no-op then).
    if (editor.getModel() !== model) {
      editor.setModel(model);
    }

    // If the parent pushed new content into `files[activePath]`, mirror it
    // into the model — guarded by `suppressChangeRef` so the subsequent
    // onDidChangeContent doesn't re-fire onChange back up.
    if (model.getValue() !== file.content) {
      suppressChangeRef.current = true;
      try {
        model.setValue(file.content);
      } finally {
        suppressChangeRef.current = false;
      }
    }
    // We intentionally re-run when activePath OR the active file's content
    // changes. Depending on `files` wholesale would fire for sibling edits.
  }, [activePath, activePath ? files[activePath]?.content : null]);

  // Dispose models for paths that were removed from `files`. Each dispose is
  // guarded because Monaco can throw `InstantiationService has been disposed`
  // if the editor unmounted in the same render (e.g. save clears files AND
  // activePath, which triggers the empty-state branch and unmounts <Monaco />
  // at the same time the dispose effect runs). Letting that throw bubble up
  // white-screens the whole app via React's unhandled-error semantics.
  useEffect(() => {
    for (const [path, entry] of modelsRef.current.entries()) {
      if (!(path in files)) {
        try {
          entry.sub.dispose();
          entry.model.dispose();
        } catch {
          // Already disposed — ignore.
        }
        modelsRef.current.delete(path);
      }
    }
  }, [files]);

  // Full teardown on unmount. Same try/catch rationale as above.
  useEffect(() => {
    return () => {
      for (const entry of modelsRef.current.values()) {
        try {
          entry.sub.dispose();
          entry.model.dispose();
        } catch {
          // Already disposed — ignore.
        }
      }
      modelsRef.current.clear();
    };
  }, []);

  // Empty state: nothing selected.
  if (!activePath) {
    return (
      <div
        className="h-full w-full flex items-center justify-center p-8 text-center text-sm text-muted-foreground"
        data-testid="monaco-empty"
      >
        Sélectionnez un fichier dans l&apos;arborescence pour commencer
        l&apos;édition.
      </div>
    );
  }

  const activeFile = files[activePath];
  const language = detectLanguage(activePath);

  return (
    // `absolute inset-0` insulates Monaco's measured height from the parent
    // flex chain. Without it, Monaco can grow to fit its content and push the
    // surrounding `<main>` to scroll, which defeats the Studio's own panels.
    <div
      className="h-full w-full min-h-0 relative"
      data-testid="monaco-multi-editor"
    >
      <div className="absolute inset-0">
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <Monaco
            height="100%"
            path={activePath}
            language={language}
            defaultValue={activeFile?.content ?? ""}
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            options={{
              readOnly: readOnly ?? false,
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              wordWrap: "on",
              folding: true,
              lineNumbers: "on",
              // Monaco must observe its container so it resizes when the
              // ResizablePanel handle is dragged or when the window resizes.
              automaticLayout: true,
              quickSuggestions: { other: true, comments: false, strings: true },
              suggestOnTriggerCharacters: true,
            }}
            data-testid="monaco-editor"
          />
        </Suspense>
      </div>
    </div>
  );
}
