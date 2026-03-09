export function PrivacyNotice() {
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="font-medium">Privacy Policy</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
        <li>All data is stored locally in the <code>.mnm/</code> directory</li>
        <li>
          The only external calls go to the Claude API
          (api.anthropic.com)
        </li>
        <li>No telemetry is collected by default</li>
        <li>
          You can inspect all stored data by browsing <code>.mnm/</code>
        </li>
      </ul>
    </div>
  );
}
