import { NextResponse } from "next/server";
import { loadConfig, saveConfig } from "@/lib/core/config";

export async function GET() {
  const config = loadConfig();
  return NextResponse.json({ settings: config });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const updated = saveConfig(body);
  return NextResponse.json({ settings: updated });
}
