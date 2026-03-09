import { NextResponse } from "next/server";
import { getAggregates } from "@/lib/core/performance";

export async function GET() {
  const metrics = getAggregates();
  return NextResponse.json({ metrics });
}

export async function POST(request: Request) {
  // Accept client-side metrics (FPS, page load time)
  const body = await request.json();
  // For POC, just acknowledge receipt
  return NextResponse.json({ received: true, metrics: body });
}
