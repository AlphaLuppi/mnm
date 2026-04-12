/**
 * Full-screen error gate shown in packaged desktop builds when the active
 * connection profile's backend is unreachable at boot time.
 *
 * Must run BEFORE React Router mounts — do not import `useNavigate` or any
 * router hook here.
 */
import { useState, type ReactElement } from "react";
import { Loader2, WifiOff, ServerCrash, Clock, ExternalLink, RefreshCw, ArrowLeftRight } from "lucide-react";

const DOCS_URL = "https://github.com/mnm-team/mnm";

const REASON_LABELS: Record<
  "timeout" | "network" | "server-error",
  { title: string; hint: string }
> = {
  timeout: {
    title: "Connection timed out",
    hint: "The backend did not respond in time. It may be starting up, or the URL could be wrong.",
  },
  network: {
    title: "Network error",
    hint: "Could not reach the backend at all. Make sure the server is running and the URL is correct.",
  },
  "server-error": {
    title: "Server error",
    hint: "The backend responded, but returned an error. It may still be initializing.",
  },
};

const REASON_ICONS: Record<
  "timeout" | "network" | "server-error",
  typeof WifiOff
> = {
  timeout: Clock,
  network: WifiOff,
  "server-error": ServerCrash,
};

interface BackendUnreachableProps {
  profileName: string;
  apiBaseUrl: string;
  reason: "timeout" | "network" | "server-error";
  message: string;
  onRetry: () => void;
  onSwitchProfile: () => void;
}

export function BackendUnreachable({
  profileName,
  apiBaseUrl,
  reason,
  message,
  onRetry,
  onSwitchProfile,
}: BackendUnreachableProps): ReactElement {
  const [retrying, setRetrying] = useState(false);

  const { title, hint } = REASON_LABELS[reason];
  const Icon = REASON_ICONS[reason];

  function handleRetry(): void {
    setRetrying(true);
    onRetry();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-stone-950 text-stone-100 p-6">
      <div className="w-full max-w-lg">
        {/* Icon + badge */}
        <div className="flex items-center gap-3 mb-8">
          <Icon className="h-5 w-5 text-stone-400" />
          <span
            className="text-[11px] uppercase tracking-[0.2em] text-stone-500"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            Backend unreachable
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-semibold text-stone-50 mb-2">
          {title}
        </h1>
        <p className="text-sm text-stone-400 leading-relaxed mb-6">
          {hint}
        </p>

        {/* Profile info card */}
        <div className="rounded-md border border-stone-800 bg-stone-900/50 p-4 mb-6">
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="text-stone-500 shrink-0">Profile</dt>
              <dd className="text-stone-200 truncate">{profileName}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-stone-500 shrink-0">URL</dt>
              <dd
                className="text-stone-200 truncate"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              >
                {apiBaseUrl}
              </dd>
            </div>
          </dl>
        </div>

        {/* Error detail */}
        <details className="mb-8 rounded-md border border-stone-800 bg-stone-900/50">
          <summary
            className="cursor-pointer px-4 py-3 text-xs text-stone-500 uppercase tracking-widest"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            Error details
          </summary>
          <pre
            className="px-4 pb-3 text-xs text-red-400 whitespace-pre-wrap break-words"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            {message}
          </pre>
        </details>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 rounded-md bg-stone-50 px-5 py-2.5 text-sm font-medium text-stone-950 hover:bg-white transition-colors disabled:opacity-60"
          >
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {retrying ? "Retrying..." : "Retry"}
          </button>

          <button
            type="button"
            onClick={onSwitchProfile}
            className="inline-flex items-center gap-2 rounded-md border border-stone-700 px-5 py-2.5 text-sm font-medium text-stone-200 hover:bg-stone-900 transition-colors"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Switch Profile
          </button>

          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-stone-700 px-5 py-2.5 text-sm font-medium text-stone-200 hover:bg-stone-900 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Setup Backend
          </a>
        </div>

        {/* Footer */}
        <p
          className="mt-16 text-[10px] uppercase tracking-[0.2em] text-stone-600"
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        >
          MnM — Make No Mistake — Studio Manifeste
        </p>
      </div>
    </div>
  );
}
