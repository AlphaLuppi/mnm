import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { ZoomIn, ZoomOut, RotateCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "./document-viewer";

// Configure PDF.js worker locally (no CDN — enterprise environment)
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export function PdfRenderer({ url, title }: { url: string; title: string }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1, 2, 3]));
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPageNumber(1);
    setVisiblePages(new Set([1, 2, 3]));
  }, []);

  const zoomIn = useCallback(() => setScale((s) => Math.min(3, s + 0.25)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(0.5, s - 0.25)), []);
  const rotate = useCallback(() => setRotation((r) => (r + 90) % 360), []);

  // Fix 3: Zoom keyboard shortcut listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "in") setScale((s) => Math.min(3, s + 0.25));
      if (detail === "out") setScale((s) => Math.max(0.5, s - 0.25));
    };
    window.addEventListener("document-viewer-zoom", handler);
    return () => window.removeEventListener("document-viewer-zoom", handler);
  }, []);

  // Fix 1: IntersectionObserver for scroll-based virtualization
  useEffect(() => {
    if (!numPages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = new Set<number>();
        entries.forEach((entry) => {
          const page = Number(entry.target.getAttribute("data-page"));
          if (entry.isIntersecting) visible.add(page);
        });
        if (visible.size > 0) {
          setVisiblePages((prev) => {
            const next = new Set(prev);
            visible.forEach((p) => {
              next.add(p);
              // Also add adjacent pages for smooth scrolling
              if (p > 1) next.add(p - 1);
              if (p < numPages) next.add(p + 1);
            });
            return next;
          });
          // Update page number to the first visible page
          const sorted = Array.from(visible).sort((a, b) => a - b);
          if (sorted[0]) setPageNumber(sorted[0]);
        }
      },
      { root: containerRef.current, rootMargin: "200px 0px" },
    );

    pageRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [numPages, scale, rotation]);

  // Fix 2: Use imported ErrorState component
  if (error) return <ErrorState message="Impossible de charger le PDF" url={url} />;

  return (
    <div className="flex flex-col h-full">
      {/* PDF Toolbar */}
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 border-b border-border bg-muted/30 shrink-0">
        <Button variant="ghost" size="icon-sm" onClick={zoomOut} aria-label="Zoom arrière" disabled={scale <= 0.5}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon-sm" onClick={zoomIn} aria-label="Zoom avant" disabled={scale >= 3}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <span className="text-xs text-muted-foreground">
          Page {pageNumber} / {numPages || "?"}
        </span>
        <div className="w-px h-4 bg-border mx-1" />
        <Button variant="ghost" size="icon-sm" onClick={rotate} aria-label="Rotation">
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* PDF Content — virtualized scroll */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => setError(true)}
          loading={
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => {
            const page = i + 1;
            const shouldRender = visiblePages.has(page);
            return (
              <div
                key={page}
                ref={(el) => {
                  if (el) pageRefs.current.set(page, el);
                }}
                data-page={page}
                className="mb-4"
                style={shouldRender ? undefined : { height: `${Math.round(800 * scale)}px` }}
              >
                {shouldRender && (
                  <Page
                    pageNumber={page}
                    scale={scale}
                    rotate={rotation}
                    className="shadow-md"
                    loading={
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    }
                  />
                )}
              </div>
            );
          })}
        </Document>
      </div>
    </div>
  );
}
