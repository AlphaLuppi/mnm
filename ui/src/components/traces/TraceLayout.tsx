/**
 * OBS-04: Resizable Split Layout
 *
 * A horizontal split panel: left panel for the tree/timeline view,
 * right panel for detail/inspection. Uses react-resizable-panels.
 */

import { memo, type ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

interface TraceLayoutProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
}

export const TraceLayout = memo(function TraceLayout({
  leftPanel,
  rightPanel,
}: TraceLayoutProps) {
  return (
    <Group
      orientation="horizontal"
      className="h-full"
      data-testid="trace-layout-panels"
    >
      <Panel id="trace-left" defaultSize={40} minSize={25}>
        <div className="h-full overflow-auto">{leftPanel}</div>
      </Panel>
      <Separator className="w-1.5 bg-border hover:bg-primary/20 transition-colors" />
      <Panel id="trace-right" defaultSize={60} minSize={30}>
        <div className="h-full overflow-auto">{rightPanel}</div>
      </Panel>
    </Group>
  );
});
