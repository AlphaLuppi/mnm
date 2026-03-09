import { NextResponse } from "next/server";
import { loadConfig, getAnthropicApiKey } from "@/lib/core/config";
import { getClaudeCLIStatus } from "@/lib/claude/cli";

export async function GET() {
  try {
    const config = loadConfig();
    const apiKey = getAnthropicApiKey();

    // Check if Claude CLI is installed and authenticated
    const cliStatus = await getClaudeCLIStatus();

    // User can chat if they have CLI authenticated OR an API key
    const canChat = (cliStatus.installed && cliStatus.authenticated) || !!apiKey;

    const response = NextResponse.json({
      onboardingCompleted: config.onboardingCompleted,
      hasApiKey: !!apiKey,
      claudeCLIInstalled: cliStatus.installed,
      claudeCLIAuthenticated: cliStatus.authenticated,
      claudeCLIVersion: cliStatus.version,
      canChat,
    });

    // If onboarding is already completed in config, also set the cookie
    if (config.onboardingCompleted) {
      response.cookies.set("mnm-onboarding-complete", "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return response;
  } catch (err) {
    console.error("Onboarding status check error:", err);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
