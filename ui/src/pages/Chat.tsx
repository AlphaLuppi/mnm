import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Loader2 } from "lucide-react";
import { chatApi, type ChatChannel } from "../api/chat";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { AgentChatPanel } from "../components/AgentChatPanel";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// chat-s04-page
export function Chat() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Chat" }]);
  }, [setBreadcrumbs]);

  const channelsQuery = useQuery({
    queryKey: queryKeys.chat.channels(selectedCompanyId!, {
      status: statusFilter || undefined,
    }),
    queryFn: () =>
      chatApi.listChannels(selectedCompanyId!, {
        status: statusFilter || undefined,
        sortBy: "lastMessageAt",
      }),
    enabled: !!selectedCompanyId,
  });

  const channels = useMemo(
    () => channelsQuery.data?.channels ?? [],
    [channelsQuery.data],
  );

  const openCount = useMemo(
    () => channels.filter((c) => c.status === "open").length,
    [channels],
  );

  // Loading state
  if (channelsQuery.isLoading && !channelsQuery.data) {
    return (
      <div data-testid="chat-s04-loading">
        <PageSkeleton />
      </div>
    );
  }

  // Error state
  if (channelsQuery.error && !channelsQuery.data) {
    return (
      <div
        data-testid="chat-s04-error"
        className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-6 text-sm text-red-700 dark:text-red-300"
      >
        Failed to load chat channels. Please try again.
      </div>
    );
  }

  return (
    <div className="flex h-full" data-testid="chat-s04-page">
      {/* Channel list */}
      <div className="flex-1 space-y-4 overflow-auto p-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <h1 data-testid="chat-s04-title" className="text-lg font-semibold">
              Chat
            </h1>
            {openCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {openCount} open
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {channelsQuery.isFetching && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          {statusFilter && statusFilter !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => setStatusFilter("")}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Empty state */}
        {channels.length === 0 && (
          <div
            data-testid="chat-s04-empty-channels"
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="bg-muted/50 rounded-full p-5 mb-5">
              <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-sm font-medium mb-1">No chat channels</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {statusFilter && statusFilter !== "all"
                ? `No channels with status "${statusFilter}". Try clearing the filter.`
                : "Chat channels will appear here when agents are started. Use the Agents page to launch an agent with chat enabled."}
            </p>
          </div>
        )}

        {/* Channel list */}
        {channels.length > 0 && (
          <div data-testid="chat-s04-channel-list" className="space-y-1">
            {channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                data-testid="chat-s04-channel-item"
                className={`w-full text-left rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50 ${
                  selectedChannel?.id === channel.id
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
                onClick={() => setSelectedChannel(channel)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    data-testid="chat-s04-channel-name"
                    className="text-sm font-medium truncate"
                  >
                    {channel.name ?? `Channel ${channel.id.slice(0, 8)}`}
                  </span>
                  <Badge
                    data-testid="chat-s04-channel-status"
                    variant={channel.status === "open" ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {channel.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span data-testid="chat-s04-channel-agent" className="truncate">
                    Agent: {channel.agentId.slice(0, 8)}
                  </span>
                  <span data-testid="chat-s04-channel-last-msg">
                    {channel.lastMessageAt
                      ? timeAgo(channel.lastMessageAt)
                      : "No messages"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat panel */}
      {selectedChannel && (
        <AgentChatPanel
          channel={selectedChannel}
          onClose={() => setSelectedChannel(null)}
        />
      )}
    </div>
  );
}
