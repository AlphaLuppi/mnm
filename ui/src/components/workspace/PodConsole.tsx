// POD-05: Chat-style pod console with interactive command support
import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Send,
  Terminal,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Key,
  ClipboardPaste,
} from "lucide-react";
import { podsApi } from "../../api/pods";
import { useCompany } from "../../context/CompanyContext";
import { Button } from "@/components/ui/button";

interface ConsoleMessage {
  id: string;
  type: "command" | "output" | "error" | "system" | "input-prompt";
  content: string;
  timestamp: Date;
  exitCode?: number;
}

// Detect URLs in text and make them clickable
function linkifyText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const QUICK_COMMANDS = [
  { label: "Claude Login", cmd: "claude auth login", icon: Key, description: "Sign in to your Anthropic account" },
  { label: "Auth Status", cmd: "claude auth status", icon: CheckCircle2, description: "Check authentication status" },
  { label: "Check Claude", cmd: "claude --version", icon: Terminal, description: "Verify Claude is installed" },
  { label: "Who Am I", cmd: "whoami && pwd", icon: ChevronRight, description: "Current user and directory" },
];

// Commands that are interactive and need stdin follow-up
const INTERACTIVE_COMMANDS = ["claude auth login", "claude setup-token"];

export function PodConsole() {
  const { selectedCompanyId } = useCompany();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    {
      id: "welcome",
      type: "system",
      content: "Welcome to your workspace console. Type a command or use the quick actions below.",
      timestamp: new Date(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Track if we're waiting for interactive input (e.g., auth code)
  const [pendingInteractive, setPendingInteractive] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Standard command execution
  const execMutation = useMutation({
    mutationFn: ({ command, stdin }: { command: string; stdin?: string }) =>
      podsApi.exec(selectedCompanyId!, command, stdin),
    onSuccess: (data, variables) => {
      const outputMessages: ConsoleMessage[] = [];

      if (data.stdout) {
        outputMessages.push({
          id: `out-${Date.now()}`,
          type: "output",
          content: data.stdout,
          timestamp: new Date(),
          exitCode: data.exitCode,
        });
      }
      if (data.stderr) {
        outputMessages.push({
          id: `err-${Date.now()}`,
          type: data.stderr.includes("error") ? "error" : "output",
          content: data.stderr,
          timestamp: new Date(),
        });
      }
      if (!data.stdout && !data.stderr) {
        outputMessages.push({
          id: `empty-${Date.now()}`,
          type: "output",
          content: "(no output)",
          timestamp: new Date(),
          exitCode: data.exitCode,
        });
      }

      // Check if the command output indicates it's waiting for input (auth flow)
      const fullOutput = (data.stdout || "") + (data.stderr || "");
      const isAuthWaiting = fullOutput.includes("Opening browser") || fullOutput.includes("visit:");

      if (isAuthWaiting && !variables.stdin) {
        // The command showed an auth URL — now we need the user to paste the code
        setPendingInteractive(variables.command);
        outputMessages.push({
          id: `prompt-${Date.now()}`,
          type: "input-prompt",
          content: "Open the URL above in your browser, authenticate, then paste the code below.",
          timestamp: new Date(),
        });
      } else if (variables.stdin) {
        // We sent stdin — the interactive flow is complete
        setPendingInteractive(null);
      }

      setMessages((prev) => [...prev, ...outputMessages]);
    },
    onError: (err: Error) => {
      setPendingInteractive(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          type: "error",
          content: err.message,
          timestamp: new Date(),
        },
      ]);
    },
  });

  const runCommand = useCallback(
    (command: string) => {
      const trimmed = command.trim();
      if (!trimmed) return;

      // If we're in interactive mode, send as stdin to the pending command
      if (pendingInteractive) {
        setMessages((prev) => [
          ...prev,
          {
            id: `stdin-${Date.now()}`,
            type: "command",
            content: `[pasting code] ${trimmed.slice(0, 20)}...`,
            timestamp: new Date(),
          },
        ]);
        setInput("");
        execMutation.mutate({ command: pendingInteractive, stdin: trimmed });
        return;
      }

      // Normal command
      setMessages((prev) => [
        ...prev,
        {
          id: `cmd-${Date.now()}`,
          type: "command",
          content: trimmed,
          timestamp: new Date(),
        },
      ]);

      setCommandHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);
      setInput("");

      execMutation.mutate({ command: trimmed });
    },
    [execMutation, pendingInteractive],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runCommand(input);
    } else if (e.key === "ArrowUp" && !pendingInteractive) {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]!);
      }
    } else if (e.key === "ArrowDown" && !pendingInteractive) {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]!);
        }
      }
    } else if (e.key === "Escape" && pendingInteractive) {
      setPendingInteractive(null);
      setMessages((prev) => [
        ...prev,
        { id: `cancel-${Date.now()}`, type: "system", content: "Interactive input cancelled.", timestamp: new Date() },
      ]);
    }
  };

  return (
    <div className="rounded-lg border bg-card flex flex-col h-[500px]" data-testid="pod-console">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Terminal className="h-3.5 w-3.5 text-green-400" />
        <span className="text-xs font-medium">Console</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {execMutation.isPending ? "Running..." : pendingInteractive ? "Awaiting input..." : "Ready"}
        </span>
      </div>

      {/* Quick commands */}
      {!pendingInteractive && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/10 overflow-x-auto">
          {QUICK_COMMANDS.map((qc) => (
            <Button
              key={qc.cmd}
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2.5 shrink-0 gap-1.5"
              onClick={() => runCommand(qc.cmd)}
              disabled={execMutation.isPending}
              title={qc.description}
            >
              <qc.icon className="h-3 w-3" />
              {qc.label}
            </Button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-0.5">
            {msg.type === "command" && (
              <div className="flex items-start gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                <code className="text-xs text-blue-400 font-mono">{msg.content}</code>
              </div>
            )}
            {msg.type === "output" && (
              <div className="flex items-start gap-2">
                <div className="w-3.5 shrink-0" />
                <div className="flex-1 rounded-md bg-muted/30 px-3 py-2">
                  <pre className="text-xs font-mono text-foreground/90 whitespace-pre-wrap break-all leading-relaxed">
                    {linkifyText(msg.content)}
                  </pre>
                  {msg.exitCode != null && msg.exitCode !== 0 && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-500">
                      <XCircle className="h-3 w-3" />
                      Exit code: {msg.exitCode}
                    </div>
                  )}
                </div>
              </div>
            )}
            {msg.type === "error" && (
              <div className="flex items-start gap-2">
                <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
                  <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap break-all leading-relaxed">
                    {linkifyText(msg.content)}
                  </pre>
                </div>
              </div>
            )}
            {msg.type === "system" && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">{msg.content}</p>
              </div>
            )}
            {msg.type === "input-prompt" && (
              <div className="flex items-start gap-2">
                <ClipboardPaste className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                  <p className="text-xs text-amber-300 font-medium">{msg.content}</p>
                  <p className="text-[10px] text-amber-400/60 mt-1">Press Escape to cancel</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {execMutation.isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Running command...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className={`border-t px-4 py-3 flex items-center gap-2 ${pendingInteractive ? "bg-amber-500/5 border-amber-500/20" : ""}`}>
        <span className={`text-xs font-mono shrink-0 ${pendingInteractive ? "text-amber-400" : "text-green-400"}`}>
          {pendingInteractive ? ">" : "$"}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={pendingInteractive ? "Paste your auth code here..." : "Type a command..."}
          className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
          disabled={execMutation.isPending}
          autoFocus
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => runCommand(input)}
          disabled={!input.trim() || execMutation.isPending}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
