-- 0060: Drop unused legacy columns from agents and companies tables
-- containerProfileId and isolationMode on agents: never used in application code
-- parentCompanyId on companies: never used (multi-tenant vestige from paperclip fork)
-- Also changes the default issue prefix from "PAP" (Paperclip) to "MNM"

ALTER TABLE agents DROP COLUMN IF EXISTS container_profile_id;
ALTER TABLE agents DROP COLUMN IF EXISTS isolation_mode;
ALTER TABLE companies DROP COLUMN IF EXISTS parent_company_id;
ALTER TABLE companies ALTER COLUMN issue_prefix SET DEFAULT 'MNM';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS force_local_execution boolean NOT NULL DEFAULT false;
