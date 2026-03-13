import { NextRequest, NextResponse } from "next/server";
import { getMnMRoot } from "@/lib/core/paths";
import simpleGit from "simple-git";
import { parseUnifiedDiff } from "@/lib/git/diff-parser";

export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get("file");
  const base = request.nextUrl.searchParams.get("base");
  const head = request.nextUrl.searchParams.get("head");
  const repoRoot = getMnMRoot();

  if (!file) {
    return NextResponse.json(
      { error: { code: "MISSING_PARAM", message: "file parameter required" } },
      { status: 400 }
    );
  }

  try {
    const git = simpleGit(repoRoot);

    let diffText: string;

    if (base && head) {
      // Diff between two commits
      diffText = await git.diff([`${base}..${head}`, "--", file]);
    } else if (base) {
      // Diff between commit and working tree
      diffText = await git.diff([base, "--", file]);
    } else {
      // Diff of uncommitted changes
      diffText = await git.diff(["--", file]);
    }

    const parsed = parseUnifiedDiff(diffText, file);

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "GIT_DIFF_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 }
    );
  }
}
