import { NextResponse } from "next/server";
import { getAnthropicCredentials, type AuthType } from "@/lib/core/config";

interface AuthStatus {
  configured: boolean;
  source: "env" | "config" | "none";
  authType: AuthType | null;
  maskedToken: string | null;
  label: string;
}

function maskToken(token: string): string {
  if (token.length <= 12) return "****";
  return token.slice(0, 10) + "..." + token.slice(-4);
}

export async function GET() {
  const creds = getAnthropicCredentials();

  if (!creds) {
    const status: AuthStatus = {
      configured: false,
      source: "none",
      authType: null,
      maskedToken: null,
      label: "Not configured",
    };
    return NextResponse.json(status);
  }

  const fromEnv = !!process.env.ANTHROPIC_API_KEY;
  const status: AuthStatus = {
    configured: true,
    source: fromEnv ? "env" : "config",
    authType: creds.type,
    maskedToken: maskToken(creds.token),
    label: creds.type === "oauth_token" ? "Setup Token" : "API Key",
  };

  return NextResponse.json(status);
}
