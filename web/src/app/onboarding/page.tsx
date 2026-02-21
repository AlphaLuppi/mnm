import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { OnboardingChat } from "@/components/onboarding/onboarding-chat";
import { loadConfig, getAnthropicApiKey } from "@/lib/core/config";
import { getDb } from "@/lib/db";
import * as specRepo from "@/lib/db/repositories/specs";
import * as workflowRepo from "@/lib/db/repositories/workflows";
import { ClaudeProvider } from "@/lib/providers/claude";
import { getClaudeCLIStatus } from "@/lib/claude/cli";
import type { ProjectContext } from "@/lib/onboarding/types";

export default async function OnboardingPage() {
  // Check if already onboarded via cookie
  const cookieStore = await cookies();
  const onboardingCookie = cookieStore.get("mnm-onboarding-complete");

  // Initialize database
  getDb();

  // Build initial context
  const config = loadConfig();
  const apiKey = getAnthropicApiKey();
  const specs = specRepo.findAll();
  const workflows = workflowRepo.findAll();

  // Check Claude Code status (directory presence)
  const claudeProvider = new ClaudeProvider();
  const claudeState = await claudeProvider.detect();
  const claudeConfigured =
    claudeState.presence.installed && claudeState.presence.configured;

  // Check Claude CLI authentication status
  const cliStatus = await getClaudeCLIStatus();
  const canChat = (cliStatus.installed && cliStatus.authenticated) || !!apiKey;

  // If already onboarded via cookie, redirect to dashboard
  if (onboardingCookie?.value === "true") {
    redirect("/");
  }

  // If config says onboarding completed but cookie is missing (e.g., cookies cleared),
  // redirect to API route that sets the cookie and then redirects to dashboard.
  // This breaks the 307 loop between middleware and this page.
  if (config.onboardingCompleted) {
    redirect("/api/onboarding/sync-cookie");
  }

  const context: ProjectContext = {
    hasRepository: !!config.repositoryPath,
    repositoryPath: config.repositoryPath,
    specCount: specs.length,
    workflowCount: workflows.length,
    hasApiKey: !!apiKey,
    discoveryComplete: specs.length > 0 || workflows.length > 0,
    claudeCodeInstalled: cliStatus.installed,
    claudeCodeConfigured: claudeConfigured,
    claudeCLIAuthenticated: cliStatus.authenticated,
    claudeCLIVersion: cliStatus.version,
    canChat,
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <OnboardingChat initialContext={context} />
    </div>
  );
}
