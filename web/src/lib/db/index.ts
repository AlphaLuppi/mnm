import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import { getDatabasePath, ensureMnMDir } from "@/lib/core/config";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

function ensureTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      spec_id TEXT,
      scope TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS specs (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      spec_type TEXT NOT NULL,
      title TEXT,
      last_modified INTEGER NOT NULL,
      git_commit_sha TEXT,
      content_hash TEXT NOT NULL,
      workflow_stage TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS drift_detections (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      spec_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      drift_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      diff_content TEXT,
      user_decision TEXT,
      decided_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS file_locks (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      lock_type TEXT NOT NULL,
      acquired_at INTEGER NOT NULL,
      released_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS important_files (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      file_type TEXT NOT NULL,
      detected_at INTEGER NOT NULL,
      user_confirmed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS commit_associations (
      id TEXT PRIMARY KEY,
      commit_sha TEXT NOT NULL,
      spec_id TEXT NOT NULL,
      reference_type TEXT NOT NULL,
      commit_message TEXT NOT NULL,
      commit_author TEXT,
      commit_date TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS spec_changes (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      old_commit_sha TEXT,
      new_commit_sha TEXT NOT NULL,
      change_summary TEXT NOT NULL,
      detected_at INTEGER NOT NULL,
      user_viewed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      phase TEXT,
      source_path TEXT NOT NULL,
      steps_json TEXT,
      metadata TEXT,
      discovered_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id),
      status TEXT NOT NULL DEFAULT 'pending',
      started_at INTEGER,
      completed_at INTEGER,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS discovery_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      classification TEXT,
      name TEXT,
      metadata TEXT,
      llm_model TEXT,
      discovered_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cross_doc_drifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_spec_id TEXT REFERENCES specs(id),
      target_spec_id TEXT REFERENCES specs(id),
      drift_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      source_text TEXT,
      target_text TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      resolved_at INTEGER,
      resolution_rationale TEXT,
      detected_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS drift_scan_runs (
      id TEXT PRIMARY KEY,
      spec_id TEXT REFERENCES specs(id),
      scope TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      drift_detection_id TEXT REFERENCES drift_detections(id),
      error_message TEXT,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

export function getDb() {
  if (!_db) {
    ensureMnMDir();
    const dbPath = getDatabasePath();
    _sqlite = new Database(dbPath);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");
    ensureTables(_sqlite);
    _db = drizzle(_sqlite, { schema });
  }
  return _db;
}

export function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}

export { schema };
