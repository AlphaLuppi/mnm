import { projectRouteRef } from "./utils";

type CockpitView = "drift" | "stories" | "agents";

interface ProjectRef {
  id: string;
  urlKey?: string | null;
  name?: string | null;
}

/**
 * Build a cockpit URL for a project with optional query params
 * for pre-selecting a view or item.
 */
export function cockpitUrl(
  project: ProjectRef,
  options?: { view?: CockpitView; select?: string },
): string {
  const base = `/projects/${projectRouteRef(project)}/overview`;
  const params = new URLSearchParams();
  if (options?.view) params.set("view", options.view);
  if (options?.select) params.set("select", options.select);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Parse cockpit query params from a URL search string.
 */
export function parseCockpitParams(search: string): {
  view?: CockpitView;
  select?: string;
} {
  const params = new URLSearchParams(search);
  const view = params.get("view") as CockpitView | null;
  const select = params.get("select");
  return {
    ...(view ? { view } : {}),
    ...(select ? { select } : {}),
  };
}
