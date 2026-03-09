import { NextResponse } from "next/server";
import { getTask, cancelTask } from "@/lib/tasks/task-runner";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = getTask(id);

  if (!task) {
    return NextResponse.json(
      { error: `Task not found: ${id}` },
      { status: 404 }
    );
  }

  return NextResponse.json(task);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cancelled = cancelTask(id);

  if (!cancelled) {
    return NextResponse.json(
      { error: `Task not found or already finished: ${id}` },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
