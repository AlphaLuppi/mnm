import { and, eq, inArray, like, sql } from "drizzle-orm";
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
    // Insert path: defaults merged with the patch. Conflict path: the merge happens
    // in SQL against the stored row, so concurrent partial PUTs (e.g. volume + a
    // tone from two tabs) can't overwrite each other's fields (no read-modify-write).
    const initial: SoundSettings = {
      enabled: patch.enabled ?? DEFAULT_SOUND_SETTINGS.enabled,
      volume: patch.volume ?? DEFAULT_SOUND_SETTINGS.volume,
      tones: { ...DEFAULT_SOUND_SETTINGS.tones, ...(patch.tones ?? {}) },
    };
    const [row] = await db
      .insert(userSoundSettings)
      .values({ companyId, userId, ...initial })
      .onConflictDoUpdate({
        target: [userSoundSettings.companyId, userSoundSettings.userId],
        set: {
          ...(patch.enabled !== undefined && { enabled: patch.enabled }),
          ...(patch.volume !== undefined && { volume: patch.volume }),
          ...(patch.tones && {
            tones: sql`${userSoundSettings.tones} || ${JSON.stringify(patch.tones)}::jsonb`,
          }),
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return { enabled: row!.enabled, volume: row!.volume, tones: row!.tones };
  }

  /**
   * Asset ids among `assetIds` that are NOT sounds uploaded by this user in this
   * company. Used to reject `asset:<uuid>` refs pointing at someone else's file,
   * a non-sound asset, or nothing at all.
   */
  async function foreignSoundIds(
    companyId: string,
    userId: string,
    assetIds: string[],
  ): Promise<string[]> {
    if (assetIds.length === 0) return [];
    const owned = await db
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(
          eq(assets.companyId, companyId),
          eq(assets.createdByUserId, userId),
          like(assets.objectKey, "sounds/%"),
          inArray(assets.id, assetIds),
        ),
      );
    const ownedIds = new Set(owned.map((a) => a.id));
    return assetIds.filter((id) => !ownedIds.has(id));
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

  return { get, upsert, foreignSoundIds, listUserSounds };
}
