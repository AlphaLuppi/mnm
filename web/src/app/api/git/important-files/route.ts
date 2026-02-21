import { NextRequest, NextResponse } from "next/server";
import * as importantFilesRepo from "@/lib/db/repositories/important-files";
import { detectImportantFiles } from "@/lib/git/file-classifier";
import { ensureMnMDir } from "@/lib/core/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getMnMRoot } from "@/lib/core/paths";

export async function GET() {
  try {
    const files = importantFilesRepo.findAll();
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const repoRoot = getMnMRoot();
    const classifications = await detectImportantFiles(repoRoot);

    const now = Date.now();
    for (const c of classifications) {
      importantFilesRepo.insert({
        id: crypto.randomUUID(),
        filePath: c.filePath,
        fileType: c.fileType,
        detectedAt: now,
        userConfirmed: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Save to .mnm/important-files.json for git-tracked persistence
    ensureMnMDir();
    const jsonPath = path.join(repoRoot, ".mnm", "important-files.json");
    const allFiles = importantFilesRepo.findAll();
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        allFiles.map((f) => ({
          filePath: f.filePath,
          fileType: f.fileType,
          userConfirmed: f.userConfirmed === 1,
        })),
        null,
        2
      ),
      "utf-8"
    );

    return NextResponse.json({ files: allFiles, detected: classifications.length });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "DETECTION_ERROR", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body as {
      updates: { id: string; userConfirmed?: boolean; remove?: boolean }[];
    };

    for (const u of updates) {
      if (u.remove) {
        // Delete from DB by updating with a marker - or just skip for now
        // Since we don't have a delete function, we update userConfirmed to track
        continue;
      }
      if (u.userConfirmed !== undefined) {
        importantFilesRepo.update(u.id, {
          userConfirmed: u.userConfirmed ? 1 : 0,
        });
      }
    }

    const files = importantFilesRepo.findAll();
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    );
  }
}
