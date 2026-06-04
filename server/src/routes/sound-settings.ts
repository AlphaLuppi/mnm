import { Router } from "express";
import multer from "multer";
import type { Db } from "@mnm/db";
import { updateSoundSettingsSchema } from "@mnm/shared";
import type { StorageService } from "../storage/types.js";
import { soundSettingsService, assetService } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

const MAX_SOUND_BYTES = Number(process.env.MNM_SOUND_MAX_BYTES) || 2 * 1024 * 1024;
const ALLOWED_SOUND_CONTENT_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
]);

export function soundSettingsRoutes(db: Db, storage: StorageService) {
  const router = Router();
  const svc = soundSettingsService(db);
  const assetsSvc = assetService(db);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SOUND_BYTES, files: 1 },
  });

  const runUpload = (req: any, res: any) =>
    new Promise<void>((resolve, reject) => {
      upload.single("file")(req, res, (err: unknown) => (err ? reject(err) : resolve()));
    });

  router.get("/companies/:companyId/me/sound-settings", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const userId = req.actor.userId!;
    const settings = await svc.get(companyId, userId);
    const sounds = await svc.listUserSounds(companyId, userId);
    res.json({ settings, sounds });
  });

  router.put("/companies/:companyId/me/sound-settings", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const userId = req.actor.userId!;
    const parsed = updateSoundSettingsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid sound settings", details: parsed.error.issues });
      return;
    }
    const settings = await svc.upsert(companyId, userId, parsed.data);
    res.json({ settings });
  });

  router.get("/companies/:companyId/me/sounds", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const userId = req.actor.userId!;
    res.json({ sounds: await svc.listUserSounds(companyId, userId) });
  });

  router.post("/companies/:companyId/me/sounds", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    try {
      await runUpload(req, res);
    } catch (err) {
      if (err instanceof multer.MulterError) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 422 : 400;
        res.status(status).json({ error: err.message });
        return;
      }
      throw err;
    }

    const file = (req as any).file as
      | { mimetype: string; buffer: Buffer; originalname: string }
      | undefined;
    if (!file) {
      res.status(400).json({ error: "Missing file field 'file'" });
      return;
    }
    const contentType = (file.mimetype || "").toLowerCase();
    if (!ALLOWED_SOUND_CONTENT_TYPES.has(contentType)) {
      res.status(422).json({ error: `Unsupported audio type: ${contentType || "unknown"}` });
      return;
    }
    if (file.buffer.length <= 0) {
      res.status(422).json({ error: "Audio file is empty" });
      return;
    }

    const actor = getActorInfo(req);
    const stored = await storage.putFile({
      companyId,
      namespace: "sounds",
      originalFilename: file.originalname || null,
      contentType,
      body: file.buffer,
    });
    const asset = await assetsSvc.create(companyId, {
      provider: stored.provider,
      objectKey: stored.objectKey,
      contentType: stored.contentType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      originalFilename: stored.originalFilename,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });
    res.status(201).json({
      sound: {
        id: asset!.id,
        label: asset!.originalFilename ?? "sound",
        contentType: asset!.contentType,
      },
    });
  });

  return router;
}
