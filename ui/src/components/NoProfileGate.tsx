/**
 * Pre-mount gate shown in packaged desktop builds when no connection profile
 * is active. Collects a display name and an API base URL, stores them via the
 * Tauri profile bridge, and reloads the window to restart the boot sequence
 * with a now-populated profile cache.
 *
 * Must run BEFORE React Router mounts — do not import `useNavigate` or any
 * router hook here.
 */
import { useState, type FormEvent, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addProfile } from "@/lib/profile-client";
import { Loader2, Sparkles } from "lucide-react";

function isValidUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

export function NoProfileGate(): ReactElement {
  const [displayName, setDisplayName] = useState<string>("");
  const [apiBaseUrl, setApiBaseUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const canSubmit =
    displayName.trim().length >= 1 &&
    apiBaseUrl.trim().length > 0 &&
    isValidUrl(apiBaseUrl.trim());

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const name = displayName.trim();
    const url = apiBaseUrl.trim();

    if (name.length < 1) {
      setError("Please enter a name for this instance.");
      return;
    }
    if (!isValidUrl(url)) {
      setError("The URL must start with http:// or https://");
      return;
    }

    setIsSubmitting(true);
    try {
      await addProfile({ displayName: name, apiBaseUrl: url });
      // Reload the window so main.tsx re-runs its boot gate and renders the
      // real app with the newly-active profile.
      window.location.reload();
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save the connection profile.",
      );
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">MnM</span>
        </div>

        <h1 className="text-xl font-semibold">Connect to a MnM instance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a name and the URL of your MnM backend to get started. You can
          add more instances later from Settings.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <div>
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Production"
              autoFocus
              autoComplete="off"
              disabled={isSubmitting}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="profile-url">Backend URL</Label>
            <Input
              id="profile-url"
              type="url"
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              placeholder="http://localhost:3000"
              autoComplete="off"
              spellCheck={false}
              disabled={isSubmitting}
              className="mt-1"
            />
          </div>

          {error !== null && (
            <p
              className="text-xs text-destructive"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting…
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
