import { afterAll, beforeAll, describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import {
  setupTestDb,
  teardownTestDb,
  cleanTestDb,
  createTestCompany,
  createTestUser,
} from "@mnm/test-utils";
import type { Db } from "@mnm/db";
import type { StorageService } from "../../storage/types.js";
import { soundSettingsRoutes } from "../sound-settings.js";

let db: Db;
let company: { id: string };
let user: { id: string };

const fakeStorage = {
  putFile: async (input: any) => ({
    provider: "local_disk" as const,
    objectKey: `sounds/test-${input.originalFilename ?? "x"}`,
    contentType: input.contentType,
    byteSize: input.body.length,
    sha256: "0".repeat(64),
    originalFilename: input.originalFilename ?? null,
  }),
} as unknown as StorageService;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = { type: "board", source: "local_implicit", userId: user.id };
    next();
  });
  app.use(soundSettingsRoutes(db, fakeStorage));
  // Minimal error handler so thrown authz errors map to status codes if needed.
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.status ?? 500).json({ error: err?.message ?? "error" });
  });
  return app;
}

beforeAll(async () => {
  db = await setupTestDb();
  await cleanTestDb(db);
  company = await createTestCompany(db, { name: "SND-ROUTES", issuePrefix: "SR" });
  user = await createTestUser(db);
}, 30_000);

afterAll(async () => {
  await cleanTestDb(db);
  await teardownTestDb(db);
});

describe("sound-settings routes", () => {
  it("GET returns defaults + empty sounds initially", async () => {
    const res = await request(buildApp()).get(`/companies/${company.id}/me/sound-settings`);
    expect(res.status).toBe(200);
    expect(res.body.settings.volume).toBe(70);
    expect(res.body.settings.enabled).toBe(true);
    expect(res.body.sounds).toEqual([]);
  });

  it("PUT updates volume", async () => {
    const res = await request(buildApp())
      .put(`/companies/${company.id}/me/sound-settings`)
      .send({ volume: 42 });
    expect(res.status).toBe(200);
    expect(res.body.settings.volume).toBe(42);
  });

  it("PUT rejects invalid volume", async () => {
    const res = await request(buildApp())
      .put(`/companies/${company.id}/me/sound-settings`)
      .send({ volume: 999 });
    expect(res.status).toBe(400);
  });

  it("POST uploads an audio file then GET lists it", async () => {
    const up = await request(buildApp())
      .post(`/companies/${company.id}/me/sounds`)
      .attach("file", Buffer.from("ID3fakeaudio"), { filename: "ding.mp3", contentType: "audio/mpeg" });
    expect(up.status).toBe(201);
    expect(up.body.sound.label).toBe("ding.mp3");

    const list = await request(buildApp()).get(`/companies/${company.id}/me/sounds`);
    expect(list.status).toBe(200);
    expect(list.body.sounds).toHaveLength(1);
    expect(list.body.sounds[0].label).toBe("ding.mp3");
  });

  it("POST rejects a non-audio file", async () => {
    const res = await request(buildApp())
      .post(`/companies/${company.id}/me/sounds`)
      .attach("file", Buffer.from("notaudio"), { filename: "x.txt", contentType: "text/plain" });
    expect(res.status).toBe(422);
  });
});
