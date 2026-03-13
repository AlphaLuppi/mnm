import { NextResponse } from "next/server";

// Terminal WebSocket runs on a separate port
const TERMINAL_WS_PORT = 3001;

export async function GET() {
  return NextResponse.json({
    wsUrl: `ws://localhost:${TERMINAL_WS_PORT}`,
    port: TERMINAL_WS_PORT,
  });
}
