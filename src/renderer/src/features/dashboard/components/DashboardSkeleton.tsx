export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Chargement du cockpit"
      className="grid grid-cols-1 2xl:grid-cols-2 gap-4 p-6"
    >
      {/* Health summary skeleton */}
      <div className="col-span-full rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
        <div className="flex items-center gap-6">
          <div className="h-4 w-4 rounded-full bg-[var(--color-border)] animate-pulse" />
          <div className="h-5 w-40 rounded bg-[var(--color-border)] animate-pulse" />
          <div className="flex gap-4 ml-auto">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-6 w-10 rounded bg-[var(--color-border)] animate-pulse" />
                <div className="h-3 w-16 rounded bg-[var(--color-border)] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Widget skeletons */}
      <WidgetSkeleton />
      <WidgetSkeleton />

      {/* Stories skeleton — full width */}
      <div className="col-span-full rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-4 h-48 animate-pulse" />

      <span className="sr-only">Chargement en cours...</span>
    </div>
  )
}

function WidgetSkeleton() {
  return (
    <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
      <div className="h-5 w-32 rounded bg-[var(--color-border)] animate-pulse mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded bg-[var(--color-border)] animate-pulse" />
        ))}
      </div>
    </div>
  )
}
