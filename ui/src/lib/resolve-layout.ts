import type {
  ViewPresetLayout,
  LayoutOverrides,
  ResolvedLayout,
  SidebarSection,
  NavItemId,
} from "@mnm/shared";
import { NAV_ITEM_REGISTRY } from "./nav-registry";

/** Merge preset layout + user overrides + permission filter → final resolved layout */
export function resolveLayout(
  base: ViewPresetLayout,
  overrides: LayoutOverrides | null,
  hasPermission: (key: string) => boolean,
): ResolvedLayout {
  let landingPage = base.landingPage;
  let sections = base.sidebar.sections;
  let showProjects = base.sidebar.showProjects ?? true;
  let showAgents = base.sidebar.showAgents ?? true;
  let widgets = base.dashboard.widgets;

  // Step 1: Apply user overrides (sparse merge)
  if (overrides) {
    if (overrides.landingPage) landingPage = overrides.landingPage;

    if (overrides.sidebar?.hiddenItems) {
      const hidden = new Set(overrides.sidebar.hiddenItems);
      sections = sections.map((s) => ({
        ...s,
        items: s.items.filter((id) => !hidden.has(id)),
      }));
    }

    if (overrides.sidebar?.pinnedItems) {
      const pinned = overrides.sidebar.pinnedItems;
      const pinnedSet = new Set(pinned);
      // Remove pinned items from their original sections
      sections = sections.map((s) => ({
        ...s,
        items: s.items.filter((id) => !pinnedSet.has(id)),
      }));
      // Prepend pinned items to the first section
      if (sections.length > 0) {
        sections = [
          { ...sections[0], items: [...pinned, ...sections[0].items] },
          ...sections.slice(1),
        ];
      }
    }

    if (overrides.sidebar?.sectionOrder) {
      const order = overrides.sidebar.sectionOrder;
      sections = [...sections].sort((a, b) => {
        const ia = order.indexOf(a.label);
        const ib = order.indexOf(b.label);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    }

    if (overrides.dashboard?.hiddenWidgets) {
      const hidden = new Set(overrides.dashboard.hiddenWidgets);
      widgets = widgets.filter((w) => !hidden.has(w.type));
    }

    if (overrides.dashboard?.extraWidgets) {
      widgets = [...widgets, ...overrides.dashboard.extraWidgets];
    }
  }

  // Step 2: Permission filter — remove items the user can't access
  sections = filterByPermission(sections, hasPermission);

  // Step 3: Remove empty sections
  sections = sections.filter((s) => s.items.length > 0);

  // Step 4: Validate landing page is accessible
  if (!isRouteAccessible(landingPage, hasPermission)) {
    landingPage = findFirstAccessibleRoute(sections) ?? "/dashboard";
  }

  return {
    landingPage,
    sidebar: { sections, showProjects, showAgents },
    dashboard: { widgets },
  };
}

function filterByPermission(
  sections: SidebarSection[],
  hasPermission: (key: string) => boolean,
): SidebarSection[] {
  return sections.map((section) => ({
    ...section,
    items: section.items.filter((itemId) => {
      const def = NAV_ITEM_REGISTRY[itemId];
      if (!def) return false;
      return hasPermission(def.permission);
    }),
  }));
}

function isRouteAccessible(route: string, hasPermission: (key: string) => boolean): boolean {
  const entry = Object.values(NAV_ITEM_REGISTRY).find((def) => def.to === route);
  if (!entry) return true; // Unknown routes are accessible
  return hasPermission(entry.permission);
}

function findFirstAccessibleRoute(sections: SidebarSection[]): string | null {
  for (const section of sections) {
    for (const itemId of section.items) {
      const def = NAV_ITEM_REGISTRY[itemId as NavItemId];
      if (def) return def.to;
    }
  }
  return null;
}
