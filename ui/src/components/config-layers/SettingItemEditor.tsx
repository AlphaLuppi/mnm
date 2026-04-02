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
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
      <div className="space-y-1">
        <Label className="text-gray-300 text-sm">Key</Label>
        <Select value={selectedKey} onValueChange={setSelectedKey}>
          <SelectTrigger className="bg-gray-900 border-gray-600 text-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            {SETTING_KEYS.map((k) => (
              <SelectItem key={k} value={k} className="text-gray-200 font-mono text-sm">
                {k}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_SENTINEL} className="text-gray-400 italic">
              Custom key...
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedKey === CUSTOM_SENTINEL && (
        <div className="space-y-1">
          <Label className="text-gray-300 text-sm">Custom Key</Label>
          <Input
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            placeholder="my.custom.setting"
            required
            className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500 font-mono text-sm"
          />
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-gray-300 text-sm">
          Value{" "}
          <span className="text-gray-500 font-normal">
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
          className="bg-gray-900 border-gray-600 text-gray-200 placeholder:text-gray-500 font-mono"
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
