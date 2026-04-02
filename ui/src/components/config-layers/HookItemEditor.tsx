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
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
      <div className="space-y-1">
        <Label className="text-gray-300 text-sm">Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-hook"
          required
          className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-gray-300 text-sm">Event</Label>
          <Select value={event} onValueChange={(v) => setEvent(v as HookEvent)}>
            <SelectTrigger className="bg-gray-900 border-gray-600 text-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700 max-h-60 overflow-y-auto">
              {HOOK_EVENTS.map((ev) => (
                <SelectItem key={ev} value={ev} className="text-gray-200">
                  {ev}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-gray-300 text-sm">Hook Type</Label>
          <Select value={hookType} onValueChange={(v) => setHookType(v as HookType)}>
            <SelectTrigger className="bg-gray-900 border-gray-600 text-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {HOOK_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-gray-200">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-gray-300 text-sm">
          Matcher Regex <span className="text-gray-500 font-normal">(optional)</span>
        </Label>
        <Input
          value={matcher}
          onChange={(e) => setMatcher(e.target.value)}
          placeholder="Bash|Write|Edit"
          className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500 font-mono text-sm"
        />
      </div>

      {hookType === "command" && (
        <div className="space-y-1">
          <Label className="text-gray-300 text-sm">Command</Label>
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="/usr/local/bin/my-hook.sh"
            required
            className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500 font-mono text-sm"
          />
        </div>
      )}

      {hookType === "http" && (
        <div className="space-y-1">
          <Label className="text-gray-300 text-sm">URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.example.com/claude"
            required
            className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500"
          />
        </div>
      )}

      {(hookType === "prompt" || hookType === "agent") && (
        <div className="space-y-1">
          <Label className="text-gray-300 text-sm">Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="You are a hook. Analyze the tool call and..."
            rows={4}
            required
            className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500"
          />
        </div>
      )}

      <div className="space-y-1 w-32">
        <Label className="text-gray-300 text-sm">Timeout (seconds)</Label>
        <Input
          type="number"
          value={timeout}
          onChange={(e) => setTimeout_(e.target.value)}
          min={1}
          max={300}
          className="bg-gray-900 border-gray-600 text-gray-200"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
          {item ? "Update" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="text-gray-400 hover:text-gray-200">
          Cancel
        </Button>
      </div>
    </form>
  );
}
