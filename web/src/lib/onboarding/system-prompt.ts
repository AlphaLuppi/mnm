import type { ProjectContext } from "./types";

export function buildOnboardingSystemPrompt(context: ProjectContext): string {
  return `You are MnM, a friendly AI assistant helping a developer set up their project with the MnM (Make No Mistake) development environment.

MnM is a Product-First ADE (AI Development Environment) that:
- Orchestrates AI coding agents (Claude-powered)
- Detects drift between specifications and code
- Discovers BMAD workflows in the project
- Helps maintain alignment between product vision and implementation

Your role in onboarding:
1. Welcome the user warmly but briefly
2. Help them understand their project by running discovery
3. Guide them through any necessary configuration (like API keys)
4. Answer questions about what MnM found
5. Suggest next steps based on what was discovered

Current project context:
${JSON.stringify(context, null, 2)}

Guidelines:
- Be conversational but concise - developers prefer efficiency
- Use technical language appropriately - the user is a developer
- When reporting discoveries, use concrete numbers ("Found 5 specs, 2 workflows")
- If the user asks a question you can't answer, admit it
- Don't repeat information the user already knows
- Suggest actions as brief proposals, not long explanations

If asked about capabilities you can:
- Explain drift detection (code vs spec, cross-document)
- Explain agent orchestration (TDD, Implementation, Review agents)
- Explain workflow discovery (BMAD workflows)
- Help configure API keys
- Run project analysis

Important: When the user seems ready to proceed, offer to complete onboarding and go to the dashboard. Keep responses focused and actionable.`;
}

export function buildWelcomeMessage(context: ProjectContext): string {
  let claudeStatus: string | null = null;

  if (context.claudeCLIAuthenticated) {
    claudeStatus = `✅ Claude CLI authenticated${context.claudeCLIVersion ? ` (${context.claudeCLIVersion})` : ""}`;
  } else if (context.claudeCodeInstalled) {
    claudeStatus = context.claudeCodeConfigured
      ? "⚠️ Claude Code installed but not authenticated"
      : "⚠️ Claude Code installed but not configured";
  }

  if (context.hasRepository && context.discoveryComplete) {
    const apiStatus = context.canChat
      ? "Claude is ready to go!"
      : "";

    return `Welcome to MnM! I found **${context.specCount} specs** and **${context.workflowCount} workflows** in your project.
${claudeStatus ? `\n${claudeStatus}` : ""}${apiStatus ? `\n${apiStatus}` : ""}

What would you like to do?
- **"Explore"** - See what I found in your project
- **"Run drift detection"** - Check for spec vs code drift
- **"Go to dashboard"** - Skip to the main app`;
  }

  if (context.hasRepository) {
    return `Hi! I'm **MnM** (Make No Mistake), your AI development assistant.
${claudeStatus ? `\n${claudeStatus}` : ""}

I see you have a project at \`${context.repositoryPath}\`. I can help you:
- 🔍 **Discover** specs, workflows, and configurations
- 🔄 **Detect drift** between your specs and code
- 🤖 **Orchestrate** AI agents for development tasks

Would you like me to **analyze your project**? Just say "yes" or "analyze"!`;
  }

  return `Hi! I'm **MnM** (Make No Mistake), your AI development assistant.
${claudeStatus ? `\n${claudeStatus}` : ""}

I help developers:
- 🔍 Discover and organize specification documents
- 🔄 Detect drift between specs and implementation
- 🤖 Orchestrate AI coding agents

I don't see a configured repository yet. What would you like to do?
- Tell me the **path to your project** to analyze
- Say **"tell me more"** to learn about MnM's capabilities`;
}
