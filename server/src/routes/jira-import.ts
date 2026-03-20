// onb-s03-routes

import { Router } from "express";
import type { Db } from "@mnm/db";
import { jiraImportService } from "../services/jira-import.js";
import { createJiraClient } from "../services/jira-client.js";
import { jiraConnectionSchema, importConfigSchema } from "../services/jira-validators.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";
import { badRequest } from "../errors.js";

export function jiraImportRoutes(db: Db) {
  const router = Router();
  const importSvc = jiraImportService(db);

  // onb-s03-route-connect
  // POST /companies/:companyId/import/jira/connect — test Jira connection
  router.post(
    "/companies/:companyId/import/jira/connect",
    requirePermission(db, "projects:manage"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const parsed = jiraConnectionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const client = createJiraClient(parsed.data.baseUrl, parsed.data.email, parsed.data.apiToken);
      const serverInfo = await client.testConnection();

      res.json({ connected: true, serverInfo });
    },
  );

  // onb-s03-route-preview
  // POST /companies/:companyId/import/jira/preview — preview available projects/issues
  router.post(
    "/companies/:companyId/import/jira/preview",
    requirePermission(db, "projects:manage"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const parsed = jiraConnectionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const client = createJiraClient(parsed.data.baseUrl, parsed.data.email, parsed.data.apiToken);
      const jiraProjects = await client.fetchProjects();

      const projectsWithCounts = await Promise.all(
        jiraProjects.map(async (p) => {
          try {
            const issueCount = await client.getIssueCount(p.key);
            return { key: p.key, name: p.name, issueCount };
          } catch {
            return { key: p.key, name: p.name, issueCount: 0 };
          }
        }),
      );

      const totalIssueCount = projectsWithCounts.reduce((sum, p) => sum + p.issueCount, 0);

      res.json({ projects: projectsWithCounts, totalIssueCount });
    },
  );

  // onb-s03-route-start
  // POST /companies/:companyId/import/jira/start — start import
  router.post(
    "/companies/:companyId/import/jira/start",
    requirePermission(db, "projects:manage"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const parsed = importConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const userId = req.actor?.userId;
      const job = await importSvc.startImport(companyId as string, parsed.data, userId);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "import.started",
        targetType: "import_job",
        targetId: job.id,
        metadata: { source: "jira", projectKeys: parsed.data.projectKeys },
      });

      res.json({ jobId: job.id, status: job.status });
    },
  );

  // onb-s03-route-list-jobs
  // GET /companies/:companyId/import/jira/jobs — list import jobs
  router.get(
    "/companies/:companyId/import/jira/jobs",
    requirePermission(db, "projects:manage"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const jobs = await importSvc.listImportJobs(companyId as string);
      res.json({ jobs });
    },
  );

  // onb-s03-route-job-detail
  // GET /companies/:companyId/import/jira/jobs/:jobId — get job status
  router.get(
    "/companies/:companyId/import/jira/jobs/:jobId",
    requirePermission(db, "projects:manage"),
    async (req, res) => {
      const { companyId, jobId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const status = await importSvc.getImportStatus(jobId as string);
      res.json(status);
    },
  );

  // onb-s03-route-cancel
  // POST /companies/:companyId/import/jira/jobs/:jobId/cancel — cancel import
  router.post(
    "/companies/:companyId/import/jira/jobs/:jobId/cancel",
    requirePermission(db, "projects:manage"),
    async (req, res) => {
      const { companyId, jobId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const result = await importSvc.cancelImport(jobId as string);

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "import.cancelled",
        targetType: "import_job",
        targetId: jobId as string,
        metadata: { source: "jira" },
      });

      res.json(result);
    },
  );

  return router;
}
