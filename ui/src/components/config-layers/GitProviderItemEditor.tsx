import { useState } from "react";
import type { ConfigLayerItem } from "@mnm/shared";
import { detectGitProvider } from "@mnm/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitProviderIcon } from "../GitProviderIcon";

type Props = {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
};

export function GitProviderItemEditor({ item, onSave, onCancel }: Props) {
  const existing = item?.configJson as { host?: string; providerType?: string } | undefined;
  const [hostInput, setHostInput] = useState(existing?.host ?? "");

  const detected = hostInput.trim() ? detectGitProvider(hostInput.trim()) : null;

  function handleSave() {
    if (!detected) return;
    onSave({
      name: detected.host,
      host: detected.host,
      providerType: detected.providerType,
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="space-y-1.5">
        <Label>URL du repo ou hostname</Label>
        <Input
          value={hostInput}
          onChange={(e) => setHostInput(e.target.value)}
          placeholder="github.com ou https://github.com/org/repo"
          autoFocus
        />
      </div>

      {detected && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitProviderIcon provider={detected.providerType} className="h-4 w-4" />
          <span>{detected.label}</span>
          <span className="font-mono text-xs">{detected.host}</span>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Annuler
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!detected}>
          Sauvegarder
        </Button>
      </div>
    </div>
  );
}
