// onb-s03-import-service

import type { Db } from "@mnm/db";
import { importJobs, issues, projects } from "@mnm/db";
import { eq, and } from "drizzle-orm";
import { createJiraClient } from "./jira-client.js";
import {
  mapJiraIssueToMnm,
  mapJiraProjectToMnm,
  type JiraFieldMappingConfig,
} from "./jira-field-mapping.js";

const BATCH_SIZE = 50;

export interface StartImportInput {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKeys: string[];
  fieldMapping?: JiraFieldMappingConfig;
}

export function jiraImportService(db: Db) {
  // onb-s03-svc-startImport
  async function startImport(companyId: string, config: StartImportInput, userId?: string) {
    // Create import job record
    const [job] = await db
      .insert(importJobs)
      .values({
        companyId,
        source: "jira",
        status: "pending",
        config: {
          baseUrl: config.baseUrl,
          email: config.email,
          projectKeys: config.projectKeys,
          fieldMapping: config.fieldMapping ?? {},
          errors: [],
        },
        progressTotal: 0,
        progressDone: 0,
        startedByUserId: userId ?? null,
        startedAt: new Date(),
      })
      .returning();

    // Launch async processing (fire and forget)
    processImport(job.id, companyId, config).catch((err) => {
      // Update job with failure
      db.update(importJobs)
        .set({
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importJobs.id, job.id))
        .execute()
        .catch(() => {
          /* swallow DB error on failure update */
        });
    });

    return job;
  }

  // onb-s03-svc-processImport
  async function processImport(jobId: string, companyId: string, config: StartImportInput) {
    const client = createJiraClient(config.baseUrl, config.email, config.apiToken);

    // Mark as running
    await db
      .update(importJobs)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(importJobs.id, jobId));

    const errors: Array<{ issueKey: string; message: string }> = [];
    let totalImported = 0;
    let totalIssues = 0;

    // Phase 1: Calculate total issues
    for (const projectKey of config.projectKeys) {
      try {
        const count = await client.getIssueCount(projectKey);
        totalIssues += count;
      } catch (err) {
        errors.push({
          issueKey: `${projectKey}/*`,
          message: `Failed to count issues: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // Update total
    await db
      .update(importJobs)
      .set({ progressTotal: totalIssues, updatedAt: new Date() })
      .where(eq(importJobs.id, jobId));

    // Phase 2: Import projects and issues
    for (const projectKey of config.projectKeys) {
      // Check if cancelled
      const [currentJob] = await db
        .select({ status: importJobs.status })
        .from(importJobs)
        .where(eq(importJobs.id, jobId))
        .limit(1);

      if (currentJob?.status === "cancelled") {
        return;
      }

      // Deduplicate/create project
      let projectId: string | undefined;
      try {
        const jiraProjects = await client.fetchProjects();
        const jiraProject = jiraProjects.find((p) => p.key === projectKey);
        if (jiraProject) {
          projectId = await deduplicateProject(jiraProject.key, companyId, jiraProject.name);
        }
      } catch (err) {
        errors.push({
          issueKey: `${projectKey}/project`,
          message: `Failed to create project: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      // Import issues in batches
      let startAt = 0;
      let hasMore = true;

      while (hasMore) {
        // Check if cancelled mid-batch
        const [jobState] = await db
          .select({ status: importJobs.status })
          .from(importJobs)
          .where(eq(importJobs.id, jobId))
          .limit(1);

        if (jobState?.status === "cancelled") {
          return;
        }

        try {
          const batch = await client.fetchIssuesBatch(projectKey, startAt, BATCH_SIZE);

          for (const jiraIssue of batch.issues) {
            try {
              await deduplicateIssue(jiraIssue.key, companyId, {
                ...mapJiraIssueToMnm(jiraIssue, companyId, config.fieldMapping),
                projectId,
              });
              totalImported++;
            } catch (err) {
              errors.push({
                issueKey: jiraIssue.key,
                message: err instanceof Error ? err.message : String(err),
              });
            }
          }

          // Update progress
          await db
            .update(importJobs)
            .set({
              progressDone: totalImported,
              config: {
                baseUrl: config.baseUrl,
                email: config.email,
                projectKeys: config.projectKeys,
                fieldMapping: config.fieldMapping ?? {},
                errors,
              },
              updatedAt: new Date(),
            })
            .where(eq(importJobs.id, jobId));

          startAt += batch.issues.length;
          hasMore = startAt < batch.total;
        } catch (err) {
          errors.push({
            issueKey: `${projectKey}/batch@${startAt}`,
            message: err instanceof Error ? err.message : String(err),
          });
          hasMore = false; // Stop processing this project on batch error
        }
      }
    }

    // Mark as completed
    await db
      .update(importJobs)
      .set({
        status: "completed",
        progressDone: totalImported,
        config: {
          baseUrl: config.baseUrl,
          email: config.email,
          projectKeys: config.projectKeys,
          fieldMapping: config.fieldMapping ?? {},
          errors,
        },
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId));
  }

  // onb-s03-svc-deduplicateIssue
  async function deduplicateIssue(
    identifier: string,
    companyId: string,
    data: Record<string, unknown>,
  ) {
    // Check if issue already exists by identifier
    const [existing] = await db
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.identifier, identifier), eq(issues.companyId, companyId)))
      .limit(1);

    if (existing) {
      // Update existing issue
      await db
        .update(issues)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(issues.id, existing.id));
      return existing.id;
    } else {
      // Insert new issue
      const [created] = await db
        .insert(issues)
        .values(data as typeof issues.$inferInsert)
        .returning({ id: issues.id });
      return created.id;
    }
  }

  // onb-s03-svc-deduplicateProject
  async function deduplicateProject(
    jiraKey: string,
    companyId: string,
    name: string,
  ): Promise<string> {
    // Look for existing project with same name in same company
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.name, name), eq(projects.companyId, companyId)))
      .limit(1);

    if (existing) {
      return existing.id;
    }

    // Create new project
    const projectData = mapJiraProjectToMnm({ id: "", key: jiraKey, name }, companyId);
    const [created] = await db
      .insert(projects)
      .values(projectData)
      .returning({ id: projects.id });
    return created.id;
  }

  // onb-s03-svc-getImportStatus
  async function getImportStatus(jobId: string) {
    const [job] = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, jobId))
      .limit(1);

    if (!job) {
      throw new Error(`Import job not found: ${jobId}`);
    }

    const config = job.config as Record<string, unknown>;
    return {
      jobId: job.id,
      status: job.status as string,
      progressTotal: job.progressTotal,
      progressDone: job.progressDone,
      errors: (config?.errors as Array<{ issueKey: string; message: string }>) ?? [],
      source: job.source,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }

  // onb-s03-svc-listImportJobs
  async function listImportJobs(companyId: string) {
    const jobs = await db
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.companyId, companyId), eq(importJobs.source, "jira")))
      .orderBy(importJobs.createdAt);

    return jobs.map((job) => {
      const config = job.config as Record<string, unknown>;
      return {
        jobId: job.id,
        status: job.status,
        progressTotal: job.progressTotal,
        progressDone: job.progressDone,
        errors: (config?.errors as Array<{ issueKey: string; message: string }>) ?? [],
        source: job.source,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
      };
    });
  }

  // onb-s03-svc-cancelImport
  async function cancelImport(jobId: string) {
    const [updated] = await db
      .update(importJobs)
      .set({
        status: "cancelled",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId))
      .returning();

    if (!updated) {
      throw new Error(`Import job not found: ${jobId}`);
    }

    return { jobId: updated.id, status: "cancelled" };
  }

  return {
    startImport,
    processImport,
    deduplicateIssue,
    deduplicateProject,
    getImportStatus,
    listImportJobs,
    cancelImport,
  };
}
