import { and, eq, like, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { userSoundSettings, assets } from "@mnm/db";
import {
  DEFAULT_SOUND_SETTINGS,
  type SoundSettings,
  type UpdateSoundSettings,
} from "@mnm/shared";

export interface UploadedSound {
  id: string;
  label: string;
  contentType: string;
}

export function soundSettingsService(db: Db) {
  async function get(companyId: string, userId: string): Promise<SoundSettings> {
    const [row] = await db
      .select()
      .from(userSoundSettings)
      .where(and(eq(userSoundSettings.companyId, companyId), eq(userSoundSettings.userId, userId)))
      .limit(1);
    if (!row) return DEFAULT_SOUND_SETTINGS;
    return { enabled: row.enabled, volume: row.volume, tones: row.tones };
  }

  async function upsert(
    companyId: string,
    userId: string,
    patch: UpdateSoundSettings,
  ): Promise<SoundSettings> {
    const current = await get(companyId, userId);
    const next: SoundSettings = {
      enabled: patch.enabled ?? current.enabled,
      volume: patch.volume ?? current.volume,
      tones: { ...current.tones, ...(patch.tones ?? {}) },
    };
    await db
      .insert(userSoundSettings)
      .values({ companyId, userId, enabled: next.enabled, volume: next.volume, tones: next.tones })
      .onConflictDoUpdate({
        target: [userSoundSettings.companyId, userSoundSettings.userId],
        set: {
          enabled: next.enabled,
          volume: next.volume,
          tones: next.tones,
          updatedAt: sql`now()`,
        },
      });
    return next;
  }

  /** Uploaded sound assets for this user (namespace "sounds/" prefix in object key). */
  async function listUserSounds(companyId: string, userId: string): Promise<UploadedSound[]> {
    const rows = await db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.companyId, companyId),
          eq(assets.createdByUserId, userId),
          like(assets.objectKey, "sounds/%"),
        ),
      );
    return rows.map((a) => ({
      id: a.id,
      label: a.originalFilename ?? "sound",
      contentType: a.contentType,
    }));
  }

  return { get, upsert, listUserSounds };
}
