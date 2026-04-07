import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Loader2,
  AlertCircle,
  FileQuestion,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Types & helpers ───────────────────────────────────────────────

export interface DocumentViewerItem {
  id: string;
  title: string;
  mimeType: string;
  url: string;
}

type MimeCategory = "pdf" | "image" | "video" | "audio" | "text" | "markdown" | "csv" | "json" | "unknown";

function getMimeCategory(mimeType: string): MimeCategory {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "text/markdown") return "markdown";
  if (mimeType === "text/csv") return "csv";
  if (mimeType === "application/json") return "json";
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/javascript" ||
    mimeType === "application/typescript" ||
    mimeType === "application/xml"
  )
    return "text";
  return "unknown";
}

// ─── Context + Provider + Hook ─────────────────────────────────────

interface DocumentViewerContextValue {
  isOpen: boolean;
  documents: DocumentViewerItem[];
  currentIndex: number;
  openDocument: (doc: DocumentViewerItem) => void;
  openDocuments: (docs: DocumentViewerItem[], startIndex?: number) => void;
  closeDocument: () => void;
  next: () => void;
  prev: () => void;
}

const DocumentViewerContext = createContext<DocumentViewerContextValue | null>(null);

export function DocumentViewerProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<DocumentViewerItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const openDocument = useCallback((doc: DocumentViewerItem) => {
    setDocuments([doc]);
    setCurrentIndex(0);
    setIsOpen(true);
  }, []);

  const openDocuments = useCallback((docs: DocumentViewerItem[], startIndex = 0) => {
    setDocuments(docs);
    setCurrentIndex(startIndex);
    setIsOpen(true);
  }, []);

  const closeDocument = useCallback(() => {
    setIsOpen(false);
    setDocuments([]);
    setCurrentIndex(0);
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, documents.length - 1));
  }, [documents.length]);

  const prev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  return (
    <DocumentViewerContext.Provider
      value={{ isOpen, documents, currentIndex, openDocument, openDocuments, closeDocument, next, prev }}
    >
      {children}
      <DocumentViewerDialog />
    </DocumentViewerContext.Provider>
  );
}

export function useDocumentViewer() {
  const ctx = useContext(DocumentViewerContext);
  if (!ctx) {
    throw new Error("useDocumentViewer must be used within DocumentViewerProvider");
  }
  return ctx;
}

// ─── useFetchContent ───────────────────────────────────────────────

function useFetchContent(url: string) {
  const [state, setState] = useState<{ content: string | null; loading: boolean; error: string | null }>({
    content: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    setState({ content: null, loading: true, error: null });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (res.status === 403) throw new Error("Accès refusé — vérifiez vos permissions");
        if (res.status === 404) throw new Error("Document introuvable");
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return res.text();
      })
      .then((content) => {
        if (mounted) setState({ content, loading: false, error: null });
      })
      .catch((err) => {
        if (!mounted) return;
        if (err.name === "AbortError") {
          setState({ content: null, loading: false, error: "Délai d'attente dépassé" });
        } else {
          setState({ content: null, loading: false, error: err.message });
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

// ─── Error / Loading states ────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="sr-only">Chargement...</span>
    </div>
  );
}

export function ErrorState({ message, url }: { message: string; url: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
      <AlertCircle className="h-10 w-10 text-destructive/60" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" asChild>
        <a href={url} download>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Télécharger le fichier
        </a>
      </Button>
    </div>
  );
}

// ─── Renderers ─────────────────────────────────────────────────────

// PDF — lazy loaded
const PdfRendererLazy = lazy(() => import("./document-viewer-pdf").then((m) => ({ default: m.PdfRenderer })));

function PdfRendererWrapper({ url, title }: { url: string; title: string }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PdfRendererLazy url={url} title={title} />
    </Suspense>
  );
}

function ImageRenderer({ url, title }: { url: string; title: string }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const handleWheel = useCallback((e: ReactWheelEvent) => {
    e.stopPropagation();
    setScale((s) => Math.max(0.5, Math.min(5, s + (e.deltaY < 0 ? 0.25 : -0.25))));
  }, []);

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (scale <= 1) return;
      e.preventDefault();
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    },
    [scale, position],
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      if (!dragging) return;
      const maxOffset = 500 * scale;
      setPosition({
        x: Math.max(-maxOffset, Math.min(maxOffset, dragStart.current.posX + (e.clientX - dragStart.current.x))),
        y: Math.max(-maxOffset, Math.min(maxOffset, dragStart.current.posY + (e.clientY - dragStart.current.y))),
      });
    },
    [dragging, scale],
  );

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleDoubleClick = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "in") setScale((s) => Math.min(5, s + 0.25));
      if (detail === "out") setScale((s) => Math.max(0.5, s - 0.25));
    };
    window.addEventListener("document-viewer-zoom", handler);
    return () => window.removeEventListener("document-viewer-zoom", handler);
  }, []);

  if (error) return <ErrorState message="Impossible de charger l'image" url={url} />;

  return (
    <div
      className="flex items-center justify-center h-full overflow-hidden select-none"
      style={{ cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <img
        src={url}
        alt={title}
        className={`max-w-full max-h-full object-contain ${dragging ? "" : "transition-transform duration-100"}`}
        style={{ transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)` }}
        draggable={false}
        onError={() => setError(true)}
      />
    </div>
  );
}

function VideoRenderer({ url, mimeType }: { url: string; mimeType: string }) {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <video controls className="max-w-full max-h-full rounded">
        <source src={url} type={mimeType} />
      </video>
    </div>
  );
}

function AudioRenderer({ url }: { url: string }) {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <audio controls src={url} className="w-full max-w-md" />
    </div>
  );
}

function TextRenderer({ url }: { url: string }) {
  const { content, loading, error } = useFetchContent(url);
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} url={url} />;
  return (
    <div className="h-full overflow-auto p-4">
      <pre className="text-xs font-mono whitespace-pre-wrap break-words">{content}</pre>
    </div>
  );
}

function MarkdownRenderer({ url }: { url: string }) {
  const { content, loading, error } = useFetchContent(url);
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} url={url} />;
  return (
    <div className="h-full overflow-auto p-6 prose prose-sm dark:prose-invert max-w-none">
      <Markdown remarkPlugins={[remarkGfm]}>{content ?? ""}</Markdown>
    </div>
  );
}

function CsvRenderer({ url }: { url: string }) {
  const { content, loading, error } = useFetchContent(url);
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} url={url} />;

  const lines = (content ?? "").split("\n").filter((l) => l.trim());
  const MAX_ROWS = 100;
  const truncated = lines.length > MAX_ROWS;
  const visibleLines = lines.slice(0, MAX_ROWS);

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const rows = visibleLines.map(parseRow);
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  return (
    <div className="h-full overflow-auto p-4">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="border border-border bg-muted px-2 py-1.5 text-left font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="hover:bg-muted/40">
              {row.map((cell, ci) => (
                <td key={ci} className="border border-border px-2 py-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {truncated && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Aperçu limité aux 100 premières lignes</span>
          <Button variant="outline" size="sm" className="h-6 text-xs" asChild>
            <a href={url} download>
              <Download className="h-3 w-3 mr-1" />
              Télécharger le fichier complet
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

function JsonRenderer({ url }: { url: string }) {
  const { content, loading, error } = useFetchContent(url);
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} url={url} />;

  let formatted = content ?? "";
  try {
    formatted = JSON.stringify(JSON.parse(formatted), null, 2);
  } catch {
    // Display raw content if JSON parse fails
  }

  return (
    <div className="h-full overflow-auto p-4">
      <pre className="text-xs font-mono whitespace-pre-wrap break-words">{formatted}</pre>
    </div>
  );
}

function FallbackRenderer({ mimeType, url }: { mimeType: string; url: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
      <FileQuestion className="h-12 w-12 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Aperçu non disponible pour ce format</p>
      <Badge variant="secondary" className="text-xs">
        {mimeType}
      </Badge>
      <Button variant="outline" size="sm" asChild>
        <a href={url} download>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Télécharger
        </a>
      </Button>
    </div>
  );
}

// ─── DocumentViewerDialog ──────────────────────────────────────────

function DocumentViewerDialog() {
  const { isOpen, documents, currentIndex, closeDocument, next, prev } = useDocumentViewer();
  const currentDoc = documents[currentIndex];
  const hasMultiple = documents.length > 1;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < documents.length - 1;

  // State reset key — forces renderer remount on document change
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    setResetKey((k) => k + 1);
  }, [currentIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      )
        return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          closeDocument();
          break;
        case "ArrowLeft":
          e.stopPropagation();
          prev();
          break;
        case "ArrowRight":
          e.stopPropagation();
          next();
          break;
        case "+":
        case "=":
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent("document-viewer-zoom", { detail: "in" }));
          break;
        case "-":
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent("document-viewer-zoom", { detail: "out" }));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, closeDocument, next, prev]);

  if (!currentDoc) return null;

  const category = getMimeCategory(currentDoc.mimeType);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDocument()}>
      <DialogContent
        className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 gap-0 overflow-hidden flex flex-col"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <DialogTitle className="text-sm font-medium truncate m-0">{currentDoc.title}</DialogTitle>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
              {currentDoc.mimeType.split("/").pop()}
            </Badge>
            {hasMultiple && (
              <span className="text-xs text-muted-foreground shrink-0">
                {currentIndex + 1} / {documents.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={currentDoc.url} download aria-label="Télécharger">
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={closeDocument} aria-label="Fermer">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body with navigation */}
        <div className="flex-1 min-h-0 relative">
          {/* Previous button */}
          {hasMultiple && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/80 border border-border shadow-sm opacity-60 hover:opacity-100 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
              onClick={prev}
              disabled={!canPrev}
              aria-label="Document précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}

          {/* Renderer */}
          <div className="h-full" key={resetKey}>
            {category === "pdf" && <PdfRendererWrapper url={currentDoc.url} title={currentDoc.title} />}
            {category === "image" && <ImageRenderer url={currentDoc.url} title={currentDoc.title} />}
            {category === "video" && <VideoRenderer url={currentDoc.url} mimeType={currentDoc.mimeType} />}
            {category === "audio" && <AudioRenderer url={currentDoc.url} />}
            {category === "text" && <TextRenderer url={currentDoc.url} />}
            {category === "markdown" && <MarkdownRenderer url={currentDoc.url} />}
            {category === "csv" && <CsvRenderer url={currentDoc.url} />}
            {category === "json" && <JsonRenderer url={currentDoc.url} />}
            {category === "unknown" && <FallbackRenderer mimeType={currentDoc.mimeType} url={currentDoc.url} />}
          </div>

          {/* Next button */}
          {hasMultiple && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/80 border border-border shadow-sm opacity-60 hover:opacity-100 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
              onClick={next}
              disabled={!canNext}
              aria-label="Document suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
