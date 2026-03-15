import { type AnyPgColumn, pgTable, uuid, text, integer, timestamp, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    issuePrefix: text("issue_prefix").notNull().default("PAP"),
    issueCounter: integer("issue_counter").notNull().default(0),
    budgetMonthlyCents: integer("budget_monthly_cents").notNull().default(0),
    spentMonthlyCents: integer("spent_monthly_cents").notNull().default(0),
    requireBoardApprovalForNewAgents: boolean("require_board_approval_for_new_agents")
      .notNull()
      .default(true),
    brandColor: text("brand_color"),
    tier: text("tier").notNull().default("free"),
    ssoEnabled: boolean("sso_enabled").notNull().default(false),
    maxUsers: integer("max_users").notNull().default(50),
    invitationOnly: boolean("invitation_only").notNull().default(false),
    parentCompanyId: uuid("parent_company_id").references((): AnyPgColumn => companies.id),
    // a2a-s02-schema-company-col
    a2aDefaultPolicy: text("a2a_default_policy").notNull().default("allow"),
    // onb-s01-schema-onboarding-cols
    onboardingStep: integer("onboarding_step").notNull().default(0),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    onboardingData: jsonb("onboarding_data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    issuePrefixUniqueIdx: uniqueIndex("companies_issue_prefix_idx").on(table.issuePrefix),
  }),
);
