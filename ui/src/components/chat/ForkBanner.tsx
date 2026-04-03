import { GitFork } from "lucide-react";

interface ForkBannerProps {
  forkedFromName?: string;
  forkedFromChannelId?: string;
}

export function ForkBanner({
  forkedFromName,
  forkedFromChannelId,
}: ForkBannerProps) {
  return (
    <div className="flex items-center gap-2 border-b border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300">
      <GitFork className="h-3.5 w-3.5 shrink-0" />
      <span>
        This conversation was forked
        {forkedFromName ? (
          <>
            {" "}from <strong>{forkedFromName}</strong>
          </>
        ) : null}
        .
        {forkedFromChannelId && (
          <button
            type="button"
            className="ml-1 underline hover:no-underline"
            onClick={() => {
              // Navigation to the original channel would be handled by the parent
              // For now, this is a placeholder
            }}
          >
            View original
          </button>
        )}
      </span>
    </div>
  );
}
