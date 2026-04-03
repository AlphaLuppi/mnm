import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Trash2, Check } from "lucide-react";
import { chatSharingApi } from "../../api/chat-sharing";
import { queryKeys } from "../../lib/queryKeys";
import { timeAgo } from "../../lib/timeAgo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "../../lib/utils";

interface ChatShareDialogProps {
  companyId: string;
  channelId: string;
  open: boolean;
  onClose: () => void;
}

type PermissionOption = "read" | "comment";

export function ChatShareDialog({
  companyId,
  channelId,
  open,
  onClose,
}: ChatShareDialogProps) {
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<PermissionOption>("read");
  const [expiresAt, setExpiresAt] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sharesQuery = useQuery({
    queryKey: queryKeys.chatSharing.shares(companyId, channelId),
    queryFn: () => chatSharingApi.listShares(companyId, channelId),
    enabled: open && !!companyId && !!channelId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      chatSharingApi.createShare(companyId, channelId, {
        permission,
        expiresAt: expiresAt || undefined,
      }),
    onSuccess: (share) => {
      const url = `${window.location.origin}/shared/chat/${share.shareToken}`;
      setGeneratedUrl(url);
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatSharing.shares(companyId, channelId),
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (shareId: string) => chatSharingApi.revokeShare(companyId, shareId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatSharing.shares(companyId, channelId),
      });
    },
  });

  function handleCopy() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setGeneratedUrl(null);
    setCopied(false);
    setPermission("read");
    setExpiresAt("");
    onClose();
  }

  const activeShares = (sharesQuery.data ?? []).filter((s) => !s.revokedAt);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Chat</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Permission selector */}
          <div className="space-y-1.5">
            <Label>Permission</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setPermission("read")}
                className={cn(
                  "flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors",
                  permission === "read"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                Read Only
              </button>
              <button
                onClick={() => setPermission("comment")}
                className={cn(
                  "flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors",
                  permission === "comment"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                Read + Fork
              </button>
            </div>
          </div>

          {/* Expiration date */}
          <div className="space-y-1.5">
            <Label htmlFor="share-expires">Expiration (optional)</Label>
            <Input
              id="share-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Generated link */}
          {generatedUrl && (
            <div className="space-y-1.5">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={generatedUrl}
                  className="h-9 text-xs font-mono"
                />
                <Button variant="outline" size="sm" className="shrink-0 h-9" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}

          {/* Existing shares */}
          {activeShares.length > 0 && (
            <div className="space-y-1.5">
              <Label>Active Shares</Label>
              <div className="border border-border rounded-lg overflow-hidden">
                {activeShares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center gap-2 border-b border-border last:border-0 px-3 py-2"
                  >
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono truncate block">
                        ...{share.shareToken.slice(-8)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {share.permission} · {timeAgo(share.createdAt)}
                        {share.expiresAt && ` · expires ${new Date(share.expiresAt).toLocaleDateString()}`}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Revoke share"
                      disabled={revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(share.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Generating..." : "Generate Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
