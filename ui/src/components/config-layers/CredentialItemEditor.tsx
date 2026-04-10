import { useState } from "react";
import type { ConfigLayerItem } from "@mnm/shared";
import { CREDENTIAL_TYPES } from "@mnm/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
};

const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  ssh_key: "SSH Key",
  access_token: "Access Token",
  api_key: "API Key",
  bearer_token: "Bearer Token",
  custom: "Custom",
};

export function CredentialItemEditor({ item, onSave, onCancel }: Props) {
  const existing = item?.configJson as {
    credentialType?: string;
    envVar?: string;
  } | undefined;

  const [name, setName] = useState(item?.name ?? "");
  const [credentialType, setCredentialType] = useState(
    existing?.credentialType ?? "custom",
  );
  const [envVar, setEnvVar] = useState(existing?.envVar ?? "");
  const [secretValue, setSecretValue] = useState("");

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave({
      name: trimmedName,
      credentialType,
      ...(envVar.trim() ? { envVar: envVar.trim() } : {}),
      ...(secretValue ? { __secretValue: secretValue } : {}),
    });
  }

  const isNew = !item;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-api-key"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={credentialType} onValueChange={setCredentialType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CREDENTIAL_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {CREDENTIAL_TYPE_LABELS[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>
          Env var name{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          value={envVar}
          onChange={(e) => setEnvVar(e.target.value)}
          placeholder="MY_SECRET_TOKEN"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          If set, the secret value will be injected as this environment variable
          at runtime.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>
          Secret value{" "}
          {!isNew && (
            <span className="text-muted-foreground font-normal">
              (leave empty to keep current)
            </span>
          )}
        </Label>
        <Textarea
          value={secretValue}
          onChange={(e) => setSecretValue(e.target.value)}
          placeholder="Paste your secret key, token, or credential here…"
          rows={4}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Stored encrypted (AES-256-GCM) and injected at runtime.
        </p>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
}
