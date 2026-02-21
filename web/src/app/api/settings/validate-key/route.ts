import { NextResponse } from "next/server";
import {
  setAnthropicApiKey,
  setAnthropicOAuthToken,
  validateApiKey,
  type AuthType,
} from "@/lib/core/config";

export async function POST(request: Request) {
  const { apiKey, save } = await request.json();

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

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
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
      // Save the key if requested and valid
      if (save) {
        if (isOAuthToken) {
          setAnthropicOAuthToken(apiKey);
        } else {
          setAnthropicApiKey(apiKey);
        }
      }
      return NextResponse.json({
        valid: true,
        saved: !!save,
        type: keyType,
        isOAuthToken,
      });
    }

    if (response.status === 401) {
      const errorMsg = isOAuthToken
        ? "OAuth token rejected. Anthropic restricts subscription tokens to Claude Code only."
        : "API key is invalid or expired.";
      return NextResponse.json(
        { valid: false, error: errorMsg, isOAuthToken },
        { status: 400 }
      );
    }

    // Other statuses (rate limit, etc.) mean the key is likely valid
    if (save) {
      if (isOAuthToken) {
        setAnthropicOAuthToken(apiKey);
      } else {
        setAnthropicApiKey(apiKey);
      }
    }
    return NextResponse.json({
      valid: true,
      saved: !!save,
      type: keyType,
      isOAuthToken,
    });
  } catch {
    return NextResponse.json(
      { valid: false, error: "Could not reach Claude API. Check your network connection." },
      { status: 500 }
    );
  }
}
