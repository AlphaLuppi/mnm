import { NextResponse } from "next/server";
import { getState, launchTask, isValidTaskType } from "@/lib/tasks/task-runner";

export async function GET() {
  return NextResponse.json(getState());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type } = body;

    if (!type || !isValidTaskType(type)) {
      return NextResponse.json(
        { error: `Invalid task type: ${type}` },
        { status: 400 }
      );
    }

    const task = launchTask(type);
    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
