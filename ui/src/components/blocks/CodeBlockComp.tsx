import { useState, useCallback } from "react";
import type { CodeBlockBlock as CodeBlockBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { Copy, Check } from "lucide-react";

export function CodeBlockComp({ block }: { block: CodeBlockBlockType; context: BlockContext }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(block.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [block.code]);

  return (
    <div className="rounded-md border border-border bg-muted/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">
          {block.title ?? block.language ?? "Code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="px-3 py-3 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto">
        <code>{block.code}</code>
      </pre>
    </div>
  );
}
