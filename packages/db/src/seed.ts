import { createDb } from "./client.js";
import {
  companies,
  agents,
  goals,
  projects,
  issues,
  authUsers,
  instanceUserRoles,
  companyMemberships,
} from "./schema/index.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const db = createDb(url);

console.log("Seeding database...");

// ── Auth user (instance admin) ──────────────────────────────────────────────
const now = new Date();
const adminUserId = "seed-admin-001";

await db
  .insert(authUsers)
  .values({
    id: adminUserId,
    name: "Admin User",
    email: "admin@mnm.dev",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })
  .onConflictDoNothing();

await db
  .insert(instanceUserRoles)
  .values({
    userId: adminUserId,
    role: "instance_admin",
  })
  .onConflictDoNothing();

// ── Company ─────────────────────────────────────────────────────────────────
const [company] = await db
  .insert(companies)
  .values({
    name: "MnM Demo Co",
    description: "A demo autonomous company",
    status: "active",
    budgetMonthlyCents: 50000,
  })
  .onConflictDoNothing()
  .returning();

if (!company) {
  console.log("Seed already applied (company exists). Skipping.");
  process.exit(0);
}

// ── Company membership for admin ────────────────────────────────────────────
await db
  .insert(companyMemberships)
  .values({
    companyId: company.id,
    principalType: "user",
    principalId: adminUserId,
    status: "active",
    membershipRole: "owner",
  })
  .onConflictDoNothing();

// ── Agents with hierarchy ───────────────────────────────────────────────────
const [ceo] = await db
  .insert(agents)
  .values({
    companyId: company.id,
    name: "CEO Agent",
    title: "Chief Executive Officer",
    status: "idle",
    adapterType: "process",
    adapterConfig: { command: "echo", args: ["hello from ceo"] },
    budgetMonthlyCents: 15000,
  })
  .returning();

const [cto] = await db
  .insert(agents)
  .values({
    companyId: company.id,
    name: "CTO Agent",
    title: "Chief Technology Officer",
    status: "idle",
    reportsTo: ceo!.id,
    adapterType: "process",
    adapterConfig: { command: "echo", args: ["hello from cto"] },
    budgetMonthlyCents: 12000,
  })
  .returning();

const [engineer] = await db
  .insert(agents)
  .values({
    companyId: company.id,
    name: "Engineer Agent",
    title: "Software Engineer",
    status: "idle",
    reportsTo: cto!.id,
    adapterType: "process",
    adapterConfig: { command: "echo", args: ["hello from engineer"] },
    budgetMonthlyCents: 10000,
  })
  .returning();

const [qa] = await db
  .insert(agents)
  .values({
    companyId: company.id,
    name: "QA Agent",
    title: "Quality Assurance Engineer",
    status: "idle",
    reportsTo: cto!.id,
    adapterType: "process",
    adapterConfig: { command: "echo", args: ["hello from qa"] },
    budgetMonthlyCents: 8000,
  })
  .returning();

// ── Permission grants for admin user ────────────────────────────────────────
const adminPermissions = [
  "company:manage",
  "agents:manage",
  "projects:manage",
  "issues:manage",
  "members:manage",
];

for (const permissionKey of adminPermissions) {
  await db
    .values({
      companyId: company.id,
      principalType: "user",
      principalId: adminUserId,
      permissionKey,
      grantedByUserId: adminUserId,
    })
    .onConflictDoNothing();
}

// ── Goals ───────────────────────────────────────────────────────────────────
const [goal] = await db
  .insert(goals)
  .values({
    companyId: company.id,
    title: "Ship V1",
    description: "Deliver first control plane release",
    level: "company",
    status: "active",
    ownerAgentId: ceo!.id,
  })
  .returning();

// ── Projects ────────────────────────────────────────────────────────────────
const [project] = await db
  .insert(projects)
  .values({
    companyId: company.id,
    goalId: goal!.id,
    name: "Control Plane MVP",
    description: "Implement core board + agent loop",
    status: "in_progress",
    leadAgentId: ceo!.id,
  })
  .returning();

// ── Issues ──────────────────────────────────────────────────────────────────
await db.insert(issues).values([
  {
    companyId: company.id,
    projectId: project!.id,
    goalId: goal!.id,
    title: "Implement atomic task checkout",
    description: "Ensure in_progress claiming is conflict-safe",
    status: "todo",
    priority: "high",
    assigneeAgentId: engineer!.id,
    createdByAgentId: ceo!.id,
  },
  {
    companyId: company.id,
    projectId: project!.id,
    goalId: goal!.id,
    title: "Add budget auto-pause",
    description: "Pause agent at hard budget ceiling",
    status: "backlog",
    priority: "medium",
    createdByAgentId: ceo!.id,
  },
  {
    companyId: company.id,
    projectId: project!.id,
    goalId: goal!.id,
    title: "Setup E2E test pipeline",
    description: "Configure Playwright for automated QA",
    status: "todo",
    priority: "high",
    assigneeAgentId: qa!.id,
    createdByAgentId: cto!.id,
  },
]);

console.log("Seed complete");
process.exit(0);
