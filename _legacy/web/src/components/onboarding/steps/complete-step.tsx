import { CheckCircle2 } from "lucide-react";

export function CompleteStep() {
  return (
    <div className="space-y-4 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
      <h2 className="text-2xl font-bold">Setup Complete!</h2>
      <p className="text-sm text-muted-foreground">
        MnM is ready to use. You can browse specs, launch agents, and track
        drift from the dashboard.
      </p>
      <p className="text-xs text-muted-foreground">
        You can re-run this setup anytime from Settings.
      </p>
    </div>
  );
}
