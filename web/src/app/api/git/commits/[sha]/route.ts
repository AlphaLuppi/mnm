import { NextRequest, NextResponse } from "next/server";
import { getCommitDetail } from "@/lib/git/repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sha: string }> }
) {
  try {
    const { sha } = await params;
    const detail = await getCommitDetail(sha);
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "GIT_COMMIT_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 }
    );
  }
}
