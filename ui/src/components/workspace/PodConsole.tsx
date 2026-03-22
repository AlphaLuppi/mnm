// POD-05: Chat-style sandbox console
// Auth uses CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token` (run on host)
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
  Fingerprint,
} from "lucide-react";
import { sandboxesApi } from "../../api/sandboxes";
import { useCompany } from "../../context/CompanyContext";
import { Button } from "@/components/ui/button";

interface ConsoleMessage {
  id: string;
  type: "command" | "output" | "error" | "system" | "auth-setup";
  content: string;
  timestamp: Date;
  exitCode?: number | null;
}

function linkifyText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all">
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const QUICK_COMMANDS = [
  { label: "Connect Claude", cmd: "__CONNECT_CLAUDE__", icon: Key, description: "Set up Claude authentication with your subscription" },
  { label: "Auth Status", cmd: "claude auth status", icon: CheckCircle2, description: "Check authentication status" },
  { label: "Check Claude", cmd: "claude --version", icon: Terminal, description: "Verify Claude is installed" },
  { label: "Who Am I", cmd: "whoami && pwd", icon: ChevronRight, description: "Current user and directory" },
];

export function PodConsole() {
  const { selectedCompanyId } = useCompany();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    { id: "welcome", type: "system", content: "Welcome to your workspace console. Type a command or use the quick actions below.", timestamp: new Date() },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [waitingForToken, setWaitingForToken] = useState(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Execute a command
  const execMutation = useMutation({
    mutationFn: (command: string) => sandboxesApi.exec(selectedCompanyId!, command),
    onSuccess: (data) => {
      const msgs: ConsoleMessage[] = [];
      if (data.stdout) msgs.push({ id: `out-${Date.now()}`, type: "output", content: data.stdout, timestamp: new Date(), exitCode: data.exitCode });
      if (data.stderr) msgs.push({ id: `err-${Date.now()}`, type: data.stderr.toLowerCase().includes("error") ? "error" : "output", content: data.stderr, timestamp: new Date() });
      if (!data.stdout && !data.stderr) msgs.push({ id: `empty-${Date.now()}`, type: "output", content: "(no output)", timestamp: new Date(), exitCode: data.exitCode });
      setMessages((prev) => [...prev, ...msgs]);
    },
    onError: (err: Error) => {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, type: "error", content: err.message, timestamp: new Date() }]);
    },
  });

  // Send token to sandbox
  const tokenMutation = useMutation({
    mutationFn: (token: string) => sandboxesApi.exec(selectedCompanyId!,
      `mkdir -p ~/.claude && echo '{"hasCompletedOnboarding":true}' > ~/.claude.json && echo 'export CLAUDE_CODE_OAUTH_TOKEN="${token}"' > ~/.bash_profile && export CLAUDE_CODE_OAUTH_TOKEN="${token}" && claude auth status`
    ),
    onSuccess: (data) => {
      setWaitingForToken(false);
      const output = data.stdout || "";
      const loggedIn = output.includes('"loggedIn": true');

      if (loggedIn) {
        setMessages((prev) => [
          ...prev,
          { id: `auth-ok-${Date.now()}`, type: "system", content: "Claude authenticated successfully! Your subscription is now active in this workspace.", timestamp: new Date() },
          { id: `auth-out-${Date.now()}`, type: "output", content: output, timestamp: new Date() },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `auth-out-${Date.now()}`, type: "output", content: output, timestamp: new Date() },
          { id: `auth-info-${Date.now()}`, type: "system", content: "Token saved. Run 'Auth Status' to verify.", timestamp: new Date() },
        ]);
      }
    },
    onError: (err: Error) => {
      setWaitingForToken(false);
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, type: "error", content: err.message, timestamp: new Date() }]);
    },
  });

  const isPending = execMutation.isPending || tokenMutation.isPending;

  const runCommand = useCallback((command: string) => {
    const trimmed = command.trim();
    if (!trimmed) return;

    // Token paste mode
    if (waitingForToken) {
      if (!trimmed.startsWith("sk-ant-oat")) {
        setMessages((prev) => [...prev, { id: `warn-${Date.now()}`, type: "error", content: "Token should start with 'sk-ant-oat...'. Run 'claude setup-token' on your local machine to get one.", timestamp: new Date() }]);
        return;
      }
      setMessages((prev) => [...prev, { id: `token-${Date.now()}`, type: "command", content: `[token] ${trimmed.slice(0, 20)}...`, timestamp: new Date() }]);
      setInput("");
      tokenMutation.mutate(trimmed);
      return;
    }

    // Connect Claude flow
    if (trimmed === "__CONNECT_CLAUDE__") {
      setWaitingForToken(true);
      setMessages((prev) => [
        ...prev,
        { id: `cmd-${Date.now()}`, type: "command", content: "Connect Claude", timestamp: new Date() },
        {
          id: `auth-setup-${Date.now()}`, type: "auth-setup",
          content: [
            "To connect your Claude subscription to this workspace:",
            "",
            "1. Open a terminal on YOUR machine (not here)",
            "2. Run:  claude setup-token",
            "3. Follow the browser auth flow",
            "4. Copy the token (starts with sk-ant-oat...)",
            "5. Paste it below and press Enter",
            "",
            "This token uses your Pro/Max subscription (not API credits).",
            "It's valid for 1 year.",
          ].join("\n"),
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // Normal command
    setMessages((prev) => [...prev, { id: `cmd-${Date.now()}`, type: "command", content: trimmed, timestamp: new Date() }]);
    setCommandHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInput("");
    execMutation.mutate(trimmed);
  }, [execMutation, tokenMutation, waitingForToken]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runCommand(input); }
    else if (e.key === "ArrowUp" && !waitingForToken) {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const idx = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(idx); setInput(commandHistory[idx]!);
      }
    } else if (e.key === "ArrowDown" && !waitingForToken) {
      e.preventDefault();
      if (historyIndex >= 0) {
        const idx = historyIndex + 1;
        if (idx >= commandHistory.length) { setHistoryIndex(-1); setInput(""); }
        else { setHistoryIndex(idx); setInput(commandHistory[idx]!); }
      }
    } else if (e.key === "Escape" && waitingForToken) {
      setWaitingForToken(false);
      setMessages((prev) => [...prev, { id: `cancel-${Date.now()}`, type: "system", content: "Cancelled.", timestamp: new Date() }]);
    }
  };

  return (
    <div className="rounded-lg border bg-card flex flex-col h-[500px]" data-testid="pod-console">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Terminal className="h-3.5 w-3.5 text-green-400" />
        <span className="text-xs font-medium">Console</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {isPending ? (tokenMutation.isPending ? "Saving token..." : "Running...") : waitingForToken ? "Paste token below" : "Ready"}
        </span>
      </div>

      {!waitingForToken && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/10 overflow-x-auto">
          {QUICK_COMMANDS.map((qc) => (
            <Button key={qc.cmd} variant="outline" size="sm"
              className="h-7 text-[11px] px-2.5 shrink-0 gap-1.5"
              onClick={() => runCommand(qc.cmd)} disabled={isPending} title={qc.description}>
              <qc.icon className="h-3 w-3" />
              {qc.label}
            </Button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id}>
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
                      <XCircle className="h-3 w-3" /> Exit code: {msg.exitCode}
                    </div>
                  )}
                </div>
              </div>
            )}
            {msg.type === "error" && (
              <div className="flex items-start gap-2">
                <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
                  <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap break-all leading-relaxed">{linkifyText(msg.content)}</pre>
                </div>
              </div>
            )}
            {msg.type === "system" && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <p className="text-xs text-green-400 font-medium">{msg.content}</p>
              </div>
            )}
            {msg.type === "auth-setup" && (
              <div className="flex items-start gap-2">
                <Fingerprint className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div className="flex-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2.5">
                  <pre className="text-xs text-blue-300 whitespace-pre-wrap leading-relaxed font-mono">{msg.content}</pre>
                  <p className="text-[10px] text-blue-400/50 mt-2">Press Escape to cancel</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{tokenMutation.isPending ? "Saving token and verifying..." : "Running command..."}</span>
          </div>
        )}
      </div>

      <div className={`border-t px-4 py-3 flex items-center gap-2 ${waitingForToken ? "bg-blue-500/5 border-blue-500/20" : ""}`}>
        {waitingForToken && <Key className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
        <span className={`text-xs font-mono shrink-0 ${waitingForToken ? "text-blue-400" : "text-green-400"}`}>
          {waitingForToken ? "token:" : "$"}
        </span>
        <input
          type={waitingForToken ? "password" : "text"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={waitingForToken ? "Paste your sk-ant-oat... token here" : "Type a command..."}
          className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
          disabled={isPending}
          autoFocus
        />
        <Button variant="ghost" size="sm" className="h-7 px-2"
          onClick={() => runCommand(input)} disabled={!input.trim() || isPending}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
