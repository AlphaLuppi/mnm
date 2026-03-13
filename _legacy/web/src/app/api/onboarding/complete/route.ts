import { NextResponse } from "next/server";
import { saveConfig } from "@/lib/core/config";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "onboarding" });

export async function POST() {
  try {
    saveConfig({ onboardingCompleted: true });
    log.info("Onboarding completed");

    // Set cookie so middleware knows onboarding is complete
    const response = NextResponse.json({ success: true });
    response.cookies.set("mnm-onboarding-complete", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return response;
  } catch (err) {
    log.error({ error: err instanceof Error ? err.message : "unknown" }, "Failed to complete onboarding");
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
