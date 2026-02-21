import { NextResponse } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { runIncrementalDiscovery } from "@/lib/discovery/discovery-service";
import { handleApiError } from "@/lib/core/api-error-handler";
import { getMnMRoot } from "@/lib/core/paths";
import { eventBus } from "@/lib/events/event-bus";

export async function POST() {
  try {
    await ensureBootstrapped();
    const repoRoot = getMnMRoot();
    const summary = await runIncrementalDiscovery(repoRoot);
    eventBus.notifyMany(["discovery", "workflows", "dashboard"]);
    return NextResponse.json({ summary });
  } catch (err) {
    return handleApiError(err);
  }
}
