# Event Sounds Configuration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à chaque utilisateur de configurer, depuis une nouvelle page `/settings/sounds`, le son joué par l'app pour chaque tonalité de toast (`info`/`success`/`warn`/`error`), avec mute + volume global, sons intégrés + upload perso.

**Architecture:** Une table `user_sound_settings` (1 ligne JSONB par `(companyId, userId)`, RLS) stocke la config. Routes self-scope `/companies/:companyId/me/sound-settings` (GET/PUT) + upload audio `/me/sounds` (réutilise l'infra `assets`). Côté client, un `SoundSettingsProvider` charge la config au boot et expose `play(tone)`, appelé depuis `ToastContext.pushToast`.

**Tech Stack:** Drizzle ORM + PostgreSQL (RLS), Express + multer, Zod (`@mnm/shared`), React 18 + React Query + shadcn/ui, Vitest.

**Référence design :** [`docs/superpowers/specs/2026-06-04-event-sounds-config-design.md`](../specs/2026-06-04-event-sounds-config-design.md)

---

## File Structure

**Backend / DB**
- Create: `packages/db/src/schema/user_sound_settings.ts` — table Drizzle
- Modify: `packages/db/src/schema/index.ts` — export
- Create: `packages/db/src/migrations/0086_user_sound_settings.sql` — table + RLS
- Create: `packages/db/src/migrations/0086_user_sound_settings.test.ts` — test migration/RLS
- Create: `packages/shared/src/validators/sound-settings.ts` — schémas Zod + types
- Modify: `packages/shared/src/validators/index.ts` + `packages/shared/src/index.ts` — exports
- Create: `server/src/services/sound-settings.ts` — service get/upsert + listUserSounds
- Modify: `server/src/services/index.ts` — export du service
- Create: `server/src/services/__tests__/sound-settings.test.ts` — unit tests service
- Create: `server/src/routes/sound-settings.ts` — routes GET/PUT settings + POST/GET sounds
- Modify: `server/src/app.ts` — mount du router

**Frontend**
- Create: `ui/public/sounds/README.md` — placeholder pour les fichiers à venir
- Create: `ui/src/sounds/manifest.ts` — manifest des sons intégrés
- Create: `ui/src/sounds/play.ts` — logique pure de lecture (testable)
- Create: `ui/src/sounds/play.test.ts` — unit tests de la logique
- Create: `ui/src/api/sound-settings.ts` — client API
- Modify: `ui/src/lib/queryKeys.ts` — clés React Query
- Create: `ui/src/context/SoundSettingsProvider.tsx` — contexte + `play`
- Modify: `ui/src/main.tsx` — mount du provider
- Modify: `ui/src/context/ToastContext.tsx` — appel `play(tone)`
- Create: `ui/src/pages/SoundSettingsPage.tsx` — la page de config
- Modify: `ui/src/App.tsx` — routes
- Modify: `ui/src/components/UserMenu.tsx` — lien menu
- Modify: `scripts/parity/data.ts` — entrée parité

---

## Task 1: DB schema `user_sound_settings`

**Files:**
- Create: `packages/db/src/schema/user_sound_settings.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Créer le schéma Drizzle**

Create `packages/db/src/schema/user_sound_settings.ts`:

```typescript
import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * Per-user, per-company sound preferences. One row per (companyId, userId).
 * `tones` maps each ToastTone to a sound reference string:
 *   "none" | "builtin:<id>" | "asset:<uuid>".
 */
export const userSoundSettings = pgTable(
  "user_sound_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    volume: integer("volume").notNull().default(70),
    tones: jsonb("tones")
      .notNull()
      .$type<{ info: string; success: string; warn: string; error: string }>()
      .default({ info: "none", success: "none", warn: "none", error: "none" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserUq: uniqueIndex("user_sound_settings_company_user_uq").on(table.companyId, table.userId),
  }),
);
```

- [ ] **Step 2: Exporter depuis l'index**

Modify `packages/db/src/schema/index.ts` — add near the other exports (e.g. after the `assets` export):

```typescript
export { userSoundSettings } from "./user_sound_settings.js";
```

- [ ] **Step 3: Build le package db**

Run: `bun run --cwd packages/db build`
Expected: build OK, `dist/schema/user_sound_settings.js` généré.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/user_sound_settings.ts packages/db/src/schema/index.ts
git -c commit.gpgsign=false commit -m "feat(db): schéma user_sound_settings"
```

---

## Task 2: Migration SQL + RLS

**Files:**
- Create: `packages/db/src/migrations/0086_user_sound_settings.sql`
- Create: `packages/db/src/migrations/0086_user_sound_settings.test.ts`

- [ ] **Step 1: Écrire la migration SQL (table + RLS)**

Create `packages/db/src/migrations/0086_user_sound_settings.sql`:

```sql
CREATE TABLE IF NOT EXISTS "user_sound_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "volume" integer NOT NULL DEFAULT 70,
  "tones" jsonb NOT NULL DEFAULT '{"info":"none","success":"none","warn":"none","error":"none"}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_sound_settings_volume_range" CHECK ("volume" >= 0 AND "volume" <= 100)
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "user_sound_settings_company_user_uq"
  ON "user_sound_settings" ("company_id", "user_id");
--> statement-breakpoint

ALTER TABLE "user_sound_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_sound_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_baseline_permissive" ON "user_sound_settings";--> statement-breakpoint
CREATE POLICY "tenant_baseline_permissive" ON "user_sound_settings" AS PERMISSIVE FOR ALL
  USING (true);
--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation" ON "user_sound_settings";--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_sound_settings" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint
```

- [ ] **Step 2: Écrire le test de migration (table existe + RLS isole)**

Create `packages/db/src/migrations/0086_user_sound_settings.test.ts`. Mirror the structure of an existing migration test in this folder — open the most recent `*_*.test.ts` next to `0085_github_apps.sql` and copy its harness imports/setup. The assertions to implement:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { setupTestDb, createTestCompany } from "@mnm/test-utils";
import { userSoundSettings } from "@mnm/db";

describe("0086 user_sound_settings", () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>;
  let companyA: { id: string };
  let companyB: { id: string };

  beforeAll(async () => {
    db = await setupTestDb();
    companyA = await createTestCompany(db, { name: "A" });
    companyB = await createTestCompany(db, { name: "B" });
    await db.insert(userSoundSettings).values([
      { companyId: companyA.id, userId: "user-a" },
      { companyId: companyB.id, userId: "user-b" },
    ]);
  });

  it("applies tone defaults", async () => {
    await db.execute(sql`SET LOCAL app.current_company_id = ${companyA.id}`);
    const rows = await db.select().from(userSoundSettings);
    expect(rows[0].tones).toEqual({ info: "none", success: "none", warn: "none", error: "none" });
    expect(rows[0].enabled).toBe(true);
    expect(rows[0].volume).toBe(70);
  });

  it("isolates rows by tenant context (RLS)", async () => {
    await db.execute(sql`SET LOCAL app.current_company_id = ${companyA.id}`);
    const rows = await db.select().from(userSoundSettings);
    expect(rows).toHaveLength(1);
    expect(rows[0].companyId).toBe(companyA.id);
  });

  it("fail-closed when no tenant context is set", async () => {
    await db.execute(sql`RESET app.current_company_id`);
    const rows = await db.select().from(userSoundSettings);
    expect(rows).toHaveLength(0);
  });
});
```

> If `setupTestDb` / `createTestCompany` have different names in the sibling test, use whatever that test uses — match the existing harness exactly.

- [ ] **Step 3: Appliquer la migration**

Run: `bun run --cwd packages/db build && bun run db:migrate`
Expected: migration `0086` appliquée sans erreur.

- [ ] **Step 4: Lancer le test de migration**

Run: `bun run --cwd packages/db test 0086_user_sound_settings`
Expected: PASS (defaults + RLS isolation + fail-closed).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/migrations/0086_user_sound_settings.sql packages/db/src/migrations/0086_user_sound_settings.test.ts
git -c commit.gpgsign=false commit -m "feat(db): migration + RLS user_sound_settings"
```

---

## Task 3: Validators Zod partagés

**Files:**
- Create: `packages/shared/src/validators/sound-settings.ts`
- Modify: `packages/shared/src/validators/index.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/validators/sound-settings.test.ts`

- [ ] **Step 1: Écrire le test des validators**

Create `packages/shared/src/validators/sound-settings.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { soundRefSchema, updateSoundSettingsSchema } from "./sound-settings.js";

describe("soundRefSchema", () => {
  it.each(["none", "builtin:chime", "asset:7b6b9c2e-0000-4000-8000-000000000000"])(
    "accepts %s",
    (ref) => expect(soundRefSchema.safeParse(ref).success).toBe(true),
  );

  it.each(["", "builtin:", "asset:not-a-uuid", "random", "builtin:bad id"])(
    "rejects %s",
    (ref) => expect(soundRefSchema.safeParse(ref).success).toBe(false),
  );
});

describe("updateSoundSettingsSchema", () => {
  it("accepts a partial patch", () => {
    expect(updateSoundSettingsSchema.safeParse({ volume: 50 }).success).toBe(true);
  });

  it("rejects volume out of range", () => {
    expect(updateSoundSettingsSchema.safeParse({ volume: 101 }).success).toBe(false);
    expect(updateSoundSettingsSchema.safeParse({ volume: -1 }).success).toBe(false);
  });

  it("accepts a full tones map", () => {
    const r = updateSoundSettingsSchema.safeParse({
      enabled: false,
      volume: 0,
      tones: { info: "none", success: "builtin:chime", warn: "none", error: "none" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid tone ref", () => {
    expect(
      updateSoundSettingsSchema.safeParse({ tones: { info: "builtin:" } }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `bun run --cwd packages/shared test sound-settings`
Expected: FAIL (module `./sound-settings.js` introuvable).

- [ ] **Step 3: Écrire les validators**

Create `packages/shared/src/validators/sound-settings.ts`:

```typescript
import { z } from "zod";

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const BUILTIN_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** A sound reference: "none" | "builtin:<id>" | "asset:<uuid>". */
export const soundRefSchema = z.string().refine((v) => {
  if (v === "none") return true;
  if (v.startsWith("builtin:")) return BUILTIN_RE.test(v.slice("builtin:".length));
  if (v.startsWith("asset:")) return UUID_RE.test(v.slice("asset:".length));
  return false;
}, "Invalid sound reference");

export const TONE_KEYS = ["info", "success", "warn", "error"] as const;
export type ToneKey = (typeof TONE_KEYS)[number];

export const tonesSchema = z.object({
  info: soundRefSchema,
  success: soundRefSchema,
  warn: soundRefSchema,
  error: soundRefSchema,
});
export type SoundTones = z.infer<typeof tonesSchema>;

/** PUT body — every field optional; tones may be partial. */
export const updateSoundSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  volume: z.number().int().min(0).max(100).optional(),
  tones: tonesSchema.partial().optional(),
});
export type UpdateSoundSettings = z.infer<typeof updateSoundSettingsSchema>;

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  tones: SoundTones;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 70,
  tones: { info: "none", success: "none", warn: "none", error: "none" },
};
```

- [ ] **Step 4: Exporter**

Modify `packages/shared/src/validators/index.ts` — add:

```typescript
export {
  soundRefSchema,
  tonesSchema,
  updateSoundSettingsSchema,
  DEFAULT_SOUND_SETTINGS,
  TONE_KEYS,
} from "./sound-settings.js";
export type {
  SoundTones,
  ToneKey,
  UpdateSoundSettings,
  SoundSettings,
} from "./sound-settings.js";
```

Then check `packages/shared/src/index.ts` re-exports the validators barrel (it already re-exports `createAssetImageMetadataSchema` from validators — add the same names there if `index.ts` lists exports explicitly; if it does `export * from "./validators/index.js"` no change needed). Add explicitly if the file uses a named-export list:

```typescript
  soundRefSchema,
  updateSoundSettingsSchema,
  DEFAULT_SOUND_SETTINGS,
  TONE_KEYS,
```

- [ ] **Step 5: Vérifier que le test passe**

Run: `bun run --cwd packages/shared test sound-settings`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/validators/sound-settings.ts packages/shared/src/validators/sound-settings.test.ts packages/shared/src/validators/index.ts packages/shared/src/index.ts
git -c commit.gpgsign=false commit -m "feat(shared): validators sound settings"
```

---

## Task 4: Service backend `sound-settings`

**Files:**
- Create: `server/src/services/sound-settings.ts`
- Modify: `server/src/services/index.ts`
- Create: `server/src/services/__tests__/sound-settings.test.ts`

- [ ] **Step 1: Écrire le test du service**

Create `server/src/services/__tests__/sound-settings.test.ts`. Match the harness used by sibling service tests (open another `server/src/services/__tests__/*.test.ts` that touches the DB to copy `setupTestDb`/company-context helpers). Assertions:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, createTestCompany, withCompanyContext } from "@mnm/test-utils";
import { DEFAULT_SOUND_SETTINGS } from "@mnm/shared";
import { soundSettingsService } from "../sound-settings.js";

describe("soundSettingsService", () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>;
  let company: { id: string };

  beforeAll(async () => {
    db = await setupTestDb();
    company = await createTestCompany(db, { name: "Acme" });
  });

  it("returns defaults when no row exists", async () => {
    await withCompanyContext(db, company.id, async () => {
      const svc = soundSettingsService(db);
      const got = await svc.get(company.id, "user-1");
      expect(got).toEqual(DEFAULT_SOUND_SETTINGS);
    });
  });

  it("upserts and merges a partial patch", async () => {
    await withCompanyContext(db, company.id, async () => {
      const svc = soundSettingsService(db);
      await svc.upsert(company.id, "user-1", { volume: 30 });
      await svc.upsert(company.id, "user-1", { tones: { success: "builtin:chime" } });
      const got = await svc.get(company.id, "user-1");
      expect(got.volume).toBe(30);
      expect(got.tones.success).toBe("builtin:chime");
      expect(got.tones.info).toBe("none"); // untouched
    });
  });
});
```

> If `withCompanyContext` is not the helper name in sibling tests, use that file's equivalent for running a query under a tenant context.

- [ ] **Step 2: Vérifier que le test échoue**

Run: `bun run --cwd server test sound-settings`
Expected: FAIL (`../sound-settings.js` introuvable).

- [ ] **Step 3: Écrire le service**

Create `server/src/services/sound-settings.ts`:

```typescript
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
```

- [ ] **Step 4: Exporter le service**

Modify `server/src/services/index.ts` — add alongside the other service exports:

```typescript
export { soundSettingsService } from "./sound-settings.js";
```

- [ ] **Step 5: Vérifier que le test passe**

Run: `bun run --cwd server test sound-settings`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/sound-settings.ts server/src/services/index.ts server/src/services/__tests__/sound-settings.test.ts
git -c commit.gpgsign=false commit -m "feat(server): service sound-settings (get/upsert/listUserSounds)"
```

---

## Task 5: Routes backend (settings + upload)

**Files:**
- Create: `server/src/routes/sound-settings.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Écrire les routes**

Create `server/src/routes/sound-settings.ts`. This mirrors `assets.ts` (multer + storage) and the self-scope `me/` pattern (`req.actor.userId`, `assertBoard`, `assertCompanyAccess`):

```typescript
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

  // GET current user's settings (or defaults)
  router.get("/companies/:companyId/me/sound-settings", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const userId = req.actor.userId!;
    const settings = await svc.get(companyId, userId);
    const sounds = await svc.listUserSounds(companyId, userId);
    res.json({ settings, sounds });
  });

  // PUT upsert settings
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

  // GET uploaded sounds list
  router.get("/companies/:companyId/me/sounds", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const userId = req.actor.userId!;
    res.json({ sounds: await svc.listUserSounds(companyId, userId) });
  });

  // POST upload an audio file
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
      sound: { id: asset.id, label: asset.originalFilename ?? "sound", contentType: asset.contentType },
    });
  });

  return router;
}
```

> Verify the exact field names of `getActorInfo(req)` (`actorType`, `actorId`, `agentId`) against `assets.ts` — copy them verbatim from there if they differ.

- [ ] **Step 2: Monter le router dans `app.ts`**

Modify `server/src/app.ts` — find the line `api.use(assetRoutes(db, opts.storageService));` and add right after it:

```typescript
api.use(soundSettingsRoutes(db, opts.storageService));
```

Add the import at the top with the other route imports:

```typescript
import { soundSettingsRoutes } from "./routes/sound-settings.js";
```

- [ ] **Step 3: Typecheck server**

Run: `bun run --cwd server typecheck`
Expected: PASS (no type errors). Fix `getActorInfo` field mismatches if any.

- [ ] **Step 4: Smoke test manuel des routes**

Run: `bun run dev` then in another shell (replace `<companyId>`; relies on `local_trusted` dev mode = no auth):

```bash
curl -s http://localhost:3000/api/companies/<companyId>/me/sound-settings | head
curl -s -X PUT http://localhost:3000/api/companies/<companyId>/me/sound-settings \
  -H 'Content-Type: application/json' -d '{"volume":42}' | head
```
Expected: GET returns `{"settings":{...defaults...},"sounds":[]}`; PUT returns `{"settings":{...,"volume":42}}`.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/sound-settings.ts server/src/app.ts
git -c commit.gpgsign=false commit -m "feat(server): routes sound-settings + upload audio"
```

---

## Task 6: Bibliothèque de sons intégrée (manifest + placeholder)

**Files:**
- Create: `ui/public/sounds/README.md`
- Create: `ui/src/sounds/manifest.ts`

- [ ] **Step 1: Placeholder pour les fichiers à venir**

Create `ui/public/sounds/README.md`:

```markdown
# Built-in sounds

Drop short audio files (`.mp3` / `.ogg`, < 200 KB each) here. Each file must be
registered in `ui/src/sounds/manifest.ts` to appear in the sound settings UI.

The feature works with zero files: the manifest can be empty and users simply
see "Aucun" as the only option until files are added here.
```

- [ ] **Step 2: Manifest (démarre vide)**

Create `ui/src/sounds/manifest.ts`:

```typescript
export interface BuiltinSound {
  /** Stable id referenced as "builtin:<id>" in settings. */
  id: string;
  /** Human label shown in the UI. */
  label: string;
  /** Path under /public, served at runtime as `/sounds/<file>`. */
  file: string;
}

/**
 * Built-in sound library. Add entries here once audio files are dropped into
 * `ui/public/sounds/`. Empty is valid — the UI then only offers "Aucun".
 *
 * Example once files exist:
 *   { id: "chime", label: "Chime", file: "chime.mp3" },
 */
export const BUILTIN_SOUNDS: BuiltinSound[] = [];

export function builtinSoundUrl(file: string): string {
  return `/sounds/${file}`;
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/public/sounds/README.md ui/src/sounds/manifest.ts
git -c commit.gpgsign=false commit -m "feat(ui): manifest sons intégrés (placeholder)"
```

---

## Task 7: Logique de lecture pure + tests

**Files:**
- Create: `ui/src/sounds/play.ts`
- Create: `ui/src/sounds/play.test.ts`

- [ ] **Step 1: Écrire le test de la logique pure**

Create `ui/src/sounds/play.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveSoundUrl, shouldPlay } from "./play";
import type { SoundSettings } from "@mnm/shared";

const base: SoundSettings = {
  enabled: true,
  volume: 70,
  tones: { info: "none", success: "builtin:chime", warn: "none", error: "asset:abc" },
};

describe("shouldPlay", () => {
  it("false when globally disabled", () => {
    expect(shouldPlay({ ...base, enabled: false }, "success")).toBe(false);
  });
  it("false when tone ref is none", () => {
    expect(shouldPlay(base, "info")).toBe(false);
  });
  it("true when enabled and tone has a sound", () => {
    expect(shouldPlay(base, "success")).toBe(true);
  });
});

describe("resolveSoundUrl", () => {
  const ctx = { companyId: "c1", builtinUrl: (f: string) => `/sounds/${f}`, builtins: [{ id: "chime", label: "Chime", file: "chime.mp3" }] };
  it("resolves a builtin ref to its file url", () => {
    expect(resolveSoundUrl("builtin:chime", ctx)).toBe("/sounds/chime.mp3");
  });
  it("resolves an asset ref to the asset content endpoint", () => {
    expect(resolveSoundUrl("asset:abc", ctx)).toBe("/api/companies/c1/assets/abc/content");
  });
  it("returns null for none or unknown builtin (graceful fallback)", () => {
    expect(resolveSoundUrl("none", ctx)).toBeNull();
    expect(resolveSoundUrl("builtin:ghost", ctx)).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `bun run --cwd ui test play`
Expected: FAIL (`./play` introuvable).

- [ ] **Step 3: Écrire la logique pure**

Create `ui/src/sounds/play.ts`:

```typescript
import type { SoundSettings, ToneKey } from "@mnm/shared";
import type { BuiltinSound } from "./manifest";

export function shouldPlay(settings: SoundSettings, tone: ToneKey): boolean {
  if (!settings.enabled) return false;
  return settings.tones[tone] !== "none";
}

export interface ResolveCtx {
  companyId: string;
  builtins: BuiltinSound[];
  builtinUrl: (file: string) => string;
}

/** Returns a playable URL for a sound ref, or null if not resolvable. */
export function resolveSoundUrl(ref: string, ctx: ResolveCtx): string | null {
  if (ref === "none") return null;
  if (ref.startsWith("builtin:")) {
    const id = ref.slice("builtin:".length);
    const found = ctx.builtins.find((b) => b.id === id);
    return found ? ctx.builtinUrl(found.file) : null;
  }
  if (ref.startsWith("asset:")) {
    const id = ref.slice("asset:".length);
    return `/api/companies/${ctx.companyId}/assets/${id}/content`;
  }
  return null;
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `bun run --cwd ui test play`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/sounds/play.ts ui/src/sounds/play.test.ts
git -c commit.gpgsign=false commit -m "feat(ui): logique pure de résolution/lecture des sons"
```

---

## Task 8: API client + query keys

**Files:**
- Create: `ui/src/api/sound-settings.ts`
- Modify: `ui/src/lib/queryKeys.ts`

- [ ] **Step 1: Client API**

Create `ui/src/api/sound-settings.ts`:

```typescript
import type { SoundSettings, UpdateSoundSettings } from "@mnm/shared";
import { api } from "./client";

export interface UploadedSound {
  id: string;
  label: string;
  contentType: string;
}

export const soundSettingsApi = {
  get: (companyId: string) =>
    api.get<{ settings: SoundSettings; sounds: UploadedSound[] }>(
      `/companies/${companyId}/me/sound-settings`,
    ),
  update: (companyId: string, patch: UpdateSoundSettings) =>
    api.put<{ settings: SoundSettings }>(
      `/companies/${companyId}/me/sound-settings`,
      patch,
    ),
  upload: async (companyId: string, file: File) => {
    const buffer = await file.arrayBuffer();
    const safe = new File([buffer], file.name, { type: file.type });
    const form = new FormData();
    form.append("file", safe);
    return api.postForm<{ sound: UploadedSound }>(`/companies/${companyId}/me/sounds`, form);
  },
};
```

> Confirm `api.put` exists in `ui/src/api/client.ts`; the file exposes `get`/`post`/`postForm`/`delete` — add a `put` helper there if missing, mirroring `post`:
> ```typescript
> put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
> ```

- [ ] **Step 2: Query keys**

Modify `ui/src/lib/queryKeys.ts` — add a block inside the `queryKeys` object (next to `connectors`):

```typescript
  soundSettings: {
    me: (companyId: string) => ["sound-settings", companyId, "me"] as const,
  },
```

- [ ] **Step 3: Typecheck**

Run: `bun run --cwd ui typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add ui/src/api/sound-settings.ts ui/src/lib/queryKeys.ts ui/src/api/client.ts
git -c commit.gpgsign=false commit -m "feat(ui): client API sound-settings + query keys"
```

---

## Task 9: SoundSettingsProvider + intégration toast

**Files:**
- Create: `ui/src/context/SoundSettingsProvider.tsx`
- Modify: `ui/src/main.tsx`
- Modify: `ui/src/context/ToastContext.tsx`

- [ ] **Step 1: Écrire le provider**

Create `ui/src/context/SoundSettingsProvider.tsx`:

```tsx
import { createContext, useContext, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SoundSettings, ToneKey } from "@mnm/shared";
import { DEFAULT_SOUND_SETTINGS } from "@mnm/shared";
import { useCompany } from "./CompanyContext";
import { soundSettingsApi, type UploadedSound } from "../api/sound-settings";
import { queryKeys } from "../lib/queryKeys";
import { BUILTIN_SOUNDS, builtinSoundUrl } from "../sounds/manifest";
import { shouldPlay, resolveSoundUrl } from "../sounds/play";

const THROTTLE_MS = 300;

interface SoundSettingsContextValue {
  settings: SoundSettings;
  sounds: UploadedSound[];
  play: (tone: ToneKey) => void;
}

const SoundSettingsContext = createContext<SoundSettingsContextValue | null>(null);

export function SoundSettingsProvider({ children }: { children: React.ReactNode }) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: selectedCompanyId ? queryKeys.soundSettings.me(selectedCompanyId) : ["sound-settings", "none"],
    queryFn: () => soundSettingsApi.get(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const settings = data?.settings ?? DEFAULT_SOUND_SETTINGS;
  const sounds = useMemo(() => data?.sounds ?? [], [data]);

  // Keep latest settings in a ref so the stable `play` callback always reads fresh values.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastPlayedRef = useRef(0);
  const unlockedRef = useRef(false);

  // Browser autoplay policy: unlock audio on first user gesture.
  useEffect(() => {
    const unlock = () => {
      unlockedRef.current = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const play = useCallback(
    (tone: ToneKey) => {
      const s = settingsRef.current;
      if (!unlockedRef.current) return; // autoplay blocked pre-gesture
      if (!selectedCompanyId) return;
      if (!shouldPlay(s, tone)) return;

      const now = Date.now();
      if (now - lastPlayedRef.current < THROTTLE_MS) return;

      const url = resolveSoundUrl(s.tones[tone], {
        companyId: selectedCompanyId,
        builtins: BUILTIN_SOUNDS,
        builtinUrl: builtinSoundUrl,
      });
      if (!url) return; // graceful fallback (missing builtin / deleted asset)

      lastPlayedRef.current = now;
      const audio = new Audio(url);
      audio.volume = Math.min(1, Math.max(0, s.volume / 100));
      // Asset endpoint needs cookies; same-origin Audio sends them by default.
      audio.play().catch(() => {
        /* autoplay denied or asset gone — ignore */
      });
    },
    [selectedCompanyId],
  );

  // Expose a manual refetch hook for the settings page after mutations.
  useEffect(() => {
    if (selectedCompanyId) {
      void queryClient; // referenced for future invalidation; no-op here
    }
  }, [selectedCompanyId, queryClient]);

  const value = useMemo(() => ({ settings, sounds, play }), [settings, sounds, play]);
  return <SoundSettingsContext.Provider value={value}>{children}</SoundSettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSoundSettings(): SoundSettingsContextValue {
  const ctx = useContext(SoundSettingsContext);
  if (!ctx) {
    // Tolerate being used outside the provider (e.g. ToastContext before mount): no-op.
    return { settings: DEFAULT_SOUND_SETTINGS, sounds: [], play: () => {} };
  }
  return ctx;
}
```

- [ ] **Step 2: Monter le provider dans `main.tsx`**

Modify `ui/src/main.tsx` — wrap inside `LiveUpdatesProvider`, around `BrowserRouter`:

```tsx
<LiveUpdatesProvider>
  <SoundSettingsProvider>
    <BrowserRouter>
      {/* ...existing tree... */}
    </BrowserRouter>
  </SoundSettingsProvider>
</LiveUpdatesProvider>
```

Add the import:

```tsx
import { SoundSettingsProvider } from "./context/SoundSettingsProvider";
```

- [ ] **Step 3: Appeler `play(tone)` dans `ToastContext`**

Modify `ui/src/context/ToastContext.tsx`. Import the hook at top:

```tsx
import { useSoundSettings } from "./SoundSettingsProvider";
```

Inside the `ToastProvider` component body, get `play`:

```tsx
const { play } = useSoundSettings();
```

In `pushToast`, after the `setToasts((prev) => {...})` block and before scheduling the dismiss `setTimeout` (around line 137), add:

```tsx
play(tone);
```

Then add `play` to the `useCallback` dependency array of `pushToast` (append `play` to the existing deps `[clearTimer, dismissToast]` → `[clearTimer, dismissToast, play]`).

> **Provider order note:** `ToastProvider` is mounted *outside* `SoundSettingsProvider` in `main.tsx`. `useSoundSettings` returns a safe no-op when used outside its provider (see Task 9 Step 1), so this is safe. If you prefer real sound on every toast, the cleaner fix is to mount `SoundSettingsProvider` *outside* `ToastProvider`; but `SoundSettingsProvider` needs `useCompany` (CompanyProvider) and React Query, both already above `ToastProvider`, and does **not** need Toast. So move `SoundSettingsProvider` to wrap `ToastProvider`:
> ```tsx
> <CompanyProvider>
>   <SoundSettingsProvider>
>     <ToastProvider>
>       <LiveUpdatesProvider>
>         ...
> ```
> Use this ordering instead of Step 2's placement. Verify `SoundSettingsProvider` imports only `useCompany` + React Query (it does).

- [ ] **Step 4: Typecheck + tests UI**

Run: `bun run --cwd ui typecheck && bun run --cwd ui test play`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/context/SoundSettingsProvider.tsx ui/src/main.tsx ui/src/context/ToastContext.tsx
git -c commit.gpgsign=false commit -m "feat(ui): SoundSettingsProvider + lecture du son sur toast"
```

---

## Task 10: Page `/settings/sounds` + route + nav

**Files:**
- Create: `ui/src/pages/SoundSettingsPage.tsx`
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/components/UserMenu.tsx`

- [ ] **Step 1: Écrire la page**

Create `ui/src/pages/SoundSettingsPage.tsx`. Use only primitives from `ui/src/components/ui/` (`Card`, `Label`, `Switch`, `Slider`, `Select`, `Button`, `Input`). If `Slider` or `Switch` is missing under `ui/src/components/ui/`, create it from shadcn first (CLAUDE.md rule).

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SoundSettings, ToneKey } from "@mnm/shared";
import { DEFAULT_SOUND_SETTINGS, TONE_KEYS } from "@mnm/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { soundSettingsApi, type UploadedSound } from "../api/sound-settings";
import { queryKeys } from "../lib/queryKeys";
import { BUILTIN_SOUNDS, builtinSoundUrl } from "../sounds/manifest";
import { resolveSoundUrl } from "../sounds/play";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import { Button } from "../components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";

const TONE_LABELS: Record<ToneKey, string> = {
  info: "Info",
  success: "Succès",
  warn: "Avertissement",
  error: "Erreur",
};

export function SoundSettingsPage() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Paramètres" }, { label: "Sons" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.soundSettings.me(selectedCompanyId!),
    queryFn: () => soundSettingsApi.get(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const [draft, setDraft] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS);
  useEffect(() => {
    if (data?.settings) setDraft(data.settings);
  }, [data]);

  const sounds: UploadedSound[] = useMemo(() => data?.sounds ?? [], [data]);

  const save = useMutation({
    mutationFn: (next: SoundSettings) => soundSettingsApi.update(selectedCompanyId!, next),
    onSuccess: (res) => {
      setDraft(res.settings);
      void queryClient.invalidateQueries({ queryKey: queryKeys.soundSettings.me(selectedCompanyId!) });
    },
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => soundSettingsApi.upload(selectedCompanyId!, file),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.soundSettings.me(selectedCompanyId!) }),
  });

  const update = (patch: Partial<SoundSettings>) => {
    const next = { ...draft, ...patch, tones: { ...draft.tones, ...(patch.tones ?? {}) } };
    setDraft(next);
    save.mutate(next);
  };

  const preview = (ref: string) => {
    if (!selectedCompanyId) return;
    const url = resolveSoundUrl(ref, {
      companyId: selectedCompanyId,
      builtins: BUILTIN_SOUNDS,
      builtinUrl: builtinSoundUrl,
    });
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = Math.min(1, Math.max(0, draft.volume / 100));
    void audio.play().catch(() => {});
  };

  if (!selectedCompanyId || isLoading) {
    return <div className="container mx-auto py-6 text-sm text-muted-foreground">Chargement…</div>;
  }

  const options = [
    { value: "none", label: "Aucun" },
    ...BUILTIN_SOUNDS.map((b) => ({ value: `builtin:${b.id}`, label: b.label })),
    ...sounds.map((s) => ({ value: `asset:${s.id}`, label: s.label })),
  ];

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-2xl">
      <Card className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Activer les sons</Label>
            <p className="text-sm text-muted-foreground">Jouer un son à chaque notification.</p>
          </div>
          <Switch checked={draft.enabled} onCheckedChange={(v) => update({ enabled: v })} />
        </div>
        <div className="space-y-2">
          <Label>Volume — {draft.volume}%</Label>
          <Slider
            value={[draft.volume]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => setDraft((d) => ({ ...d, volume: v }))}
            onValueCommit={([v]) => update({ volume: v })}
          />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <Label className="text-base">Son par type de notification</Label>
        {TONE_KEYS.map((tone) => (
          <div key={tone} className="flex items-center gap-3">
            <span className="w-32 text-sm">{TONE_LABELS[tone]}</span>
            <Select
              value={draft.tones[tone]}
              onValueChange={(v) => update({ tones: { ...draft.tones, [tone]: v } })}
            >
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => preview(draft.tones[tone])}>
              ▶ Aperçu
            </Button>
          </div>
        ))}
      </Card>

      <Card className="p-5 space-y-3">
        <Label className="text-base">Mes sons personnalisés</Label>
        <p className="text-sm text-muted-foreground">MP3, WAV, OGG ou WebM — max 2 Mo.</p>
        <input
          ref={fileRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/ogg,audio/webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadMut.mutate(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" disabled={uploadMut.isPending} onClick={() => fileRef.current?.click()}>
          {uploadMut.isPending ? "Envoi…" : "Importer un son"}
        </Button>
        {uploadMut.isError && (
          <p className="text-sm text-destructive">Échec de l'import (type ou taille invalide).</p>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Enregistrer la route dans `App.tsx`**

Modify `ui/src/App.tsx`. Add the import next to the other page imports:

```tsx
import { SoundSettingsPage } from "./pages/SoundSettingsPage";
```

Add the route right after the `settings/profile` route (line ~185, self-scope → no `RequirePermission`):

```tsx
<Route path="settings/sounds" element={<SoundSettingsPage />} />
```

And in the second (unprefixed redirect) block after `settings/profile` (line ~377):

```tsx
<Route path="settings/sounds" element={<UnprefixedBoardRedirect />} />
```

- [ ] **Step 3: Ajouter le lien dans le menu utilisateur**

Modify `ui/src/components/UserMenu.tsx`. Add a `DropdownMenuItem` after the "Mes connecteurs" item (after its closing `</DropdownMenuItem>` ~line 90). Import an icon (e.g. `Volume2`) from `lucide-react` at the top alongside the existing icon imports:

```tsx
<DropdownMenuItem asChild>
  <Link to="/settings/sounds" data-testid="mu-s06-sounds-link" className="cursor-pointer">
    <Volume2 className="h-4 w-4" />
    Sons
  </Link>
</DropdownMenuItem>
```

- [ ] **Step 4: Typecheck + lancer l'app**

Run: `bun run --cwd ui typecheck`
Expected: PASS.

Then run `bun run dev`, open the app, click the user menu → "Sons", verify the page renders (toggle, slider, 4 selects with "Aucun", import button). Toggle volume and a tone select → no error; network tab shows `PUT /me/sound-settings` 200.

- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/SoundSettingsPage.tsx ui/src/App.tsx ui/src/components/UserMenu.tsx
git -c commit.gpgsign=false commit -m "feat(ui): page de configuration des sons + route + lien menu"
```

---

## Task 11: Parité + vérification finale

**Files:**
- Modify: `scripts/parity/data.ts`

- [ ] **Step 1: Ajouter l'entrée parité**

Modify `scripts/parity/data.ts`. Add a feature entry to the most relevant domain (e.g. a `settings`/`admin` domain, or the domain containing other `/settings/*` pages). Use the existing `PlatformState` constants:

```typescript
{
  id: "sound-settings",
  name: "Configuration des sons d'events (mute, volume, son par tonalité, upload)",
  description:
    "Page /settings/sounds : son joué par tonalité de toast (info/success/warn/error), mute + volume global, bibliothèque intégrée + upload perso. Settings en DB par user (RLS).",
  web: WEB_DONE,
  desktop: DESKTOP_MISSING,
  todo: {
    code: ["Desktop (Tauri): vérifier lecture audio + endpoint /me/sounds dans le webview packagé"],
  },
},
```

- [ ] **Step 2: Vérifier le rapport de parité**

Run: `bun run parity --domain=<domain-id>`
Expected: la feature `sound-settings` apparaît avec web=done / desktop=missing.

- [ ] **Step 3: Vérification globale**

Run: `bun run typecheck && bun run test`
Expected: 17/17 packages typecheck OK ; tous les tests unitaires passent (incl. `sound-settings`, `play`, migration `0086`).

- [ ] **Step 4: Commit final**

```bash
git add scripts/parity/data.ts
git -c commit.gpgsign=false commit -m "docs(parity): entrée sound-settings"
git push -u origin feat/event-sounds-config
```

---

## Self-Review (faite à l'écriture)

**Spec coverage :**
- Granularité par tonalité → Task 3 (tonesSchema 4 clés), Task 9/10.
- Stockage DB par user + RLS → Task 1, 2 (+ test RLS).
- Modèle option A (JSONB) → Task 1.
- Bibliothèque + upload (réutilise assets) → Task 5 (upload), 6 (manifest), service listUserSounds Task 4.
- Mute + volume global → Task 1 (colonnes), Task 10 (UI).
- Réf string none/builtin/asset → Task 3 (soundRefSchema), Task 7 (resolveSoundUrl).
- Throttle 300ms + autoplay unlock → Task 9.
- Défaut "none" silencieux → Task 1/3 (DEFAULT_SOUND_SETTINGS).
- Edge cases (asset manquant, config KO, upload invalide, autoplay) → Task 5 (validation 422), Task 7/9 (fallback null), Task 9 (unlock).
- Tests + parité → Task 2, 3, 4, 7, 11.
- Self-scope permission → Task 5 (`assertBoard` + `assertCompanyAccess` + `req.actor.userId`).

**Type consistency :** `SoundSettings`/`ToneKey`/`UpdateSoundSettings`/`DEFAULT_SOUND_SETTINGS`/`TONE_KEYS` définis Task 3, réutilisés identiquement Task 4/7/9/10. `resolveSoundUrl`/`shouldPlay` signatures cohérentes Task 7 ↔ 9/10. `UploadedSound` shape identique server (Task 4) ↔ client (Task 8).

**Placeholders :** manifest volontairement vide (décision design : fichiers fournis plus tard) — documenté, non bloquant.

**Points à confirmer pendant l'exécution (signalés inline) :** noms exacts des helpers de test DB (`setupTestDb`/`withCompanyContext`), champs de `getActorInfo`, présence de `api.put` et des primitives `Slider`/`Switch` sous `ui/src/components/ui/`.
