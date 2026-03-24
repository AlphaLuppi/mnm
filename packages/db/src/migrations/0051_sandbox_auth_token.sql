-- SANDBOX-AUTH: Store Claude OAuth token per user pod
-- Token injected as CLAUDE_CODE_OAUTH_TOKEN env var per run (never stored on disk in sandbox)
ALTER TABLE "user_pods" ADD COLUMN "claude_oauth_token" text;
