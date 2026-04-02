import { useState } from "react";
import type { ConfigLayerItem, McpItemConfig } from "@mnm/shared";
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

type McpTransport = "http" | "sse" | "stdio";

type Props = {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
};

function envRecordToText(env?: Record<string, string>): string {
  if (!env) return "";
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

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

export function McpItemEditor({ item, onSave, onCancel }: Props) {
  const existing = item?.configJson as McpItemConfig | undefined;

  const [name, setName] = useState(item?.name ?? "");
  const [transport, setTransport] = useState<McpTransport>(
    (existing?.type as McpTransport) ?? "http",
  );
  const [url, setUrl] = useState(existing?.url ?? "");
  const [command, setCommand] = useState(existing?.command ?? "");
  const [args, setArgs] = useState((existing?.args ?? []).join(" "));
  const [envText, setEnvText] = useState(envRecordToText(existing?.env));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const config: McpItemConfig & { name: string } = {
      name,
      type: transport,
      ...(transport !== "stdio" && url ? { url } : {}),
      ...(transport === "stdio" && command ? { command } : {}),
      ...(transport === "stdio" && args.trim()
        ? { args: args.trim().split(/\s+/) }
        : {}),
      ...(envText.trim() ? { env: parseEnvText(envText) } : {}),
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
          placeholder="my-mcp-server"
          required
          className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-gray-300 text-sm">Transport</Label>
        <Select value={transport} onValueChange={(v) => setTransport(v as McpTransport)}>
          <SelectTrigger className="bg-gray-900 border-gray-600 text-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            <SelectItem value="http" className="text-gray-200">HTTP</SelectItem>
            <SelectItem value="sse" className="text-gray-200">SSE</SelectItem>
            <SelectItem value="stdio" className="text-gray-200">stdio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {transport !== "stdio" && (
        <div className="space-y-1">
          <Label className="text-gray-300 text-sm">URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/mcp"
            className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500"
          />
        </div>
      )}

      {transport === "stdio" && (
        <>
          <div className="space-y-1">
            <Label className="text-gray-300 text-sm">Command</Label>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npx"
              className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300 text-sm">Args (space-separated)</Label>
            <Input
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
              className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500"
            />
          </div>
        </>
      )}

      <div className="space-y-1">
        <Label className="text-gray-300 text-sm">
          Environment Variables <span className="text-gray-500 font-normal">(KEY=value per line)</span>
        </Label>
        <Textarea
          value={envText}
          onChange={(e) => setEnvText(e.target.value)}
          placeholder={"API_KEY=your-key\nBASE_URL=https://api.example.com"}
          rows={4}
          className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500 font-mono text-sm"
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
