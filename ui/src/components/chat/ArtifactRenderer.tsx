import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";

interface ArtifactRendererProps {
  content: string;
  artifactType: string;
  language?: string | null;
  className?: string;
}

export function ArtifactRenderer({
  content,
  artifactType,
  language,
  className,
}: ArtifactRendererProps) {
  switch (artifactType) {
    case "code":
      return (
        <div className={cn("relative", className)}>
          {language && (
            <div className="bg-muted px-3 py-1 text-xs text-muted-foreground border-b border-border rounded-t-md font-mono">
              {language}
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
        <div className={cn("overflow-auto border border-border rounded-md p-4", className)}>
          <pre className="text-sm font-mono whitespace-pre-wrap break-words">
            {content}
          </pre>
        </div>
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
