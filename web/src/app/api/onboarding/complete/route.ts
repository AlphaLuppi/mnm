import { NextResponse } from "next/server";
import { saveConfig } from "@/lib/core/config";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "onboarding" });

export async function POST() {
  try {
    saveConfig({ onboardingCompleted: true });
    log.info("Onboarding completed");
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ error: err instanceof Error ? err.message : "unknown" }, "Failed to complete onboarding");
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
