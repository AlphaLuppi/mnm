import {
  Inbox,
  CircleDot,
  Target,
  Workflow,
  LayoutDashboard,
  DollarSign,
  History,
  ScrollText,
  Search,
  SquarePen,
  Network,
  Settings,
  Shield,
  Users,
  Box,
  MessageSquare,
  SlidersHorizontal,
  KeyRound,
  Upload,
  PenTool,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarAgents } from "./SidebarAgents";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { usePermissions } from "../hooks/usePermissions";
import { sidebarBadgesApi } from "../api/sidebarBadges";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const { openNewIssue } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { data: sidebarBadges } = useQuery({
    queryKey: queryKeys.sidebarBadges(selectedCompanyId!),
    queryFn: () => sidebarBadgesApi.get(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const liveRunCount = liveRuns?.length ?? 0;

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  // Permission checks for sidebar items
  const canCreateIssue = hasPermission("stories:create");
  const canViewWorkflows = hasPermission("workflows:create");
  const canViewGoals = hasPermission("projects:create");
  const canViewMembers = hasPermission("users:invite");
  const canViewCosts = hasPermission("dashboard:view");
  const canViewActivity = hasPermission("audit:read");
  const canViewRoles = hasPermission("users:manage_permissions");
  const canViewSettings = hasPermission("company:manage_settings");
  const canViewContainers = hasPermission("agents:manage_containers");
  const canViewChat = hasPermission("chat:agent");
  const canViewCursors = hasPermission("workflows:enforce");
  const canViewSso = hasPermission("company:manage_sso");
  const canViewImport = hasPermission("projects:manage");

  // Section visibility: "Work" visible if at least one child is visible
  // Issues is always visible, so Work section is always visible
  const showWorkSection = true;

  // "Company" section visible if at least one child is visible
  // Org is always visible, so Company section is always visible
  const showCompanySection = true;

  if (permissionsLoading) {
    return (
      <aside
        data-testid="mu-s04-sidebar"
        className="w-60 h-full min-h-0 border-r border-border bg-background flex flex-col"
      >
        <div className="flex items-center gap-1 px-3 h-12 shrink-0">
          <span
            data-testid="rbac-s05-permissions-loading"
            className="flex-1 text-sm text-muted-foreground pl-1"
          >
            Loading...
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside data-testid="mu-s04-sidebar" className="w-60 h-full min-h-0 border-r border-border bg-background flex flex-col">
      {/* Top bar: Company name (bold) + Search */}
      <div className="flex items-center gap-1 px-3 h-12 shrink-0">
        {selectedCompany?.brandColor && (
          <div
            data-testid="mu-s04-sidebar-brand-color"
            className="w-4 h-4 rounded-sm shrink-0 ml-1"
            style={{ backgroundColor: selectedCompany.brandColor }}
          />
        )}
        <span data-testid="mu-s04-sidebar-company-name" className="flex-1 text-sm font-bold text-foreground truncate pl-1">
          {selectedCompany?.name ?? "Select company"}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          {/* New Issue button — hidden if no stories:create permission */}
          {canCreateIssue && (
            <button
              data-testid="rbac-s05-nav-new-issue"
              onClick={() => openNewIssue()}
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            >
              <SquarePen className="h-4 w-4 shrink-0" />
              <span className="truncate">New Issue</span>
            </button>
          )}
          <SidebarNavItem data-testid="rbac-s05-nav-dashboard" to="/dashboard" label="Dashboard" icon={LayoutDashboard} liveCount={liveRunCount} />
          <SidebarNavItem
            data-testid="rbac-s05-nav-inbox"
            to="/inbox"
            label="Inbox"
            icon={Inbox}
            badge={sidebarBadges?.inbox}
            badgeTone={sidebarBadges?.failedRuns ? "danger" : "default"}
            alert={(sidebarBadges?.failedRuns ?? 0) > 0}
          />
        </div>

        {showWorkSection && (
          <SidebarSection label="Work" data-testid="rbac-s05-section-work">
            <SidebarNavItem data-testid="rbac-s05-nav-issues" to="/issues" label="Issues" icon={CircleDot} />
            {canViewWorkflows && (
              <SidebarNavItem data-testid="rbac-s05-nav-workflows" to="/workflows" label="Workflows" icon={Workflow} />
            )}
            {canViewWorkflows && (
              <SidebarNavItem data-testid="orch-s05-nav-editor" to="/workflow-editor/new" label="Workflow Editor" icon={PenTool} />
            )}
            {canViewGoals && (
              <SidebarNavItem data-testid="rbac-s05-nav-goals" to="/goals" label="Goals" icon={Target} />
            )}
            {canViewChat && (
              <SidebarNavItem data-testid="chat-s04-nav-chat" to="/chat" label="Chat" icon={MessageSquare} />
            )}
            {canViewCursors && (
              <SidebarNavItem data-testid="dual-s02-nav-cursors" to="/automation-cursors" label="Cursors" icon={SlidersHorizontal} />
            )}
          </SidebarSection>
        )}

        <SidebarProjects />

        <SidebarAgents />

        {showCompanySection && (
          <SidebarSection label="Company" data-testid="rbac-s05-section-company">
            {canViewMembers && (
              <SidebarNavItem data-testid="rbac-s05-nav-members" to="/members" label="Members" icon={Users} />
            )}
            {canViewRoles && (
              <SidebarNavItem data-testid="rbac-s06-nav-roles" to="/admin/roles" label="Roles" icon={Shield} />
            )}
            <SidebarNavItem data-testid="rbac-s05-nav-org" to="/org" label="Org" icon={Network} />
            {canViewCosts && (
              <SidebarNavItem data-testid="rbac-s05-nav-costs" to="/costs" label="Costs" icon={DollarSign} />
            )}
            {canViewActivity && (
              <SidebarNavItem data-testid="rbac-s05-nav-activity" to="/activity" label="Activity" icon={History} />
            )}
            {canViewActivity && (
              <SidebarNavItem data-testid="obs-s04-nav-audit" to="/audit" label="Audit Log" icon={ScrollText} />
            )}
            {canViewContainers && (
              <SidebarNavItem data-testid="cont-s06-nav-containers" to="/containers" label="Containers" icon={Box} />
            )}
            {canViewSettings && (
              <SidebarNavItem data-testid="rbac-s05-nav-settings" to="/company/settings" label="Settings" icon={Settings} />
            )}
            {canViewSso && (
              <SidebarNavItem data-testid="sso-s03-nav-sso" to="/admin/sso" label="SSO" icon={KeyRound} />
            )}
            {canViewImport && (
              <SidebarNavItem data-testid="onb-s03-nav-import" to="/import/jira" label="Import Jira" icon={Upload} />
            )}
          </SidebarSection>
        )}
      </nav>
    </aside>
  );
}
