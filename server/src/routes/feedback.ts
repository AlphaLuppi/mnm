import { Router } from "express";
import type { Db } from "@mnm/db";
import { castFeedbackVoteSchema, feedbackSummaryFiltersSchema } from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { feedbackService } from "../services/feedback.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound } from "../errors.js";

export function feedbackRoutes(db: Db) {
  const router = Router();
  const svc = feedbackService(db);

  // Cast or update a vote on an agent comment
  router.post(
    "/companies/:companyId/issues/:issueId/feedback",
    validate(castFeedbackVoteSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const issueId = req.params.issueId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const authorUserId = actor.actorType === "user" ? actor.actorId : actor.actorId;

      const vote = await svc.castVote(companyId, issueId, req.body, authorUserId);
      res.status(200).json(vote);
    },
  );

  // Get all votes for an issue (with current user's vote highlighted)
  router.get(
    "/companies/:companyId/issues/:issueId/feedback",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const issueId = req.params.issueId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const userId = actor.actorId;

      const votes = await svc.getVotesForIssue(companyId, issueId, userId);
      res.json(votes);
    },
  );

  // Delete (retract) a vote
  router.delete(
    "/companies/:companyId/issues/:issueId/feedback/:targetId",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const targetId = req.params.targetId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const authorUserId = actor.actorId;

      // targetType is always "issue_comment" for now
      const deleted = await svc.deleteVote(companyId, "issue_comment", targetId, authorUserId);
      if (!deleted) {
        throw notFound("Vote not found");
      }
      res.status(200).json({ ok: true });
    },
  );

  // Get aggregate feedback summary (with optional filters)
  router.get(
    "/companies/:companyId/feedback/summary",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const parsed = feedbackSummaryFiltersSchema.safeParse(req.query);
      const filters = parsed.success ? parsed.data : {};

      const summary = await svc.getSummary(companyId, filters);
      res.json(summary);
    },
  );

  return router;
}
