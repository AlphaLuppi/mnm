import type { ReactNode } from "react";

interface SidebarSectionProps {
  label: string;
  children: ReactNode;
  "data-testid"?: string;
}

export function SidebarSection({ label, children, "data-testid": testId }: SidebarSectionProps) {
  return (
    <div data-testid={testId}>
      <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
        {label}
      </div>
      <div className="flex flex-col gap-0.5 mt-0.5">{children}</div>
    </div>
  );
}
