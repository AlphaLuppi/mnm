import { EventEmitter } from "events";

export type AgentEvent =
  | { type: "started"; agentId: string; specId: string }
  | { type: "progress"; agentId: string; message: string }
  | { type: "completed"; agentId: string; filesModified: string[] }
  | { type: "error"; agentId: string; error: string }
  | { type: "fileLockReleased"; filePath: string }
  | { type: "specChanged"; agentId: string; specId: string; changeSummary: string };

class AgentEventBus extends EventEmitter {
  emitAgentEvent(event: AgentEvent) {
    this.emit("agent-event", event);
    this.emit(event.type, event);
  }

  onAgentEvent(handler: (event: AgentEvent) => void): () => void {
    this.on("agent-event", handler);
    return () => this.off("agent-event", handler);
  }
}

export const agentEventBus = new AgentEventBus();
