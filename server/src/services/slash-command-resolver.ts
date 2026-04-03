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
        "Please provide a comprehensive summary of the current conversation and all linked documents. Format the output as a structured markdown artifact.",
    }),

    "summarize-doc": async (args) => {
      const docRef = args.join(" ").trim();
      if (!docRef) {
        return { success: false, error: "Usage: /summarize-doc <document name or id>" };
      }
      return {
        success: true,
        content: `Please provide a detailed summary of the document "${docRef}". Include key sections, main points, and any important data. Format as a structured markdown artifact.`,
      };
    },

    "deep-dive": async (args) => {
      const docRef = args.join(" ").trim();
      return {
        success: true,
        content: `RAG mode activated for ${docRef || "all linked documents"}. Future messages will include relevant document excerpts as context. The agent will ground its responses in the document content.`,
      };
    },

    export: async () => ({
      success: true,
      content: "Preparing the current artifact for download.",
    }),

    save: async (args) => {
      const folderRef = args.join(" ").trim();
      if (!folderRef) {
        return { success: false, error: "Usage: /save <folder name>" };
      }
      return {
        success: true,
        content: `Saving the most recent artifact to folder "${folderRef}".`,
      };
    },
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
