import { useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Play } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";

interface ArtifactRendererProps {
  content: string;
  artifactType: string;
  language?: string | null;
  className?: string;
  /** When true, show raw code instead of rendered preview (for code artifacts) */
  showCode?: boolean;
}

export function ArtifactRenderer({
  content,
  artifactType,
  language,
  className,
  showCode = false,
}: ArtifactRendererProps) {
  const runHtmlInNewTab = useCallback(() => {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, [content]);

  switch (artifactType) {
    case "code":
      // If language is HTML and not forced to show code, render as iframe preview
      if (language?.toLowerCase() === "html" && !showCode) {
        return (
          <div className={cn("relative", className)}>
            <iframe
              srcDoc={content}
              sandbox="allow-scripts allow-same-origin"
              className="w-full border-0 rounded-lg bg-white"
              style={{ minHeight: "400px" }}
              title="HTML Preview"
            />
          </div>
        );
      }
      return (
        <div className={cn("relative", className)}>
          {language && (
            <div className="bg-muted px-3 py-1 text-xs text-muted-foreground border-b border-border rounded-t-md font-mono flex items-center justify-between">
              <span>{language}</span>
              {language.toLowerCase() === "html" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px]"
                  onClick={runHtmlInNewTab}
                  title="Run in new tab"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Run
                </Button>
              )}
            </div>
          )}
          <pre
            className={cn(
              "overflow-auto bg-muted/50 p-4 text-sm font-mono rounded-md",
              language && "rounded-t-none",
            )}
          >
            <code>{content}</code>
          </pre>
        </div>
      );

    case "markdown":
      return (
        <div
          className={cn(
            "prose prose-sm dark:prose-invert max-w-none",
            className,
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      );

    case "spreadsheet":
    case "table":
      return (
        <div className={cn("overflow-auto", className)}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      );

    case "html":
      return (
        <iframe
          srcDoc={content}
          sandbox="allow-scripts allow-same-origin"
          className={cn("w-full border-0 rounded-lg bg-white", className)}
          style={{ minHeight: "400px" }}
          title="HTML Preview"
        />
      );

    case "diagram":
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground",
            className,
          )}
        >
          Diagram rendering coming soon
        </div>
      );

    default:
      // structured / JSON / unknown — try to pretty-print JSON, fallback to pre-wrap
      return (
        <pre
          className={cn(
            "overflow-auto bg-muted/50 p-4 text-sm font-mono whitespace-pre-wrap break-words rounded-md",
            className,
          )}
        >
          {tryPrettyJson(content)}
        </pre>
      );
  }
}

function tryPrettyJson(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}
