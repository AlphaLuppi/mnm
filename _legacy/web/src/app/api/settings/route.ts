import { NextResponse } from "next/server";
import { loadConfig, saveConfig } from "@/lib/core/config";

export async function GET() {
  const config = loadConfig();

  // Strip raw tokens from response — use /api/settings/auth-status instead
  const { anthropicApiKey, anthropicOAuthToken, ...safe } = config;
  return NextResponse.json({
    settings: {
      ...safe,
      hasApiKey: !!anthropicApiKey,
      hasOAuthToken: !!anthropicOAuthToken,
    },
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();

  // Block direct token writes — force through validate-key endpoint
  delete body.anthropicApiKey;
  delete body.anthropicOAuthToken;

  const updated = saveConfig(body);

  // Strip tokens from response
  const { anthropicApiKey, anthropicOAuthToken, ...safe } = updated;
  return NextResponse.json({
    settings: {
      ...safe,
      hasApiKey: !!anthropicApiKey,
      hasOAuthToken: !!anthropicOAuthToken,
    },
  });
}
