"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { MnMConfig } from "@/lib/core/config";

interface GeneralTabProps {
  config: MnMConfig;
  onUpdate: (patch: Record<string, unknown>) => void;
}

export function GeneralTab({ config, onUpdate }: GeneralTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={config.theme}
              onValueChange={(v) => onUpdate({ theme: v })}
            >
              <SelectTrigger className="w-40" id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Font Size</Label>
              <span className="text-sm text-muted-foreground">
                {config.fontSize}px
              </span>
            </div>
            <Slider
              value={[config.fontSize]}
              min={12}
              max={20}
              step={1}
              onValueChange={([v]) => onUpdate({ fontSize: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="drift-toggle">Drift Detection</Label>
              <p className="text-xs text-muted-foreground">
                Automatically detect when code diverges from specs
              </p>
            </div>
            <Switch
              id="drift-toggle"
              checked={config.driftDetectionEnabled}
              onCheckedChange={(v) =>
                onUpdate({ driftDetectionEnabled: v })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="perf-toggle">Performance Panel</Label>
              <p className="text-xs text-muted-foreground">
                Show performance metrics at the bottom of settings
              </p>
            </div>
            <Switch
              id="perf-toggle"
              checked={config.performancePanelEnabled}
              onCheckedChange={(v) =>
                onUpdate({ performancePanelEnabled: v })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="hints-toggle">Help Hints</Label>
              <p className="text-xs text-muted-foreground">
                Show contextual hints for first-time users
              </p>
            </div>
            <Switch
              id="hints-toggle"
              checked={config.showHelpHints}
              onCheckedChange={(v) => onUpdate({ showHelpHints: v })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
