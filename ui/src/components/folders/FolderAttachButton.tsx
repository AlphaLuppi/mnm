import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, ChevronDown } from "lucide-react";
import { foldersApi } from "../../api/folders";
import { queryKeys } from "../../lib/queryKeys";
import { chatApi } from "../../api/chat";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FolderAttachButtonProps {
  companyId: string;
  channelId: string;
}

export function FolderAttachButton({ companyId, channelId }: FolderAttachButtonProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: queryKeys.folders.list(companyId),
    queryFn: () => foldersApi.list(companyId),
    enabled: open && !!companyId,
  });

  const attachMutation = useMutation({
    mutationFn: (folderId: string) =>
      foldersApi.addItem(companyId, folderId, {
        itemType: "channel",
        channelId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.list(companyId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.detail(companyId, channelId),
      });
      setOpen(false);
    },
  });

  const folders = data?.folders ?? [];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <FolderOpen className="h-3.5 w-3.5" />
          Save to Folder
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {folders.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            No folders available
          </div>
        )}
        {folders.map((folder) => (
          <DropdownMenuItem
            key={folder.id}
            onClick={() => attachMutation.mutate(folder.id)}
            disabled={attachMutation.isPending}
          >
            {folder.icon ? (
              <span className="mr-2 text-sm">{folder.icon}</span>
            ) : (
              <FolderOpen className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="truncate">{folder.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
