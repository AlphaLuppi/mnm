import { useState } from "react";
import { CodeBlockProps } from "@mnm/shared";

import { Button } from "../ui/button";
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
          <Button variant="ghost" size="icon" onClick={handleCopy} aria-label={copied ? "Copied" : "Copy code"} className="h-6 w-6">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
      <pre className="overflow-auto rounded-md border bg-muted/50 p-3 text-xs max-h-64 whitespace-pre-wrap break-all">
        <code>{props.code}</code>
      </pre>
    </div>
  );
}
