import type { ReactNode } from "react";
import { useSidebar } from "../context/SidebarContext";

interface SidebarSectionProps {
  label: string;
  children: ReactNode;
  "data-testid"?: string;
}

export function SidebarSection({ label, children, "data-testid": testId }: SidebarSectionProps) {
  const { sidebarCollapsed } = useSidebar();

  return (
    <div data-testid={testId}>
      {!sidebarCollapsed && (
        <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
          {label}
        </div>
      )}
      {sidebarCollapsed && (
        <div className="mx-auto my-1 w-6 border-t border-border" />
      )}
      <div className="flex flex-col gap-0.5 mt-0.5">{children}</div>
    </div>
  );
}
