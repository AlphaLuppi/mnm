import type { ReactNode } from "react";

/** Renders existing project content inside the center Work pane. */
export function WorkPane({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}
