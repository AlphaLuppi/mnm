import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "../lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { foldersApi } from "../api/folders";
import { agentsApi } from "../api/agents";
import { chatApi } from "../api/chat";
import { queryKeys } from "../lib/queryKeys";
import { FolderSidebar } from "../components/folders/FolderSidebar";
import { AgentChatPanel } from "../components/AgentChatPanel";
import { PageSkeleton } from "../components/PageSkeleton";

export function FolderWorkspace() {
  const { folderId, channelId } = useParams<{
    folderId: string;
    channelId: string;
  }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

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
      {/* Left: Folder sidebar */}
      <div className="w-72 shrink-0">
        <FolderSidebar
          companyId={selectedCompanyId!}
          folder={folderQuery.data}
          onBack={() => navigate(`/folders/${folderId}`)}
        />
      </div>

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
