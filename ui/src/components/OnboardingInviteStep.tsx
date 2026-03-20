import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, X, Send, SkipForward, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

// onb-s01-invite-component

export interface InviteEntry {
  email: string;
  role: "admin" | "manager" | "contributor" | "viewer";
}

export interface OnboardingInviteStepProps {
  onSendInvitations: (invites: InviteEntry[]) => Promise<void>;
  onSkip: () => void;
  loading?: boolean;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "contributor", label: "Contributor" },
  { value: "viewer", label: "Viewer" },
] as const;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function OnboardingInviteStep({
  onSendInvitations,
  onSkip,
  loading = false,
}: OnboardingInviteStepProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteEntry["role"]>("contributor");
  const [invites, setInvites] = useState<InviteEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleAdd = useCallback(() => {
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }
    if (!isValidEmail(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    if (invites.some((inv) => inv.email === email.trim())) {
      setError("This email is already in the list");
      return;
    }

    setInvites((prev) => [...prev, { email: email.trim(), role }]);
    setEmail("");
  }, [email, role, invites]);

  const handleRemove = useCallback((index: number) => {
    setInvites((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(async () => {
    if (invites.length === 0) {
      setError("Add at least one email to send invitations");
      return;
    }
    setError(null);
    setSuccess(null);
    setSending(true);
    try {
      await onSendInvitations(invites);
      setSuccess(`Successfully sent ${invites.length} invitation(s)`);
      setInvites([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitations");
    } finally {
      setSending(false);
    }
  }, [invites, onSendInvitations]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Invite team members to join your company. You can also do this later from the Members page.
      </p>

      {/* Email + Role input row */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Email
          </label>
          <input
            data-testid="onb-s01-invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
        </div>
        <div className="w-36">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Role
          </label>
          <select
            data-testid="onb-s01-invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as InviteEntry["role"])}
            className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          data-testid="onb-s01-invite-add"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="h-[38px]"
        >
          <UserPlus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Invite list */}
      <div
        data-testid="onb-s01-invite-list"
        className={cn(
          "space-y-2 min-h-[48px]",
          invites.length === 0 && "flex items-center justify-center text-sm text-muted-foreground",
        )}
      >
        {invites.length === 0 ? (
          <span>No invitations added yet</span>
        ) : (
          invites.map((inv, i) => (
            <div
              key={inv.email}
              data-testid={`onb-s01-invite-item-${i}`}
              className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md text-sm"
            >
              <span className="font-medium">{inv.email}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground capitalize">{inv.role}</span>
                <button
                  data-testid={`onb-s01-invite-remove-${i}`}
                  onClick={() => handleRemove(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Error / Success messages */}
      {error && (
        <div
          data-testid="onb-s01-invite-error"
          className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          data-testid="onb-s01-invite-success"
          className="text-sm text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-md"
        >
          {success}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 justify-end pt-2">
        <Button
          data-testid="onb-s01-invite-skip"
          variant="ghost"
          onClick={onSkip}
          disabled={sending || loading}
        >
          <SkipForward className="w-4 h-4 mr-1" />
          Skip for now
        </Button>
        <Button
          data-testid="onb-s01-invite-send"
          onClick={handleSend}
          disabled={invites.length === 0 || sending || loading}
        >
          {sending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-1" />
          )}
          Send {invites.length > 0 ? `${invites.length} ` : ""}Invitation{invites.length !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
