-- Feedback votes: thumbs up/down on agent-generated content
CREATE TABLE IF NOT EXISTS "feedback_votes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "issue_id" uuid NOT NULL REFERENCES "issues"("id"),
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "author_user_id" text NOT NULL,
  "vote" text NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "feedback_votes_company_issue_idx" ON "feedback_votes" ("company_id", "issue_id");
CREATE INDEX IF NOT EXISTS "feedback_votes_issue_target_idx" ON "feedback_votes" ("issue_id", "target_type", "target_id");
CREATE INDEX IF NOT EXISTS "feedback_votes_author_idx" ON "feedback_votes" ("company_id", "author_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_votes_unique_idx" ON "feedback_votes" ("company_id", "target_type", "target_id", "author_user_id");
