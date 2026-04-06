import { useState } from "react";
import { CodeBlockProps } from "@mnm/shared";

import { Check, Copy } from "lucide-react";


export function MnmCodeBlock({ props }: { props: typeof CodeBlockProps._type }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(props.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      {props.title && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{props.title}</span>
          <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground p-1 rounded">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
      <pre className="overflow-auto rounded-md border bg-muted/50 p-3 text-xs max-h-64">
        <code>{props.code}</code>
      </pre>
    </div>
  );
}
