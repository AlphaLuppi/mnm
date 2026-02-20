import { NextResponse } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { runFullDiscovery } from "@/lib/discovery/discovery-service";
import { handleApiError } from "@/lib/core/api-error-handler";

export async function POST() {
  try {
    await ensureBootstrapped();
    const repoRoot = process.env.MNM_REPO_ROOT ?? process.cwd();
    const summary = await runFullDiscovery(repoRoot);
    return NextResponse.json({ summary }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
