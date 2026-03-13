import { NextResponse } from "next/server";
import { ensureBootstrapped, refreshProviders } from "@/lib/bootstrap";

export interface DiscoveredAgentType {
  id: string;
  name: string;
  description: string;
  source: string;
  category?: string;
}

export async function GET() {
  try {
    await ensureBootstrapped();
    const providers = await refreshProviders();

    const agentTypes: DiscoveredAgentType[] = [];

    for (const provider of providers) {
      // Extract commands categorized as "agent"
      const agentCommands = provider.commands.filter(
        (c) => c.category === "agent"
      );

      for (const cmd of agentCommands) {
        agentTypes.push({
          id: `${provider.provider}:${cmd.name.toLowerCase().replace(/\s+/g, "-")}`,
          name: cmd.name,
          description: `Claude Code command: ${cmd.name}`,
          source: "Claude Command",
          category: cmd.category,
        });
      }

      // Also add workflow commands as launchable
      const workflowCommands = provider.commands.filter(
        (c) => c.category === "workflow"
      );

      for (const cmd of workflowCommands) {
        agentTypes.push({
          id: `${provider.provider}:${cmd.name.toLowerCase().replace(/\s+/g, "-")}`,
          name: cmd.name,
          description: `Claude Code workflow: ${cmd.name}`,
          source: "Claude Workflow",
          category: cmd.category,
        });
      }
    }

    // Fallback: if no agent commands found, provide a generic type
    if (agentTypes.length === 0) {
      agentTypes.push({
        id: "claude:general",
        name: "Claude Code Agent",
        description: "General-purpose Claude Code agent",
        source: "Claude Code",
      });
    }

    return NextResponse.json({ agentTypes });
  } catch (err) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Discovery failed" } },
      { status: 500 }
    );
  }
}
