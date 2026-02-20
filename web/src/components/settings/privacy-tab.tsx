"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PrivacyNotice } from "@/components/shared/privacy-notice";
import type { MnMConfig } from "@/lib/core/config";

interface PrivacyTabProps {
  config: MnMConfig;
  onUpdate: (patch: Record<string, unknown>) => void;
}

export function PrivacyTab({ config, onUpdate }: PrivacyTabProps) {
  const [clearing, setClearing] = useState(false);

  async function clearDatabase() {
    setClearing(true);
    try {
      const res = await fetch("/api/settings/clear-database", {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Database cleared successfully.");
      } else {
        toast.error("Failed to clear database.");
      }
    } catch {
      toast.error("Failed to clear database.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PrivacyNotice />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="telemetry-toggle">Anonymous Telemetry</Label>
              <p className="text-xs text-muted-foreground">
                Help improve MnM by sending anonymous usage stats (no code
                content or file paths)
              </p>
            </div>
            <Switch
              id="telemetry-toggle"
              checked={config.telemetryEnabled}
              onCheckedChange={(v) => onUpdate({ telemetryEnabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Clear Local Database</p>
              <p className="text-xs text-muted-foreground">
                Delete all agent history, drift detections, and spec index
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={clearing}>
                  Clear Database
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Local Database?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all agent history, drift detections, and
                    spec index. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearDatabase}>
                    Clear Database
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
