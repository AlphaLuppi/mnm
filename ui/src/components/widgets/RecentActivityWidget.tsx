import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../../api/activity";
import { agentsApi } from "../../api/agents";
import { issuesApi } from "../../api/issues";
import { projectsApi } from "../../api/projects";
import { queryKeys } from "../../lib/queryKeys";
import { ActivityRow } from "../ActivityRow";
import type { WidgetProps } from "./types";

export default function RecentActivityWidget({ companyId }: WidgetProps) {
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const { data: activity } = useQuery({
    queryKey: queryKeys.activity(companyId),
    queryFn: () => activityApi.list(companyId),
    enabled: !!companyId,
  });
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });
  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId),
    enabled: !!companyId,
  });
  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(companyId),
    queryFn: () => projectsApi.list(companyId),
    enabled: !!companyId,
  });

  const recentActivity = useMemo(() => (activity ?? []).slice(0, 10), [activity]);

  const agentMap = useMemo(() => {
    const map = new Map<string, (typeof agents extends (infer A)[] | undefined ? A : never)>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  useEffect(() => {
    if (recentActivity.length === 0) return;
    const seen = seenIdsRef.current;
    const currentIds = recentActivity.map((e) => e.id);
    if (!hydratedRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedRef.current = true;
      return;
    }
    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }
    setAnimatedIds((prev) => { const next = new Set(prev); for (const id of newIds) next.add(id); return next; });
    for (const id of newIds) seen.add(id);
    const timer = window.setTimeout(() => {
      setAnimatedIds((prev) => { const next = new Set(prev); for (const id of newIds) next.delete(id); return next; });
    }, 980);
    timersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => () => { for (const t of timersRef.current) window.clearTimeout(t); }, []);

  if (recentActivity.length === 0) return null;

  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent Activity</h3>
      <div className="border border-border divide-y divide-border overflow-hidden">
        {recentActivity.map((event) => (
          <ActivityRow
            key={event.id}
            event={event}
            agentMap={agentMap}
            entityNameMap={entityNameMap}
            entityTitleMap={entityTitleMap}
            className={animatedIds.has(event.id) ? "activity-row-enter" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
