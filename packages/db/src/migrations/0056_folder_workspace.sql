-- 0056_folder_workspace.sql
-- Folder Workspace: drop visibility, add instructions, create folder_shares, add ownedByFolderId

--> statement-breakpoint
DROP INDEX IF EXISTS "folders_company_visibility_idx";

--> statement-breakpoint
ALTER TABLE "folders" DROP COLUMN IF EXISTS "visibility";

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'folders' AND column_name = 'instructions') THEN
    ALTER TABLE "folders" ADD COLUMN "instructions" text;
  END IF;
END
$$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "folder_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "folder_id" uuid NOT NULL REFERENCES "folders"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "shared_with_user_id" text NOT NULL,
  "permission" text NOT NULL DEFAULT 'viewer',
  "shared_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE("folder_id", "shared_with_user_id")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folder_shares_folder_idx" ON "folder_shares"("folder_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folder_shares_user_idx" ON "folder_shares"("shared_with_user_id", "company_id");

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'owned_by_folder_id') THEN
    ALTER TABLE "documents" ADD COLUMN "owned_by_folder_id" uuid REFERENCES "folders"("id") ON DELETE SET NULL;
  END IF;
END
$$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_owned_folder_idx" ON "documents"("owned_by_folder_id");

--> statement-breakpoint
DELETE FROM "role_permissions" WHERE "permission_id" IN (
  SELECT "id" FROM "permissions" WHERE "slug" = 'folders:share'
);

--> statement-breakpoint
DELETE FROM "permissions" WHERE "slug" = 'folders:share';
