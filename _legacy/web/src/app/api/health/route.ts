import { NextResponse } from "next/server";

const startTime = Date.now();

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: process.env.npm_package_version ?? "0.1.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
}
