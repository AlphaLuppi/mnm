"use client";

import useSWR from "swr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { GeneralTab } from "@/components/settings/general-tab";
import { GitTab } from "@/components/settings/git-tab";
import { AgentTab } from "@/components/settings/agent-tab";
import { ApiTab } from "@/components/settings/api-tab";
import { PrivacyTab } from "@/components/settings/privacy-tab";
import { PerformancePanel } from "@/components/settings/performance-panel";
import type { MnMConfig } from "@/lib/core/config";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => d.settings ?? d);

export default function SettingsPage() {
  const { data: config, isLoading, mutate } = useSWR<MnMConfig>(
    "/api/settings",
    fetcher
  );

  async function updateSetting(patch: Record<string, unknown>) {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    mutate();
  }

  if (isLoading || !config) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure MnM preferences and API keys
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="git">Git</TabsTrigger>
          <TabsTrigger value="agent">Agent</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralTab config={config} onUpdate={updateSetting} />
        </TabsContent>
        <TabsContent value="git" className="mt-4">
          <GitTab config={config} onUpdate={updateSetting} />
        </TabsContent>
        <TabsContent value="agent" className="mt-4">
          <AgentTab config={config} onUpdate={updateSetting} />
        </TabsContent>
        <TabsContent value="api" className="mt-4">
          <ApiTab config={config} onUpdate={updateSetting} />
        </TabsContent>
        <TabsContent value="privacy" className="mt-4">
          <PrivacyTab config={config} onUpdate={updateSetting} />
        </TabsContent>
      </Tabs>

      {config.performancePanelEnabled && <PerformancePanel />}
    </div>
  );
}
