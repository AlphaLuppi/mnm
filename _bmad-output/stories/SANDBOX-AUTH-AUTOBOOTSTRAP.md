---
id: SANDBOX-AUTH-AUTOBOOTSTRAP
title: Auto-bootstrap first admin on fresh instance
type: tech
priority: P1
story_points: 3
status: done
---

# SANDBOX-AUTH-AUTOBOOTSTRAP: Auto-bootstrap first admin on fresh instance

## User Story

As the first user signing up on a fresh MnM instance, I want to automatically become the instance admin and be redirected to the onboarding wizard, so that I don't need to run any CLI command or SSH into the server.

## Context

Currently, a fresh instance shows "Instance setup required — run `pnpm mnm auth bootstrap-ceo`". This requires SSH access and manual DB manipulation, which is unacceptable for a self-hosted product deployed via Dokploy.

The `bootstrapStatus` check is in `server/src/routes/health.ts` (line 78-85): if no `instance_admin` exists in `instance_user_roles`, the status is `bootstrap_pending`.

## Acceptance Criteria

1. On a fresh instance with zero users, the first person who signs up (via email/password or SSO) is automatically granted `instance_admin` role
2. They are redirected to the onboarding wizard (company creation flow) — no "bootstrap required" screen
3. Subsequent users who sign up see the normal join/invite flow (NOT auto-admin)
4. The `bootstrap-ceo` CLI command still works as a fallback (not removed)
5. No security regression — only works when `instance_user_roles` table has zero `instance_admin` entries

## Technical Notes

### Approach

In the auth signup/login flow (Better Auth hooks or middleware), after successful authentication:

1. Check if any `instance_admin` exists in `instance_user_roles`
2. If NO admin exists → auto-promote this user:
   - Insert `instance_admin` role for this user in `instance_user_roles`
   - Skip the invite requirement
   - Redirect to `/onboarding`
3. If admin exists → normal flow (require invite to join a company)

### Key Files

- `server/src/routes/health.ts` — `bootstrapStatus` check (lines 78-85)
- `server/src/routes/access.ts` — invite/join flow, `bootstrap_ceo` invite handling
- `server/src/auth/` — Better Auth configuration, signup hooks
- `ui/src/App.tsx` — `CompanyRootRedirect` (lines 185-202), routing logic

### Edge Cases

- Race condition: two users sign up simultaneously on fresh instance → only first gets admin (use DB constraint or transaction)
- Instance with users but no admin (manual DB deletion) → should still auto-bootstrap next login
- SSO flow: first SSO user should also auto-bootstrap

## Dependencies

None — standalone story.

## Definition of Done

- [ ] Fresh instance: first signup → auto-admin → onboarding wizard
- [ ] Second signup → normal invite/join flow
- [ ] No CLI command needed for deployment
- [ ] `bootstrap-ceo` CLI still works as fallback
- [ ] Tested on Dokploy deployment
