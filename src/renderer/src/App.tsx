export function App(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-bg-base">
      <h1 className="text-xl font-bold text-text-primary">MnM</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Supervision cockpit for AI agent-driven development
      </p>
      <div className="mt-4 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-status-green" />
        <span className="text-xs text-text-muted">Ready</span>
      </div>
    </div>
  )
}
