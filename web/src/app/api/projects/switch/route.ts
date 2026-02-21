import { NextResponse } from "next/server";
import { switchProject } from "@/lib/core/project-registry";
import { eventBus } from "@/lib/events/event-bus";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId } = body as { projectId: string };
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }
    const project = switchProject(projectId);
    // Notify all channels — everything changes on project switch
    eventBus.notifyMany([
      "projects", "tasks", "agents", "drift", "drift-status",
      "cross-doc-drift", "dashboard", "workflows", "discovery",
    ]);
    return NextResponse.json(project);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
