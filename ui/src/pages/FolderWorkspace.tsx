import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useParams, useNavigate } from "../lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { foldersApi } from "../api/folders";
import { documentsApi } from "../api/documents";
import { agentsApi } from "../api/agents";
import { chatApi } from "../api/chat";
import { queryKeys } from "../lib/queryKeys";
import { useDocumentViewer } from "../components/ui/document-viewer";
import type { FolderItem } from "@mnm/shared";
import { FolderSidebar } from "../components/folders/FolderSidebar";
import { AgentChatPanel } from "../components/AgentChatPanel";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";

export function FolderWorkspace() {
  const { folderId, channelId } = useParams<{
    folderId: string;
    channelId: string;
  }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isDragging = useRef(false);
  const { openDocument } = useDocumentViewer();

  // Drag-to-resize handler (same pattern as artifact panel)
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const startX = e.clientX;
      const startWidth = sidebarWidth;
      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = ev.clientX - startX;
        const newWidth = Math.max(200, Math.min(500, startWidth + delta));
        setSidebarWidth(newWidth);
      };
      const onUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [sidebarWidth],
  );

  const handleDocumentClick = useCallback(
    async (item: FolderItem) => {
      if (!item.documentId || !selectedCompanyId) return;
      try {
        const doc = await documentsApi.getById(selectedCompanyId, item.documentId);
        openDocument({
          id: doc.id,
          title: doc.title,
          mimeType: doc.mimeType,
          url: documentsApi.getContentUrl(selectedCompanyId, doc.id),
        });
      } catch (err) {
        console.error("Failed to load document:", err);
      }
    },
    [selectedCompanyId, openDocument],
  );

  // Remove parent padding for full-bleed layout
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    const prev = {
      padding: main.style.padding,
      overflow: main.style.overflow,
      position: main.style.position,
    };
    main.style.padding = "0";
    main.style.overflow = "hidden";
    main.style.position = "relative";
    return () => {
      main.style.padding = prev.padding;
      main.style.overflow = prev.overflow;
      main.style.position = prev.position;
    };
  }, []);

  const folderQuery = useQuery({
    queryKey: queryKeys.folders.detail(selectedCompanyId!, folderId!),
    queryFn: () => foldersApi.getById(selectedCompanyId!, folderId!),
    enabled: !!selectedCompanyId && !!folderId,
  });

  const channelQuery = useQuery({
    queryKey: queryKeys.chat.detail(selectedCompanyId!, channelId!),
    queryFn: () => chatApi.getChannel(selectedCompanyId!, channelId!),
    enabled: !!selectedCompanyId && !!channelId,
  });

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentName = useMemo(() => {
    if (!channelQuery.data) return "Agent";
    return (
      agentsQuery.data?.find((a) => a.id === channelQuery.data.agentId)
        ?.name ?? "Agent"
    );
  }, [channelQuery.data, agentsQuery.data]);

  useEffect(() => {
    if (folderQuery.data) {
      setBreadcrumbs([
        { label: "Folders", href: "/folders" },
        { label: folderQuery.data.name, href: `/folders/${folderId}` },
        { label: "Chat" },
      ]);
    }
    return () => setBreadcrumbs([]);
  }, [folderQuery.data, folderId, setBreadcrumbs]);

  if (folderQuery.isLoading || channelQuery.isLoading) {
    return <PageSkeleton />;
  }

  if (!folderQuery.data || !channelQuery.data) {
    return (
      <p className="p-6 text-sm text-destructive">
        Folder or chat not found.
      </p>
    );
  }

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* Left: Folder sidebar (resizable + collapsible) */}
      {!sidebarCollapsed && (
        <>
          <div
            className="shrink-0 h-full overflow-hidden"
            style={{ width: sidebarWidth }}
          >
            <FolderSidebar
              companyId={selectedCompanyId!}
              folder={folderQuery.data}
              onBack={() => navigate(`/folders/${folderId}`)}
              onCollapse={() => setSidebarCollapsed(true)}
              onDocumentClick={handleDocumentClick}
            />
          </div>
          {/* Resize handle */}
          <div
            className="w-1 shrink-0 bg-border hover:bg-primary/30 cursor-col-resize transition-colors"
            onMouseDown={handleDragStart}
          />
        </>
      )}

      {/* Collapse toggle (shown when sidebar is hidden) */}
      {sidebarCollapsed && (
        <div className="shrink-0 flex items-start pt-2 pl-1 border-r border-border bg-background">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Show folder sidebar"
            onClick={() => setSidebarCollapsed(false)}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Center + Right: Chat with artifact panel */}
      <div className="flex-1 relative">
        <AgentChatPanel
          channel={channelQuery.data}
          agentName={agentName}
          onBack={() => navigate(`/folders/${folderId}`)}
        />
      </div>
    </div>
  );
}
