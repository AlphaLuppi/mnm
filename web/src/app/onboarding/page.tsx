"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WelcomeStep } from "@/components/onboarding/steps/welcome-step";
import { RepoSelectStep } from "@/components/onboarding/steps/repo-select-step";
import { ApiKeyStep } from "@/components/onboarding/steps/api-key-step";
import { DetectFilesStep } from "@/components/onboarding/steps/detect-files-step";
import { DiscoveryStep } from "@/components/onboarding/steps/discovery-step";
import { CompleteStep } from "@/components/onboarding/steps/complete-step";

const STEPS = [
  "Welcome",
  "Repository",
  "API Key",
  "Detect Files",
  "Discovery",
  "Complete",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [repoPath, setRepoPath] = useState("");
  const [apiKeyValid, setApiKeyValid] = useState(false);

  function handleSkip() {
    fetch("/api/onboarding/complete", { method: "POST" }).then(() =>
      router.push("/")
    );
  }

  function handleComplete() {
    fetch("/api/onboarding/complete", { method: "POST" }).then(() =>
      router.push("/")
    );
  }

  const lastStep = STEPS.length - 1;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          {/* Step indicator */}
          <div className="mb-6 flex items-center justify-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                    i === step
                      ? "bg-primary text-primary-foreground"
                      : i < step
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-px w-6 ${i < step ? "bg-primary" : "bg-muted"}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Steps */}
          {step === 0 && <WelcomeStep />}
          {step === 1 && (
            <RepoSelectStep value={repoPath} onChange={setRepoPath} />
          )}
          {step === 2 && (
            <ApiKeyStep onValidated={(valid) => setApiKeyValid(valid)} />
          )}
          {step === 3 && <DetectFilesStep repoPath={repoPath} />}
          {step === 4 && <DiscoveryStep />}
          {step === 5 && <CompleteStep />}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <div>
              {step > 0 && step < lastStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep((s) => s - 1)}
                >
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step < lastStep && (
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  Skip Setup
                </Button>
              )}
              {step < lastStep - 1 && (
                <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
              )}
              {step === lastStep - 1 && (
                <Button onClick={() => setStep(lastStep)}>Finish</Button>
              )}
              {step === lastStep && (
                <Button onClick={handleComplete}>Open Dashboard</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
