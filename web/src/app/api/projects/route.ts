import { NextResponse } from "next/server";
import {
  loadRegistry,
  addProject,
} from "@/lib/core/project-registry";
import { eventBus } from "@/lib/events/event-bus";

export async function GET() {
  try {
    const registry = loadRegistry();
    return NextResponse.json({
      projects: registry.projects,
      activeProjectId: registry.activeProjectId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, path } = body as { name: string; path: string };
    if (!name || !path) {
      return NextResponse.json(
        { error: "name and path are required" },
        { status: 400 }
      );
    }
    const entry = addProject(name, path);
    eventBus.notify("projects");
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("already registered") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
