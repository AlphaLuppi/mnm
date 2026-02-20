import { NextResponse } from "next/server";
import { closeDb } from "@/lib/db";
import { getDatabasePath } from "@/lib/core/config";
import fs from "node:fs";

export async function POST() {
  try {
    closeDb();
    const dbPath = getDatabasePath();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // WAL and SHM files
    for (const suffix of ["-wal", "-shm"]) {
      const p = dbPath + suffix;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to clear database" },
      { status: 500 }
    );
  }
}
