/**
 * Minimal "Add instance" dialog triggered from the profile switcher.
 *
 * Mirrors the validation rules of NoProfileGate (name >= 1 char, URL must
 * start with http:// or https://) so both entry points behave identically.
 * On success, notifies the parent via `onAdded` — the parent decides
 * whether to reload, splice into the list, or switch active.
 *
 * Intentionally does not call `setActiveProfile` after the add: we want
 * the switcher to keep the current instance focused until the user
 * explicitly picks the new one from the menu, so they can review the
 * added entry before committing to the connection.
 */
import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addProfile } from "@/lib/profile-client";
import type { Profile } from "@/lib/profile-types";

interface AddProfileDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onAdded: (profile: Profile) => void;
}

function isValidUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

export function AddProfileDialog({
  open,
  onOpenChange,
  onAdded,
}: AddProfileDialogProps): ReactElement {
  const [displayName, setDisplayName] = useState<string>("");
  const [apiBaseUrl, setApiBaseUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Reset the form state whenever the dialog is closed so reopens always
  // start clean. This matches the Linear/Slack behavior where a closed
  // dialog is conceptually the absence of an in-flight form.
  useEffect(() => {
    if (open) return;
    setDisplayName("");
    setApiBaseUrl("");
    setError(null);
    setIsSubmitting(false);
  }, [open]);

  const canSubmit =
    !isSubmitting &&
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
      const created = await addProfile({ displayName: name, apiBaseUrl: url });
      onAdded(created);
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="desktop-add-profile-dialog"
      >
        <DialogHeader>
          <DialogTitle>Add an instance</DialogTitle>
          <DialogDescription>
            Connect MnM Desktop to another backend. The active instance
            stays focused until you pick the new one from the switcher.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="add-profile-name">Name</Label>
            <Input
              id="add-profile-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Staging"
              autoFocus
              autoComplete="off"
              disabled={isSubmitting}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="add-profile-url">Backend URL</Label>
            <Input
              id="add-profile-url"
              type="url"
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              placeholder="https://staging.example.com"
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
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add instance"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
