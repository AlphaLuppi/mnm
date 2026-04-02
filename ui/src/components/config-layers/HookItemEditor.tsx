import { useState } from "react";
import type { ConfigLayerItem, HookItemConfig } from "@mnm/shared";
import { HOOK_EVENTS, HOOK_TYPES } from "@mnm/shared";
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

type HookEvent = (typeof HOOK_EVENTS)[number];
type HookType = (typeof HOOK_TYPES)[number];

type Props = {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
};

export function HookItemEditor({ item, onSave, onCancel }: Props) {
  const existing = item?.configJson as HookItemConfig | undefined;

  const [name, setName] = useState(item?.name ?? "");
  const [event, setEvent] = useState<HookEvent>(
    (existing?.event as HookEvent) ?? "PreToolUse",
  );
  const [hookType, setHookType] = useState<HookType>(
    (existing?.hookType as HookType) ?? "command",
  );
  const [matcher, setMatcher] = useState(existing?.matcher ?? "");
  const [command, setCommand] = useState(existing?.command ?? "");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [prompt, setPrompt] = useState(existing?.prompt ?? "");
  const [timeout, setTimeout_] = useState(
    String(existing?.timeout ?? 30),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const config: HookItemConfig & { name: string } = {
      name,
      event,
      hookType,
      ...(matcher.trim() ? { matcher: matcher.trim() } : {}),
      ...(hookType === "command" ? { command } : {}),
      ...(hookType === "http" ? { url } : {}),
      ...((hookType === "prompt" || hookType === "agent") ? { prompt } : {}),
      timeout: parseInt(timeout, 10) || 30,
    };
    onSave(config);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-lg border border-border bg-muted/50">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-hook"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Event</Label>
          <Select value={event} onValueChange={(v) => setEvent(v as HookEvent)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {HOOK_EVENTS.map((ev) => (
                <SelectItem key={ev} value={ev}>
                  {ev}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Hook Type</Label>
          <Select value={hookType} onValueChange={(v) => setHookType(v as HookType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOOK_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>
          Matcher Regex <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          value={matcher}
          onChange={(e) => setMatcher(e.target.value)}
          placeholder="Bash|Write|Edit"
          className="font-mono text-sm"
        />
      </div>

      {hookType === "command" && (
        <div className="space-y-1.5">
          <Label>Command</Label>
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="/usr/local/bin/my-hook.sh"
            required
            className="font-mono text-sm"
          />
        </div>
      )}

      {hookType === "http" && (
        <div className="space-y-1.5">
          <Label>URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.example.com/claude"
            required
          />
        </div>
      )}

      {(hookType === "prompt" || hookType === "agent") && (
        <div className="space-y-1.5">
          <Label>Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="You are a hook. Analyze the tool call and..."
            rows={4}
            required
          />
        </div>
      )}

      <div className="space-y-1.5 w-32">
        <Label>Timeout (seconds)</Label>
        <Input
          type="number"
          value={timeout}
          onChange={(e) => setTimeout_(e.target.value)}
          min={1}
          max={300}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm">
          {item ? "Update" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
