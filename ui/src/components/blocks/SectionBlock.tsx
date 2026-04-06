import { useState } from "react";
import { SectionProps } from "@mnm/shared";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";


export function MnmSection({ props, children }: { props: typeof SectionProps._type; children?: ReactNode }) {
  const [open, setOpen] = useState(true);

  if (!props.collapsible) {
    return (
      <div className="space-y-2">
        {props.title && <h4 className="text-sm font-medium">{props.title}</h4>}
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground/80 transition-colors"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
        {props.title}
      </button>
      {open && <div className="pl-5">{children}</div>}
    </div>
  );
}
