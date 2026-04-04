import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { configLayersApi } from "../../api/config-layers";
import { queryKeys } from "../../lib/queryKeys";

function parseEnvText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1);
    if (key) result[key] = value;
  }
  return result;
}

export function ApiKeyCredentialDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [envText, setEnvText] = useState("");

  const storeMutation = useMutation({
    mutationFn: () => {
      const env = parseEnvText(envText);
      return configLayersApi.storeApiKey(itemId, { env });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.configLayers.credentials(companyId),
      });
      setEnvText("");
      onOpenChange(false);
    },
  });

  const parsed = parseEnvText(envText);
  const keyCount = Object.keys(parsed).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Secret credentials — {itemName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            These values are stored encrypted (AES-256-GCM) and injected at
            runtime as environment variables. They override static env vars
            defined in the MCP server config.
          </p>
          <div className="space-y-1.5">
            <Label>
              Secret env vars{" "}
              <span className="text-muted-foreground font-normal">
                (KEY=value per line)
              </span>
            </Label>
            <Textarea
              value={envText}
              onChange={(e) => setEnvText(e.target.value)}
              placeholder={"APITOKEN=your-secret-token\nSECRET_KEY=abc123"}
              rows={5}
              className="font-mono text-sm"
              autoFocus
            />
          </div>
          {storeMutation.isError && (
            <p className="text-xs text-destructive">
              Failed to store credentials. Please try again.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => storeMutation.mutate()}
            disabled={keyCount === 0 || storeMutation.isPending}
          >
            {storeMutation.isPending
              ? "Encrypting…"
              : `Store ${keyCount} secret${keyCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
