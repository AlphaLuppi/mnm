// chat-s04-typing-indicator
export interface TypingIndicatorProps {
  isTyping: boolean;
  senderName?: string | null;
}

export function TypingIndicator({ isTyping, senderName }: TypingIndicatorProps) {
  if (!isTyping) return null;

  return (
    <div
      data-testid="chat-s04-typing"
      className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground"
    >
      <div className="flex gap-0.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
      </div>
      <span>{senderName ?? "Agent"} is typing...</span>
    </div>
  );
}
