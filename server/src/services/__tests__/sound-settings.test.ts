import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import {
  setupTestDb,
  teardownTestDb,
  cleanTestDb,
  createTestCompany,
  createTestUser,
} from "@mnm/test-utils";
import { type Db, assets } from "@mnm/db";
import { soundSettingsService } from "../sound-settings.js";
import { DEFAULT_SOUND_SETTINGS } from "@mnm/shared";

let db: Db;
let company: { id: string };
let user: { id: string };
let otherUser: { id: string };

beforeAll(async () => {
  db = await setupTestDb();
  await cleanTestDb(db);
  company = await createTestCompany(db, { name: "SND-SVC", issuePrefix: "SS" });
  user = await createTestUser(db);
  otherUser = await createTestUser(db);
  await db.execute(sql`SELECT set_config('app.current_company_id', ${company.id}, false)`);
}, 30_000);

afterAll(async () => {
  await cleanTestDb(db);
  await teardownTestDb(db);
});

describe("soundSettingsService", () => {
  const svc = () => soundSettingsService(db);

  describe("get", () => {
    it("returns DEFAULT_SOUND_SETTINGS when no row exists", async () => {
      const result = await svc().get(company.id, user.id);
      expect(result).toEqual(DEFAULT_SOUND_SETTINGS);
    });
  });

  describe("upsert + get round-trip", () => {
    it("persists volume change and returns it on get", async () => {
      await svc().upsert(company.id, user.id, { volume: 30 });
      const result = await svc().get(company.id, user.id);
      expect(result.volume).toBe(30);
      // tones should remain defaults
      expect(result.tones).toEqual(DEFAULT_SOUND_SETTINGS.tones);
    });
  });

  describe("upsert merges partial tones without clobbering others", () => {
    it("merges tones and preserves previous values", async () => {
      // First upsert: set volume=30 (already done above, but repeat for clarity)
      await svc().upsert(company.id, user.id, { volume: 30 });
      // Second upsert: only update success tone
      await svc().upsert(company.id, user.id, { tones: { success: "builtin:chime" } });

      const result = await svc().get(company.id, user.id);
      expect(result.volume).toBe(30);
      expect(result.tones.success).toBe("builtin:chime");
      expect(result.tones.info).toBe("none"); // untouched
      expect(result.tones.warn).toBe("none"); // untouched
      expect(result.tones.error).toBe("none"); // untouched
    });
  });

  describe("listUserSounds", () => {
    it("returns only sounds-namespaced assets for the given user", async () => {
      const DUMMY_SHA256 = "x".repeat(64);

      // Sound asset for user
      await db.insert(assets).values({
        companyId: company.id,
        createdByUserId: user.id,
        provider: "local_disk",
        objectKey: "sounds/2026/x.mp3",
        contentType: "audio/mpeg",
        byteSize: 100,
        sha256: DUMMY_SHA256,
        originalFilename: "x.mp3",
      });

      // Non-sound asset for user (should be excluded)
      await db.insert(assets).values({
        companyId: company.id,
        createdByUserId: user.id,
        provider: "local_disk",
        objectKey: "assets/images/y.png",
        contentType: "image/png",
        byteSize: 200,
        sha256: "y".repeat(64),
        originalFilename: "y.png",
      });

      // Sound asset for a different user (should be excluded)
      await db.insert(assets).values({
        companyId: company.id,
        createdByUserId: otherUser.id,
        provider: "local_disk",
        objectKey: "sounds/2026/other.mp3",
        contentType: "audio/mpeg",
        byteSize: 150,
        sha256: "z".repeat(64),
        originalFilename: "other.mp3",
      });

      const result = await svc().listUserSounds(company.id, user.id);

      expect(result).toHaveLength(1);
      expect(result[0]!.label).toBe("x.mp3");
      expect(result[0]!.contentType).toBe("audio/mpeg");
      expect(typeof result[0]!.id).toBe("string");
    });
  });
});
