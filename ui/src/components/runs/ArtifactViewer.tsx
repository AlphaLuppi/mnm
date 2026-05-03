/**
 * ARTIFACT-VIEWER T4.2 — `ArtifactViewer` wrapper.
 *
 * Dispatches a single persisted output (`OutputPersisted`) onto the
 * appropriate renderer:
 *   - `external_url` → simple "Open in new tab" card with the URL.
 *   - `git_file`     → markdown / code / fallback card.
 *                      Markdown extensions render via `MarkdownBody`.
 *                      Other text formats render in a `<pre>`.
 *                      For code (.ts/.tsx/.js/...) the Monaco editor is
 *                      lazy-loaded read-only with the right language id.
 *   - `git_folder`   → file tree summary + the user picks a file (drill
 *                      down out-of-scope for V0, we list filenames).
 *
 * Content fetching is delegated to a small `useFetchText` hook — the
 * server exposes raw blob bytes via
 * `GET /companies/:companyId/governed-workflows/:name/runs/:runId/artifacts/blob?path=...`
 * (route landed in T4.0 alongside artifact persistence). When the route
 * is unavailable we degrade to a "Download" card instead of crashing.
 *
 * Designed to be cheap to mount: heavy renderers (Monaco, mermaid via
 * `MarkdownBody`) are lazy.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Folder, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkdownBody } from "../MarkdownBody";
import { safeExternalHref } from "../../lib/safeHref";
import type { OutputPersisted } from "@mnm/shared";

const Monaco = lazy(() => import("@monaco-editor/react").then((m) => ({ default: m.default })));

interface ArtifactViewerProps {
  output: OutputPersisted;
  /**
   * Builder for the content URL of a `git_file` output. Caller passes
   * the company / workflow / run context once and the viewer derives
   * the per-output URL. Returning `null` disables the fetch and shows
   * a "Download" fallback (useful for tests + composite cross-run cases
   * that have not wired the artifact route yet).
   */
  buildBlobUrl?: (output: Extract<OutputPersisted, { kind: "git_file" }>) => string | null;
}

const TEXTUAL_EXT = new Set([
  "md",
  "markdown",
  "txt",
  "log",
  "csv",
  "tsv",
  "json",
  "yaml",
  "yml",
  "xml",
  "html",
  "css",
  "scss",
  "less",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "c",
  "cpp",
  "h",
  "hpp",
  "sh",
  "bash",
  "zsh",
  "sql",
  "graphql",
  "toml",
  "ini",
  "env",
]);

const MARKDOWN_EXT = new Set(["md", "markdown"]);

const MONACO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  c: "c",
  cpp: "cpp",
  h: "cpp",
  hpp: "cpp",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  sql: "sql",
  graphql: "graphql",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  toml: "ini",
  ini: "ini",
};

function getExtension(path: string): string {
  const idx = path.lastIndexOf(".");
  if (idx < 0) return "";
  return path.slice(idx + 1).toLowerCase();
}

function useFetchText(url: string | null) {
  const [state, setState] = useState<{ text: string | null; loading: boolean; error: string | null }>(
    { text: null, loading: !!url, error: null },
  );

  useEffect(() => {
    if (!url) {
      setState({ text: null, loading: false, error: null });
      return;
    }
    let mounted = true;
    setState({ text: null, loading: true, error: null });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    fetch(url, { signal: controller.signal, credentials: "include" })
      .then((res) => {
        if (res.status === 403) throw new Error("Accès refusé");
        if (res.status === 404) throw new Error("Artifact introuvable");
        if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (mounted) setState({ text, loading: false, error: null });
      })
      .catch((err) => {
        if (!mounted) return;
        if (err.name === "AbortError") {
          setState({ text: null, loading: false, error: "Délai d'attente dépassé" });
        } else {
          setState({ text: null, loading: false, error: err.message ?? String(err) });
        }
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [url]);

  return state;
}

function ExternalUrlCard({ url, name }: { url: string; name: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{name}</span>
        <Badge variant="secondary" className="text-[10px]">
          external
        </Badge>
      </div>
      <p className="font-mono text-xs text-muted-foreground break-all mb-3">{url}</p>
      <Button size="sm" variant="outline" asChild>
        <a href={safeExternalHref(url)} target="_blank" rel="noreferrer">
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Ouvrir dans un nouvel onglet
        </a>
      </Button>
    </div>
  );
}

function GitFolderCard({ output }: { output: Extract<OutputPersisted, { kind: "git_folder" }> }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{output.name}</span>
        <Badge variant="secondary" className="text-[10px]">
          folder · {output.files.length} files
        </Badge>
      </div>
      <p className="font-mono text-xs text-muted-foreground break-all mb-3">{output.path}</p>
      <ul className="text-xs text-muted-foreground space-y-0.5 max-h-72 overflow-auto">
        {output.files.map((f) => (
          <li key={f} className="font-mono">
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FetchErrorCard({ message, downloadUrl }: { message: string; downloadUrl?: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-border bg-card p-8 text-center">
      <AlertCircle className="h-8 w-8 text-destructive/60" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {downloadUrl && (
        <Button size="sm" variant="outline" asChild>
          <a href={downloadUrl} download>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Télécharger
          </a>
        </Button>
      )}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="flex items-center justify-center rounded-md border border-border bg-card p-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function GitFileBody({
  output,
  blobUrl,
}: {
  output: Extract<OutputPersisted, { kind: "git_file" }>;
  blobUrl: string | null;
}) {
  const ext = getExtension(output.path);
  const isMarkdown = MARKDOWN_EXT.has(ext);
  const isText = TEXTUAL_EXT.has(ext);
  const monacoLang = MONACO_LANG[ext];

  const { text, loading, error } = useFetchText(blobUrl);

  if (!blobUrl) {
    return (
      <FetchErrorCard
        message="Aperçu indisponible (pas de blob URL fourni)."
        downloadUrl={null}
      />
    );
  }

  if (loading) return <LoadingCard />;
  if (error) return <FetchErrorCard message={error} downloadUrl={blobUrl} />;
  if (text == null) return null;

  if (isMarkdown) {
    return (
      <div className="rounded-md border border-border bg-card p-4 max-h-[70vh] overflow-auto">
        <MarkdownBody>{text}</MarkdownBody>
      </div>
    );
  }

  if (monacoLang) {
    return (
      <div className="rounded-md border border-border overflow-hidden" style={{ height: "70vh" }}>
        <Suspense fallback={<LoadingCard />}>
          <Monaco
            value={text}
            language={monacoLang}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              wordWrap: "on",
              scrollBeyondLastLine: false,
              fontSize: 12,
            }}
          />
        </Suspense>
      </div>
    );
  }

  if (isText) {
    return (
      <div className="rounded-md border border-border bg-card p-4 max-h-[70vh] overflow-auto">
        <pre className="text-xs font-mono whitespace-pre-wrap break-words">{text}</pre>
      </div>
    );
  }

  // Binary / unknown — fall back to download.
  return (
    <FetchErrorCard
      message={`Aperçu non disponible pour l'extension ".${ext || "bin"}"`}
      downloadUrl={blobUrl}
    />
  );
}

export function ArtifactViewer({ output, buildBlobUrl }: ArtifactViewerProps) {
  if (output.kind === "external_url") {
    return <ExternalUrlCard url={output.url} name={output.name} />;
  }

  if (output.kind === "git_folder") {
    return <GitFolderCard output={output} />;
  }

  // git_file
  const blobUrl = buildBlobUrl ? buildBlobUrl(output) : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{output.name}</span>
        <span className="font-mono text-xs text-muted-foreground truncate">{output.path}</span>
        <Badge variant="secondary" className="text-[10px] ml-auto">
          {output.bytes} bytes
        </Badge>
      </div>
      <GitFileBody output={output} blobUrl={blobUrl} />
    </div>
  );
}

/**
 * Tiny helpers exported for tests — they cover the file-classification
 * decision tree without needing to mount Monaco / MarkdownBody.
 */
export const __test__ = {
  getExtension,
  isMarkdown: (path: string) => MARKDOWN_EXT.has(getExtension(path)),
  isText: (path: string) => TEXTUAL_EXT.has(getExtension(path)),
  monacoLanguage: (path: string) => MONACO_LANG[getExtension(path)] ?? null,
};
