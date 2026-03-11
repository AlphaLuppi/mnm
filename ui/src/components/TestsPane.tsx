import { useState } from "react";
import { FlaskConical, ChevronRight, Circle, CheckCircle2, XCircle } from "lucide-react";
import { useProjectNavigation } from "../context/ProjectNavigationContext";
import type { BreadcrumbEntry } from "../context/ProjectNavigationContext";
import { useWorkspaceContext } from "../hooks/useWorkspaceContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "../lib/utils";
import type { ContextNode, AcceptanceCriterion } from "@mnm/shared";

/* ── AC status type ── */

type ACStatus = "pending" | "pass" | "fail";

const statusIcon: Record<ACStatus, typeof Circle> = {
  pending: Circle,
  pass: CheckCircle2,
  fail: XCircle,
};

const statusColor: Record<ACStatus, string> = {
  pending: "text-muted-foreground",
  pass: "text-green-500",
  fail: "text-red-500",
};

/* ── Helpers ── */

function findNode(nodes: ContextNode[], id: string): ContextNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

function countAllACs(nodes: ContextNode[]): number {
  return nodes.reduce((sum, node) => {
    if (node.children.length === 0) return sum + (node.detail?.acceptanceCriteria.length ?? 0);
    return sum + countAllACs(node.children);
  }, 0);
}

/* ── Test Card ── */

function TestCard({
  ac,
  storyNode,
  ancestors,
  status = "pending",
}: {
  ac: AcceptanceCriterion;
  storyNode: ContextNode;
  ancestors: BreadcrumbEntry[];
  status?: ACStatus;
}) {
  const { selectNode } = useProjectNavigation();
  const Icon = statusIcon[status];

  return (
    <button
      onClick={() => selectNode(storyNode.id, storyNode.title, storyNode.path, ancestors)}
      className="w-full text-left rounded-md border border-border bg-card p-2.5 hover:bg-accent/50 transition-colors cursor-pointer space-y-1.5"
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", statusColor[status])} />
        <span className="text-[10px] font-mono text-muted-foreground">{ac.id}</span>
        <span className="text-xs font-medium flex-1 truncate">{ac.title}</span>
      </div>
      <div className="space-y-0.5 text-[11px] text-muted-foreground pl-5">
        {ac.given && (
          <p><span className="font-semibold text-foreground/80">Given</span> {ac.given}</p>
        )}
        {ac.when && (
          <p><span className="font-semibold text-foreground/80">When</span> {ac.when}</p>
        )}
        {ac.then && ac.then.length > 0 && (
          <div>
            <span className="font-semibold text-foreground/80">Then</span>
            {ac.then.map((t, i) => (
              <p key={i} className="ml-2">{t}</p>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

/* ── Summary counts ── */

function SummaryCounts({ total, pending, pass, fail }: { total: number; pending: number; pass: number; fail: number }) {
  return (
    <span className="text-[10px] text-muted-foreground tabular-nums">
      {total} AC{total !== 1 ? "s" : ""}
      {pass > 0 && <span className="text-green-500 ml-1">{pass} pass</span>}
      {fail > 0 && <span className="text-red-500 ml-1">{fail} fail</span>}
      {pending > 0 && <span className="ml-1">{pending} pending</span>}
    </span>
  );
}

/* ── Story AC group (leaf node with detail) ── */

function StoryACGroup({
  node,
  ancestors,
  defaultOpen = false,
}: {
  node: ContextNode;
  ancestors: BreadcrumbEntry[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const acs = node.detail?.acceptanceCriteria ?? [];
  const total = acs.length;
  if (total === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium hover:bg-accent/50 rounded transition-colors cursor-pointer">
        <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")} />
        <span className="flex-1 truncate text-left">{node.title}</span>
        <SummaryCounts total={total} pending={total} pass={0} fail={0} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-1.5 pl-4 pr-1 py-1">
          {acs.map((ac) => (
            <TestCard key={ac.id} ac={ac} storyNode={node} ancestors={ancestors} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Node AC group (internal node → recurse into children) ── */

function NodeACGroup({
  node,
  ancestors,
  defaultOpen = false,
}: {
  node: ContextNode;
  ancestors: BreadcrumbEntry[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalACs = countAllACs([node]);
  if (totalACs === 0) return null;

  const entry: BreadcrumbEntry = { id: node.id, title: node.title };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors cursor-pointer">
        <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")} />
        <span className="flex-1 truncate text-left">{node.title}</span>
        <SummaryCounts total={totalACs} pending={totalACs} pass={0} fail={0} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 pl-2">
          {node.children.map((child) =>
            child.children.length === 0 ? (
              <StoryACGroup
                key={child.id}
                node={child}
                ancestors={[...ancestors, entry]}
                defaultOpen={defaultOpen}
              />
            ) : (
              <NodeACGroup
                key={child.id}
                node={child}
                ancestors={[...ancestors, entry]}
                defaultOpen={defaultOpen}
              />
            ),
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Empty state ── */

function TestsPaneEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
      <FlaskConical className="h-8 w-8" />
      <p className="text-sm font-medium">Tests & Validation</p>
      <p className="text-xs text-center max-w-[200px]">{message}</p>
    </div>
  );
}

/* ── Main TestsPane ── */

interface TestsPaneProps {
  projectId?: string;
  companyId?: string;
}

export function TestsPane({ projectId, companyId }: TestsPaneProps) {
  const { selectedItem } = useProjectNavigation();
  const { data: wsCtx, isLoading } = useWorkspaceContext(projectId, companyId);

  if (isLoading) {
    return <TestsPaneEmpty message="Loading..." />;
  }

  if (!wsCtx?.detected || countAllACs(wsCtx.tree) === 0) {
    return <TestsPaneEmpty message="No acceptance criteria found." />;
  }

  // Node selected → show ACs for that node (story or group)
  if (selectedItem?.type === "node") {
    const node = findNode(wsCtx.tree, selectedItem.id);
    if (node) {
      const ancestors = selectedItem.breadcrumb.slice(0, -1);
      const totalACs = countAllACs([node]);
      if (totalACs === 0) {
        return <TestsPaneEmpty message="No acceptance criteria for this selection." />;
      }
      return (
        <ScrollArea className="h-full">
          <div className="p-2 space-y-1">
            {node.children.length === 0 ? (
              <StoryACGroup node={node} ancestors={ancestors} defaultOpen />
            ) : (
              <NodeACGroup node={node} ancestors={ancestors} defaultOpen />
            )}
          </div>
        </ScrollArea>
      );
    }
  }

  // Artifact selected → prompt to select a node
  if (selectedItem?.type === "artifact") {
    return <TestsPaneEmpty message="Select a story or group to view acceptance criteria." />;
  }

  // No selection → show all ACs grouped by tree
  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {wsCtx.tree.map((node) =>
          node.children.length === 0 ? (
            <StoryACGroup key={node.id} node={node} ancestors={[]} />
          ) : (
            <NodeACGroup key={node.id} node={node} ancestors={[]} />
          ),
        )}
      </div>
    </ScrollArea>
  );
}
