import { NextResponse } from "next/server";
import { getRepoInfo } from "@/lib/git/repository";

export async function GET() {
  try {
    const info = await getRepoInfo();

    if (!info.isRepo) {
      return NextResponse.json(info, { status: 404 });
    }

    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "GIT_STATUS_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 }
    );
  }
}
