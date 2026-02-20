import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { apiKey } = await request.json();

  if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("sk-")) {
    return NextResponse.json(
      { valid: false, error: "Invalid API key format. Key must start with 'sk-'." },
      { status: 400 }
    );
  }

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
      return NextResponse.json({ valid: true });
    }

    if (response.status === 401) {
      return NextResponse.json(
        { valid: false, error: "API key is invalid or expired." },
        { status: 400 }
      );
    }

    // Other statuses (rate limit, etc.) mean the key is likely valid
    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json(
      { valid: false, error: "Could not reach Claude API. Check your network connection." },
      { status: 500 }
    );
  }
}
