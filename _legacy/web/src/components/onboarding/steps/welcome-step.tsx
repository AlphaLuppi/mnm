export function WelcomeStep() {
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-2xl font-bold">Welcome to MnM</h2>
      <p className="text-lg text-muted-foreground">Product-First ADE</p>
      <p className="text-sm text-muted-foreground">
        MnM helps you orchestrate AI agents, track specification drift, and
        maintain alignment between your product vision and implementation.
      </p>
      <p className="text-sm text-muted-foreground">
        This wizard will help you configure your project in under 2 minutes.
      </p>
    </div>
  );
}
