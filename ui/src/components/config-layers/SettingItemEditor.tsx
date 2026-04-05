import { useState } from "react";
import type { ConfigLayerItem } from "@mnm/shared";
import { SETTING_KEYS } from "@mnm/shared";
import type { SettingItemConfig } from "@mnm/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type KnownKey = (typeof SETTING_KEYS)[number];
const CUSTOM_SENTINEL = "__custom__";

type Props = {
  item?: ConfigLayerItem;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
};

export function SettingItemEditor({ item, onSave, onCancel }: Props) {
  const existing = item?.configJson as SettingItemConfig | undefined;

  const existingKey = existing?.key ?? "";
  const isKnown = (SETTING_KEYS as readonly string[]).includes(existingKey);

  const [selectedKey, setSelectedKey] = useState<string>(
    isKnown ? existingKey : CUSTOM_SENTINEL,
  );
  const [customKey, setCustomKey] = useState(isKnown ? "" : existingKey);
  const [valueText, setValueText] = useState(
    existing?.value !== undefined ? JSON.stringify(existing.value) : "",
  );

  const effectiveKey = selectedKey === CUSTOM_SENTINEL ? customKey : selectedKey;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveKey.trim()) return;

    let parsedValue: unknown = valueText;
    try {
      parsedValue = JSON.parse(valueText);
    } catch {
      // keep as string
    }

    const config: SettingItemConfig & { name: string } = {
      name: effectiveKey.trim(),
      key: effectiveKey.trim() as KnownKey,
      value: parsedValue,
    };
    onSave(config);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-3 sm:p-4 rounded-lg border border-border bg-muted/50">
      <div className="space-y-1.5">
        <Label>Key</Label>
        <Select value={selectedKey} onValueChange={setSelectedKey}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SETTING_KEYS.map((k) => (
              <SelectItem key={k} value={k} className="font-mono text-sm">
                {k}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_SENTINEL} className="italic text-muted-foreground">
              Custom key...
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedKey === CUSTOM_SENTINEL && (
        <div className="space-y-1.5">
          <Label>Custom Key</Label>
          <Input
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            placeholder="my.custom.setting"
            required
            className="font-mono text-sm"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>
          Value{" "}
          <span className="text-muted-foreground font-normal">
            (JSON or plain string — e.g. <code className="font-mono text-xs">true</code>,{" "}
            <code className="font-mono text-xs">30</code>,{" "}
            <code className="font-mono text-xs">"claude-3-5-haiku"</code>)
          </span>
        </Label>
        <Input
          value={valueText}
          onChange={(e) => setValueText(e.target.value)}
          placeholder={"true"}
          required
          className="font-mono"
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
