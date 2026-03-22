import type { Db } from "@mnm/db";
import { instanceUserRoles } from "@mnm/db";
import {
  createTestCompany,
  createTestUser,
  createTestAgent,
  createTestProject,
  createTestIssue,
  createTestCompanyMembership,
  createTestPermissionGrant,
} from "../factories/index.js";

/**
 * Result of an E2E seed scenario, containing all created entities.
 */
export interface E2eSeedResult {
  admin: Awaited<ReturnType<typeof createTestUser>>;
  company: Awaited<ReturnType<typeof createTestCompany>>;
  ceoAgent: Awaited<ReturnType<typeof createTestAgent>>;
  engineerAgent: Awaited<ReturnType<typeof createTestAgent>>;
  project: Awaited<ReturnType<typeof createTestProject>>;
  issue: Awaited<ReturnType<typeof createTestIssue>>;
}

/**
 * Seed a full E2E scenario using factories.
 *
 * Creates:
 * - An admin user with instance_admin role
 * - A company
 * - A company membership for the admin
 * - Admin permission grants
 * - A CEO agent and an engineer agent (reporting to CEO)
 * - A project
 * - An issue in the project
 */
export async function seedE2eScenario(db: Db): Promise<E2eSeedResult> {
  // 1. Create admin user
  const admin = await createTestUser(db, {
    id: "e2e-admin-001",
    name: "E2E Admin",
    email: "e2e-admin@test.dev",
  });

  // 2. Grant instance_admin role
  await db.insert(instanceUserRoles).values({
    userId: admin.id,
    role: "instance_admin",
  });

  // 3. Create company
  const company = await createTestCompany(db, {
    name: "E2E Test Company",
    issuePrefix: "E2E",
    budgetMonthlyCents: 50000,
  });

  // 4. Create company membership for admin
  await createTestCompanyMembership(db, company.id, admin.id, {
    membershipRole: "owner",
  });

  // 5. Grant admin permissions
  const adminPermissions = [
    "company:manage",
    "agents:manage",
    "projects:manage",
    "issues:manage",
    "members:manage",
  ];
  for (const permissionKey of adminPermissions) {
    await createTestPermissionGrant(db, company.id, admin.id, permissionKey, {
      grantedByUserId: admin.id,
    });
  }

  // 6. Create agents with hierarchy
  const ceoAgent = await createTestAgent(db, company.id, {
    name: "E2E CEO Agent",
    title: "Chief Executive Officer",
    budgetMonthlyCents: 15000,
  });

  const engineerAgent = await createTestAgent(db, company.id, {
    name: "E2E Engineer Agent",
    title: "Software Engineer",
    reportsTo: ceoAgent.id,
    budgetMonthlyCents: 10000,
  });

  // 7. Create project
  const project = await createTestProject(db, company.id, {
    name: "E2E Test Project",
    status: "in_progress",
  });

  // 8. Create issue
  const issue = await createTestIssue(db, company.id, project.id, {
    title: "E2E Test Issue",
    status: "todo",
    priority: "high",
    assigneeAgentId: engineerAgent.id,
    createdByAgentId: ceoAgent.id,
  });

  return {
    admin,
    company,
    ceoAgent,
    engineerAgent,
    project,
    issue,
  };
}
