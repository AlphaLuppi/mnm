import { useState } from "react";
import type { ConfigLayerItem, SkillItemConfig } from "@mnm/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
};

export function SkillItemEditor({ item, onSave, onCancel }: Props) {
  const existing = item?.configJson as SkillItemConfig | undefined;

  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(
    existing?.frontmatter?.description ?? "",
  );
  const [allowedTools, setAllowedTools] = useState(
    (existing?.frontmatter?.["allowed-tools"] ?? []).join(", "),
  );
  const [content, setContent] = useState(existing?.content ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tools = allowedTools
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const config: SkillItemConfig & { name: string } = {
      name,
      frontmatter: {
        name,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(tools.length ? { "allowed-tools": tools } : {}),
      },
      content,
    };
    onSave(config);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-3 sm:p-4 rounded-lg border border-border bg-muted/50">
      <div className="space-y-1.5">
        <Label>Skill Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-skill"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this skill does..."
        />
      </div>

      <div className="space-y-1.5">
        <Label>
          Allowed Tools <span className="text-muted-foreground font-normal">(comma-separated)</span>
        </Label>
        <Input
          value={allowedTools}
          onChange={(e) => setAllowedTools(e.target.value)}
          placeholder="Bash, Read, Write"
        />
      </div>

      <div className="space-y-1.5">
        <Label>
          Content <span className="text-muted-foreground font-normal">(Markdown)</span>
        </Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"# My Skill\n\nWhen the user asks you to...\n\n## Steps\n1. ..."}
          rows={10}
          required
          className="font-mono text-sm"
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
