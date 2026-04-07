import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Box, Folder, MessageSquare, Plus, X } from "lucide-react";
import type { ChatContextLink, ContextLinkType } from "@mnm/shared";
import { Button } from "@/components/ui/button";
import { chatSharingApi } from "../../api/chat-sharing";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";

interface ContextLinkBarProps {
  companyId: string;
  channelId: string;
  onArtifactClick?: (artifactId: string) => void;
  onDocumentClick?: (documentId: string) => void;
}

const LINK_TYPE_CONFIG: Record<
  ContextLinkType,
  { icon: typeof FileText; label: string; color: string }
> = {
  document: {
    icon: FileText,
    label: "Doc",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  artifact: {
    icon: Box,
    label: "Artifact",
    color:
      "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
  folder: {
    icon: Folder,
    label: "Folder",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  channel: {
    icon: MessageSquare,
    label: "Chat",
    color:
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
};

export function ContextLinkBar({
  companyId,
  channelId,
  onArtifactClick,
  onDocumentClick,
}: ContextLinkBarProps) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: queryKeys.chatSharing.contextLinks(companyId, channelId),
    queryFn: () => chatSharingApi.getContextLinks(companyId, channelId),
    enabled: !!companyId && !!channelId,
  });
  const links: ChatContextLink[] = data?.links ?? [];

  const removeMutation = useMutation({
    mutationFn: (linkId: string) =>
      chatSharingApi.removeContextLink(companyId, channelId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatSharing.contextLinks(companyId, channelId),
      });
    },
  });

  const handleChipClick = (link: ChatContextLink) => {
    if (link.linkType === "document" && link.documentId && onDocumentClick) {
      onDocumentClick(link.documentId);
      return;
    }
    if (link.linkType === "artifact" && link.artifactId && onArtifactClick) {
      onArtifactClick(link.artifactId);
    }
  };

  if (links.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5 overflow-x-auto">
      <span className="text-[10px] text-muted-foreground shrink-0">
        Context:
      </span>
      {links.map((link) => {
        const config = LINK_TYPE_CONFIG[link.linkType];
        const Icon = config.icon;
        return (
          <div
            key={link.id}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 cursor-pointer hover:opacity-80 transition-opacity",
              config.color,
            )}
            onClick={() => handleChipClick(link)}
          >
            <Icon className="h-2.5 w-2.5" />
            <span>{config.label}</span>
            <button
              type="button"
              className="ml-0.5 hover:opacity-60"
              onClick={(e) => {
                e.stopPropagation();
                removeMutation.mutate(link.id);
              }}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-5 w-5 shrink-0"
        title="Add context"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
