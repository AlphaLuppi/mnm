-- Data migration: existing members are founders, set them to admin
UPDATE "company_memberships" SET "business_role" = 'admin' WHERE "business_role" = 'contributor';
