import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquare, AlertTriangle, GitFork, Loader2 } from "lucide-react";
import { useParams, useNavigate } from "../lib/router";
import { useCompany } from "../context/CompanyContext";
import { chatSharingApi } from "../api/chat-sharing";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { MessageBubble } from "../components/chat/MessageBubble";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function SharedChat() {
  const { token } = useParams<{ token: string }>();
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();

  const [forkOpen, setForkOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("");

  const sharedChatQuery = useQuery({
    queryKey: queryKeys.chatSharing.shared(selectedCompanyId!, token!),
    queryFn: () => chatSharingApi.getSharedChat(selectedCompanyId!, token!),
    enabled: !!selectedCompanyId && !!token,
    retry: false,
  });

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: forkOpen && !!selectedCompanyId,
  });

  const forkMutation = useMutation({
    mutationFn: () =>
      chatSharingApi.forkChat(selectedCompanyId!, token!, selectedAgentId),
    onSuccess: (result) => {
      setForkOpen(false);
      if (result?.channelId) {
        navigate(`/chat`);
      }
    },
  });

  // Error state (expired, revoked, not found)
  if (sharedChatQuery.error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-muted/50 rounded-full p-5 mb-5">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <h3 className="text-sm font-medium mb-1">Share unavailable</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          This shared chat link is expired, revoked, or does not exist.
        </p>
      </div>
    );
  }

  // Loading state
  if (sharedChatQuery.isLoading || !sharedChatQuery.data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { channel, messages, share } = sharedChatQuery.data;
  const canFork = share.permission === "comment" || share.permission === "edit";
  const agents = Array.isArray(agentsQuery.data) ? agentsQuery.data : (agentsQuery.data as any)?.agents ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">
              {channel?.name ?? "Shared Chat"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Shared link · {share.permission} access
            </p>
          </div>
        </div>

        {canFork && (
          <Button size="sm" variant="outline" onClick={() => setForkOpen(true)}>
            <GitFork className="h-3.5 w-3.5 mr-1" />
            Continue this conversation
          </Button>
        )}
      </div>

      {/* Messages (read-only) */}
      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto py-3 space-y-1">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No messages in this conversation
              </p>
            </div>
          )}
          {messages.map((msg: any) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      </div>

      {/* Fork dialog */}
      <Dialog open={forkOpen} onOpenChange={setForkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Fork Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Select an agent to continue this conversation with. A new chat
              channel will be created with the existing messages as context.
            </p>
            <div className="space-y-1.5">
              <Label>Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => forkMutation.mutate()}
              disabled={!selectedAgentId || forkMutation.isPending}
            >
              {forkMutation.isPending ? "Forking..." : "Fork"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
