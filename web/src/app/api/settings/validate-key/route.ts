import { NextResponse } from "next/server";
import {
  setAnthropicApiKey,
  setAnthropicOAuthToken,
  validateApiKey,
  buildAnthropicAuthHeaders,
  type AuthType,
} from "@/lib/core/config";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "validate-key" });

export async function POST(request: Request) {
  const body = await request.json();

  // Strip ALL whitespace — terminal line wrapping inserts spaces/newlines mid-token
  const apiKey =
    typeof body.apiKey === "string"
      ? body.apiKey.replace(/\s+/g, "")
      : body.apiKey;

  if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("sk-")) {
    return NextResponse.json(
      { valid: false, error: "Invalid key format. Key must start with 'sk-'." },
      { status: 400 }
    );
  }

  // Detect key type
  const validation = validateApiKey(apiKey);
  if (!validation.valid) {
    return NextResponse.json(
      { valid: false, error: "Invalid key format." },
      { status: 400 }
    );
  }

  const keyType: AuthType = validation.type;
  const isOAuthToken = keyType === "oauth_token";

  log.info(
    { keyType, prefix: apiKey.slice(0, 14), length: apiKey.length },
    "Validating token against Anthropic API"
  );

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        ...buildAnthropicAuthHeaders(apiKey, keyType),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (response.ok || response.status === 200) {
      if (isOAuthToken) {
        setAnthropicOAuthToken(apiKey);
      } else {
        setAnthropicApiKey(apiKey);
      }
      log.info({ keyType }, "Token validated and saved");
      return NextResponse.json({
        valid: true,
        saved: true,
        type: keyType,
        isOAuthToken,
      });
    }

    if (response.status === 401) {
      let respBody = "";
      try { respBody = await response.text(); } catch { /* ignore */ }
      log.warn({ status: 401, keyType, body: respBody.slice(0, 500) }, "Token rejected");
      const errorMsg = isOAuthToken
        ? "Setup token is invalid or expired. Run `claude setup-token` to generate a new one."
        : "API key is invalid or expired.";
      return NextResponse.json(
        { valid: false, error: errorMsg, isOAuthToken },
        { status: 400 }
      );
    }

    // Other statuses (rate limit, etc.) mean the key is likely valid
    if (isOAuthToken) {
      setAnthropicOAuthToken(apiKey);
    } else {
      setAnthropicApiKey(apiKey);
    }
    log.info({ keyType, status: response.status }, "Non-401 status — token accepted");
    return NextResponse.json({
      valid: true,
      saved: true,
      type: keyType,
      isOAuthToken,
    });
  } catch (err) {
    log.error(
      { error: err instanceof Error ? err.message : String(err) },
      "Network error calling Anthropic API"
    );
    return NextResponse.json(
      { valid: false, error: "Could not reach Claude API. Check your network connection." },
      { status: 500 }
    );
  }
}
