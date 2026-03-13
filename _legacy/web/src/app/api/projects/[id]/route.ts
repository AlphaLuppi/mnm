import { NextResponse } from "next/server";
import { removeProject } from "@/lib/core/project-registry";
import { eventBus } from "@/lib/events/event-bus";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    removeProject(id);
    eventBus.notify("projects");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("active project") ? 400 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}
