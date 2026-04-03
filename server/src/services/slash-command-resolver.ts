/**
 * CHAT-WS: Slash Command Resolver
 *
 * Resolves slash commands sent from the collaborative chat UI.
 * Phase 1: Built-in commands only (summarize, deep-dive, export, save, help).
 * Phase 2 (future): Custom skills from agent config layers.
 *
 * Pattern: Same service factory as chat.ts, a2a-bus.ts
 */

import type { Db } from "@mnm/db";

interface CommandContext {
  companyId: string;
  channelId: string;
  userId: string;
  agentId?: string;
}

interface CommandResult {
  success: boolean;
  content?: string;
  error?: string;
  artifactData?: { title: string; artifactType: string; content: string };
}

export function slashCommandResolver(db: Db) {
  const builtInCommands: Record<
    string,
    (args: string[], ctx: CommandContext) => Promise<CommandResult>
  > = {
    help: async () => ({
      success: true,
      content:
        "Available commands:\n" +
        "- /summarize -- Summarize current context\n" +
        "- /summarize-doc -- Summarize a specific document\n" +
        "- /deep-dive -- Enable RAG mode on a document\n" +
        "- /export -- Export current artifact\n" +
        "- /save -- Save artifact to a Folder\n" +
        "- /help -- Show this help",
    }),

    summarize: async () => ({
      success: true,
      content:
        "[System] Summarize the current conversation context and linked documents.",
    }),

    "summarize-doc": async (args) => ({
      success: true,
      content: `[System] Summarize the document: ${args.join(" ").trim() || "(no document specified)"}`,
    }),

    "deep-dive": async (args) => ({
      success: true,
      content: `[System] RAG mode activated for: ${args.join(" ").trim() || "(current documents)"}`,
    }),

    export: async () => ({
      success: true,
      content:
        "[System] Export requested. The current artifact will be prepared for download.",
    }),

    save: async (args) => ({
      success: true,
      content: `[System] Save to folder: ${args.join(" ").trim() || "(select a folder)"}`,
    }),
  };

  return {
    async resolve(
      command: string,
      args: string[],
      context: CommandContext,
    ): Promise<CommandResult> {
      // 1. Check built-in commands
      const handler = builtInCommands[command.toLowerCase()];
      if (handler) return handler(args, context);

      // 2. Check custom skills from agent's config layers
      // (Phase 2 -- for now return not found)

      return { success: false, error: `Unknown command: /${command}` };
    },

    listAvailable(): { name: string; description: string }[] {
      return [
        { name: "summarize", description: "Summarize current context" },
        {
          name: "summarize-doc",
          description: "Summarize a specific document",
        },
        {
          name: "deep-dive",
          description: "Enable RAG mode on a document",
        },
        { name: "export", description: "Export current artifact" },
        { name: "save", description: "Save artifact to a Folder" },
        { name: "help", description: "Show available commands" },
      ];
    },
  };
}
