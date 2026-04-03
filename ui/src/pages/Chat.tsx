import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Loader2, Plus, Bot } from "lucide-react";
import { chatApi, type ChatChannel } from "../api/chat";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { useParams, useNavigate } from "../lib/router";
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
  const { channelId } = useParams<{ channelId?: string }>();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{ agentId: string; name: string }>({ agentId: "", name: "" });

  useEffect(() => {
    setBreadcrumbs([{ label: "Chat" }]);
  }, [setBreadcrumbs]);

  // Remove parent <main> padding and overflow for full-bleed chat layout
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
      navigate(`/chat/${newChannel.id}`);
    },
  });

  const channels = useMemo(
    () => channelsQuery.data?.channels ?? [],
    [channelsQuery.data],
  );

  // Fetch individual channel when channelId is in URL (supports F5 refresh)
  const channelDetailQuery = useQuery({
    queryKey: queryKeys.chat.detail(selectedCompanyId!, channelId!),
    queryFn: () => chatApi.getChannel(selectedCompanyId!, channelId!),
    enabled: !!selectedCompanyId && !!channelId,
  });

  // Resolve selected channel: prefer from already-loaded list, fallback to detail query
  const selectedChannel: ChatChannel | null = useMemo(() => {
    if (!channelId) return null;
    const fromList = channels.find((c) => c.id === channelId);
    if (fromList) return fromList;
    return channelDetailQuery.data ?? null;
  }, [channelId, channels, channelDetailQuery.data]);

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

  // Channel detail loading (URL has channelId but data not yet resolved)
  if (channelId && !selectedChannel && channelDetailQuery.isLoading) {
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

  // When a channel is selected, show full-page chat. Otherwise show channel list.
  return (
    <div className="absolute inset-0 overflow-hidden" data-testid="chat-s04-page">
      {selectedChannel ? (
        /* ── Full-page chat ── */
        <AgentChatPanel
          channel={selectedChannel}
          agentName={resolveAgentName(selectedChannel.agentId)}
          onBack={() => navigate("/chat")}
        />
      ) : (
        /* ── Channel list (full page when no chat selected) ── */
        <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
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
              {channelsQuery.isFetching && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Chat
            </Button>
          </div>

          {/* Filter */}
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
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setStatusFilter("")}>
                Clear
              </Button>
            )}
          </div>

          {/* Channel list */}
          {channels.length === 0 ? (
            <div data-testid="chat-s04-empty-channels" className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-muted/50 rounded-full p-6 mb-5">
                <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
              </div>
              <h2 className="text-lg font-medium mb-1">No conversations yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Start a conversation with one of your agents.
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>
          ) : (
            <div data-testid="chat-s04-channel-list" className="border border-border rounded-lg overflow-hidden divide-y divide-border">
              {channels.map((channel) => {
                const displayName = resolveChannelDisplayName(channel);
                const agentDisplayName = resolveAgentName(channel.agentId);
                return (
                  <button
                    key={channel.id}
                    type="button"
                    data-testid="chat-s04-channel-item"
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
                    onClick={() => navigate(`/chat/${channel.id}`)}
                  >
                    <div className="bg-muted rounded-full p-2 shrink-0">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{displayName}</span>
                        <Badge variant={channel.status === "open" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {channel.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {agentDisplayName}
                        {channel.lastMessageAt && ` · ${timeAgo(channel.lastMessageAt)}`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

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
