import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Loader2, Plus, Hash } from "lucide-react";
import { chatApi, type ChatChannel } from "../api/chat";
import { agentsApi } from "../api/agents";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";

// chat-s04-page
export function Chat() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{ agentId: string; name: string }>({ agentId: "", name: "" });

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

  // Always fetch agents for name resolution in channel sidebar
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agentsQuery.data ?? []) {
      map.set(agent.id, agent.name);
    }
    return map;
  }, [agentsQuery.data]);

  const createChannelMutation = useMutation({
    mutationFn: (input: { agentId: string; name?: string }) =>
      chatApi.createChannel(selectedCompanyId!, input),
    onSuccess: (newChannel) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.channels(selectedCompanyId!),
      });
      setCreateOpen(false);
      setCreateForm({ agentId: "", name: "" });
      setSelectedChannel(newChannel);
    },
  });

  const channels = useMemo(
    () => channelsQuery.data?.channels ?? [],
    [channelsQuery.data],
  );

  const openCount = useMemo(
    () => channels.filter((c) => c.status === "open").length,
    [channels],
  );

  function resolveChannelDisplayName(channel: ChatChannel): string {
    if (channel.name) return channel.name;
    const agentName = agentNameMap.get(channel.agentId);
    if (agentName) return agentName;
    return "Chat";
  }

  function resolveAgentName(agentId: string): string {
    return agentNameMap.get(agentId) ?? "Agent";
  }

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
        className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive"
      >
        Failed to load chat channels. Please try again.
      </div>
    );
  }

  return (
    <div className="flex h-full" data-testid="chat-s04-page">
      {/* ── Left sidebar: channel list ── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-border bg-muted/30 h-full">
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 h-12 shrink-0 border-b border-border">
          <div className="flex items-center gap-2">
            <h1 data-testid="chat-s04-title" className="text-sm font-semibold">
              Chat
            </h1>
            {openCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {openCount}
              </Badge>
            )}
            {channelsQuery.isFetching && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCreateOpen(true)}
            aria-label="New chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter bar */}
        <div className="px-2 py-2 shrink-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full h-7 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Channel list (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
          {channels.length === 0 ? (
            <div
              data-testid="chat-s04-empty-channels"
              className="flex flex-col items-center justify-center py-12 text-center px-2"
            >
              <div className="bg-muted/50 rounded-full p-3 mb-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground">
                {statusFilter && statusFilter !== "all"
                  ? `No ${statusFilter} channels.`
                  : "No channels yet."}
              </p>
            </div>
          ) : (
            <div data-testid="chat-s04-channel-list" className="space-y-0.5">
              {channels.map((channel) => {
                const isSelected = selectedChannel?.id === channel.id;
                const displayName = resolveChannelDisplayName(channel);
                const agentName = resolveAgentName(channel.agentId);

                return (
                  <button
                    key={channel.id}
                    type="button"
                    data-testid="chat-s04-channel-item"
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50 text-foreground",
                    )}
                    onClick={() => setSelectedChannel(channel)}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span
                        data-testid="chat-s04-channel-name"
                        className="text-sm font-medium truncate"
                      >
                        {displayName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pl-5.5 text-[11px] text-muted-foreground">
                      <span data-testid="chat-s04-channel-agent" className="truncate">
                        {agentName}
                      </span>
                      <span data-testid="chat-s04-channel-last-msg" className="shrink-0 ml-2">
                        {channel.lastMessageAt
                          ? timeAgo(channel.lastMessageAt)
                          : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Main area: chat or empty state ── */}
      <div className="flex-1 min-w-0 h-full">
        {selectedChannel ? (
          <AgentChatPanel
            channel={selectedChannel}
            agentName={resolveAgentName(selectedChannel.agentId)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="bg-muted/50 rounded-full p-6 mb-5">
              <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
            </div>
            <h2 className="text-lg font-medium text-foreground mb-1">
              Welcome to Chat
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Select a conversation from the sidebar or start a new one to chat with your agents.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
        )}
      </div>

      {/* New Chat dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Agent</Label>
              <Select
                value={createForm.agentId}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, agentId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agentsQuery.isLoading && (
                    <SelectItem value="__loading" disabled>
                      Loading agents...
                    </SelectItem>
                  )}
                  {(agentsQuery.data ?? [])
                    .filter((a) => a.status !== "terminated")
                    .map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chat-name">Name (optional)</Label>
              <Input
                id="chat-name"
                placeholder="e.g. Debug session"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createChannelMutation.mutate({
                  agentId: createForm.agentId,
                  name: createForm.name || undefined,
                })
              }
              disabled={!createForm.agentId || createChannelMutation.isPending}
            >
              {createChannelMutation.isPending ? "Starting..." : "Start Chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
