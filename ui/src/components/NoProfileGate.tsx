/**
 * First-run wizard shown in packaged desktop builds when no connection
 * profile is active. Guides the user through picking between a local
 * instance (Docker on their own machine) and a remote instance (a
 * company server), then persists the profile via the Tauri bridge and
 * reloads the window to restart the boot sequence with a populated
 * profile cache.
 *
 * Must run BEFORE React Router mounts — do not import `useNavigate` or
 * any router hook here. The wizard is rendered by `main.tsx` directly
 * without any of the app's providers.
 */
import { useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  HardDrive,
  Loader2,
  Server,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addProfile } from "@/lib/profile-client";

/**
 * Default URL for a local instance. Matches the docker-compose default
 * documented in the backend repo. Editable by the user on the Local
 * step in case they run the backend on a non-standard port.
 */
const LOCAL_DEFAULT_URL = "http://localhost:3100";

/**
 * External setup guide. Users without a backend land here to request
 * access to the private distribution. Same URL as the fallback page in
 * `ui/index.html`'s pre-mount error handler. If we ever replace this
 * with a gated contact form, both places must move together.
 */
const SETUP_GUIDE_URL = "https://mnm.alphaluppi.fr/#setup";

type WizardStep = "welcome" | "local" | "remote";

function isValidUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

interface WizardShellProps {
  children: ReactNode;
  onBack?: () => void;
}

/**
 * Shared full-screen layout for every wizard step. Keeps the skipped-
 * traffic-lights offset at the top so the window is still draggable
 * even on the Welcome step where `DesktopTitleBar` self-hides.
 */
function WizardShell({ children, onBack }: WizardShellProps): ReactElement {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6 pt-12">
      <div className="w-full max-w-2xl">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">MnM</span>
          </div>
          {onBack && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              data-testid="wizard-back"
              className="text-muted-foreground"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </Button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

interface ModeCardProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  caption: string;
  onClick: () => void;
  testId: string;
}

function ModeCard({
  icon,
  title,
  subtitle,
  caption,
  onClick,
  testId,
}: ModeCardProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="group flex h-full flex-col items-start rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-foreground/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="mb-4 text-foreground/80">{icon}</div>
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
      <div className="mt-4 border-t border-border/60 pt-3 text-[11px] uppercase tracking-[0.15em] text-muted-foreground/80">
        {caption}
      </div>
      <div className="mt-auto flex w-full items-center justify-end pt-6 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
        Continue
        <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </div>
    </button>
  );
}

interface WelcomeStepProps {
  onPick: (mode: "local" | "remote") => void;
}

function WelcomeStep({ onPick }: WelcomeStepProps): ReactElement {
  return (
    <WizardShell>
      <h1 className="text-2xl font-semibold">Connect to a MnM instance</h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        MnM Desktop is a thin client — it needs a backend to talk to.
        Pick the setup that matches your situation. You can add more
        instances later from the title-bar switcher.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ModeCard
          icon={<HardDrive className="h-6 w-6" />}
          title="Local instance"
          subtitle="Run MnM on your own machine via Docker. For solo use and evaluations."
          caption="Requires Docker"
          onClick={() => onPick("local")}
          testId="wizard-mode-local"
        />
        <ModeCard
          icon={<Server className="h-6 w-6" />}
          title="Remote instance"
          subtitle="Connect to your company's MnM server. For teams already running MnM."
          caption="URL provided by your admin"
          onClick={() => onPick("remote")}
          testId="wizard-mode-remote"
        />
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Don't have a backend yet?{" "}
        <a
          href={SETUP_GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-2 hover:text-foreground/80"
          data-testid="wizard-setup-link"
        >
          Open the setup guide
        </a>{" "}
        to request access to the distribution.
      </p>
    </WizardShell>
  );
}

interface ConnectStepProps {
  mode: "local" | "remote";
  onBack: () => void;
  onSubmit: (name: string, url: string) => Promise<void>;
}

function ConnectStep({
  mode,
  onBack,
  onSubmit,
}: ConnectStepProps): ReactElement {
  const initialName = mode === "local" ? "Local" : "";
  const initialUrl = mode === "local" ? LOCAL_DEFAULT_URL : "";

  const [displayName, setDisplayName] = useState<string>(initialName);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const canSubmit =
    !isSubmitting &&
    displayName.trim().length >= 1 &&
    apiBaseUrl.trim().length > 0 &&
    isValidUrl(apiBaseUrl.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
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
      await onSubmit(name, url);
      // Parent handles the reload; keep isSubmitting true so the
      // button stays locked during the reload window.
    } catch (err: unknown) {
      setIsSubmitting(false);
      // Tauri 2 rejects invoke() with a bare string, not an Error. Cover
      // every shape so the real message bubbles up to the user instead
      // of the generic fallback.
      let message: string;
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "string") {
        message = err;
      } else {
        message = `Failed to save the connection profile: ${String(err)}`;
      }
      setError(message);
    }
  }

  const title =
    mode === "local" ? "Connect to your local backend" : "Connect to your instance";
  const subtitle =
    mode === "local"
      ? "Make sure your MnM backend is running (docker compose up) before continuing. You can edit the port if it isn't on 3100."
      : "Ask your admin for the URL of your company's MnM instance. You'll need a valid account on that backend to sign in after connecting.";

  return (
    <WizardShell onBack={onBack}>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">{subtitle}</p>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <Label htmlFor="wizard-name">Name</Label>
          <Input
            id="wizard-name"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={mode === "local" ? "Local" : "Production"}
            autoFocus={mode === "remote"}
            autoComplete="off"
            disabled={isSubmitting}
            className="mt-1"
            data-testid="wizard-input-name"
          />
        </div>
        <div>
          <Label htmlFor="wizard-url">Backend URL</Label>
          <Input
            id="wizard-url"
            type="url"
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            placeholder={
              mode === "local" ? LOCAL_DEFAULT_URL : "https://mnm.yourcompany.com"
            }
            autoComplete="off"
            spellCheck={false}
            disabled={isSubmitting}
            className="mt-1"
            data-testid="wizard-input-url"
          />
          {mode === "remote" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Looks like <code className="rounded bg-muted px-1 py-0.5 text-[11px]">https://mnm.yourcompany.com</code>. Ask your admin if you're not sure.
            </p>
          )}
        </div>

        {error !== null && (
          <p
            className="text-xs text-destructive"
            role="alert"
            aria-live="polite"
            data-testid="wizard-error"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full"
          data-testid="wizard-submit"
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

      {mode === "local" && (
        <p className="mt-8 text-xs text-muted-foreground">
          Not sure how to start the backend?{" "}
          <a
            href={SETUP_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2 hover:text-foreground/80"
            data-testid="wizard-setup-link"
          >
            Open the setup guide
          </a>
          .
        </p>
      )}
    </WizardShell>
  );
}

export function NoProfileGate(): ReactElement {
  const [step, setStep] = useState<WizardStep>("welcome");

  async function handleConnect(name: string, url: string): Promise<void> {
    await addProfile({ displayName: name, apiBaseUrl: url });
    // Reload the window so main.tsx re-runs its boot gate and renders
    // the real app with the newly-active profile.
    window.location.reload();
  }

  if (step === "welcome") {
    return <WelcomeStep onPick={(mode) => setStep(mode)} />;
  }
  return (
    <ConnectStep
      mode={step}
      onBack={() => setStep("welcome")}
      onSubmit={handleConnect}
    />
  );
}
