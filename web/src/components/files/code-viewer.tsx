"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

interface CodeViewerProps {
  content: string;
  filePath: string;
  lines: number;
}

const languageMap: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".rs": "rust",
  ".py": "python",
  ".md": "markdown",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".css": "css",
  ".html": "html",
  ".sql": "sql",
  ".sh": "bash",
  ".toml": "toml",
};

function getLanguage(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  return languageMap[ext] ?? "text";
}

export function CodeViewer({ content, filePath, lines }: CodeViewerProps) {
  const contentLines = content.split("\n");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-mono">{filePath}</span>
        <span>
          {lines} line{lines !== 1 ? "s" : ""} | {getLanguage(filePath)}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <pre className="p-0 text-sm">
          <table className="w-full border-collapse">
            <tbody>
              {contentLines.map((line, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="select-none border-r px-3 py-0 text-right font-mono text-xs text-muted-foreground/50">
                    {i + 1}
                  </td>
                  <td className="px-3 py-0 font-mono whitespace-pre">
                    {line || "\n"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </pre>
      </ScrollArea>
    </div>
  );
}
