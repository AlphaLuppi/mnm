import {
  Search,
  SquarePen,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarAgents } from "./SidebarAgents";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useSidebar } from "../context/SidebarContext";
import { usePermissions } from "../hooks/usePermissions";
import { useViewPreset } from "../hooks/useViewPreset";
import { sidebarBadgesApi } from "../api/sidebarBadges";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { NAV_ITEM_REGISTRY } from "../lib/nav-registry";
import type { NavItemId } from "@mnm/shared";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";

export function Sidebar() {
  const { openNewIssue } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { sidebarCollapsed } = useSidebar();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { layout } = useViewPreset();
  const { data: sidebarBadges } = useQuery({
    queryKey: queryKeys.sidebarBadges(selectedCompanyId!),
    queryFn: () => sidebarBadgesApi.get(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const liveRunCount = liveRuns?.length ?? 0;

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  const canCreateIssue = hasPermission("issues:create");

  const sidebarWidth = sidebarCollapsed ? "w-14" : "w-60";

  if (permissionsLoading) {
    return (
      <aside
        data-testid="mu-s04-sidebar"
        className={cn(sidebarWidth, "h-full min-h-0 border-r border-border bg-background flex flex-col")}
      >
        <div className="flex items-center gap-1 px-3 h-12 shrink-0">
          {!sidebarCollapsed && (
            <span
              data-testid="rbac-s05-permissions-loading"
              className="flex-1 text-sm text-muted-foreground pl-1"
            >
              Loading...
            </span>
          )}
        </div>
      </aside>
    );
  }

  /** Render a nav item with its badges and live counts */
  function renderNavItem(itemId: NavItemId) {
    const def = NAV_ITEM_REGISTRY[itemId];
    if (!def) return null;

    // Special badge logic for specific items
    const extraProps: Record<string, unknown> = {};
    if (itemId === "dashboard") {
      extraProps.liveCount = liveRunCount;
    }
    if (itemId === "inbox") {
      extraProps.badge = sidebarBadges?.inbox;
      extraProps.badgeTone = sidebarBadges?.failedRuns ? "danger" : "default";
      extraProps.alert = (sidebarBadges?.failedRuns ?? 0) > 0;
    }

    return (
      <SidebarNavItem
        key={itemId}
        to={def.to}
        label={def.label}
        icon={def.icon}
        {...extraProps}
      />
    );
  }

  return (
    <aside data-testid="mu-s04-sidebar" className={cn(sidebarWidth, "h-full min-h-0 border-r border-border bg-background flex flex-col")}>
      {/* Top bar: Company name (bold) + Search */}
      <div className={cn("flex items-center h-12 shrink-0", sidebarCollapsed ? "justify-center px-1" : "gap-1 px-3")}>
        {selectedCompany?.brandColor && (
          <div
            data-testid="mu-s04-sidebar-brand-color"
            className="w-4 h-4 rounded-sm shrink-0 ml-1"
            style={{ backgroundColor: selectedCompany.brandColor }}
          />
        )}
        {!sidebarCollapsed && (
          <span data-testid="mu-s04-sidebar-company-name" className="flex-1 text-sm font-bold text-foreground truncate pl-1">
            {selectedCompany?.name ?? "Select company"}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={openSearch}
          title="Search"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <nav className={cn("flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 py-2", sidebarCollapsed ? "px-1" : "px-3")}>
        {layout.sidebar.sections.map((section, sectionIdx) => {
          if (section.items.length === 0) return null;

          // Dynamic section: __projects__
          if (section.items.includes("__projects__" as never)) {
            return !sidebarCollapsed ? <SidebarProjects key={`section-${sectionIdx}`} /> : null;
          }

          // Dynamic section: __agents__
          if (section.items.includes("__agents__" as never)) {
            return !sidebarCollapsed ? <SidebarAgents key={`section-${sectionIdx}`} /> : null;
          }

          // Unlabeled section (top-level items like Dashboard, Inbox)
          if (!section.label) {
            return (
              <div key={`section-${sectionIdx}`} className="flex flex-col gap-0.5">
                {canCreateIssue && (
                  <button
                    data-testid="rbac-s05-nav-new-issue"
                    onClick={() => openNewIssue()}
                    title={sidebarCollapsed ? "New Issue" : undefined}
                    className={cn(
                      "flex items-center text-[13px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors",
                      sidebarCollapsed ? "justify-center px-2 py-2" : "gap-2.5 px-3 py-2",
                    )}
                  >
                    <SquarePen className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">New Issue</span>}
                  </button>
                )}
                {section.items.map((itemId) => renderNavItem(itemId))}
              </div>
            );
          }

          // Labeled section
          return (
            <SidebarSection key={section.label} label={section.label}>
              {section.items.map((itemId) => renderNavItem(itemId))}
            </SidebarSection>
          );
        })}

        {/* Backward compat: legacy showProjects/showAgents if no __projects__/__agents__ in sections */}
        {!sidebarCollapsed && layout.sidebar.showProjects && !layout.sidebar.sections.some(s => s.items.includes("__projects__" as never)) && <SidebarProjects />}
        {!sidebarCollapsed && layout.sidebar.showAgents && !layout.sidebar.sections.some(s => s.items.includes("__agents__" as never)) && <SidebarAgents />}
      </nav>
    </aside>
  );
}
