/**
 * DI-07: CAO Widget Generation Prompt Enrichment
 *
 * Builds an enriched system prompt for CAO when generating dashboard widgets.
 * Includes: user role/permissions/tags, API endpoints, block type catalogue,
 * and explicit instructions for generating valid ContentDocument JSON.
 */
import { eq, and } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { tags, tagAssignments } from "@mnm/db";
import { accessService } from "./access.js";
import { BLOCK_TYPES } from "@mnm/shared";

interface WidgetPromptContext {
  companyId: string;
  userId: string;
  userRequest: string;
}

/**
 * Fetch user tags for prompt enrichment.
 */
async function getUserTags(db: Db, companyId: string, userId: string): Promise<string[]> {
  const assignments = await db
    .select({ name: tags.name })
    .from(tagAssignments)
    .innerJoin(tags, eq(tags.id, tagAssignments.tagId))
    .where(
      and(
        eq(tagAssignments.targetType, "user"),
        eq(tagAssignments.targetId, userId),
        eq(tags.companyId, companyId),
      ),
    );
  return assignments.map((a) => a.name);
}

const BLOCK_CATALOGUE_DOC = `
## Content Block Types

You MUST generate a valid ContentDocument JSON. Format:
\`\`\`json
{
  "schemaVersion": 1,
  "blocks": [ ... ]
}
\`\`\`

### Display Blocks
- **metric-card**: { type: "metric-card", label: string, value: string|number, trend?: "up"|"down"|"flat", description?: string }
- **status-badge**: { type: "status-badge", variant: "success"|"warning"|"error"|"info"|"neutral", text: string }
- **data-table**: { type: "data-table", title?: string, columns: [{key: string, label: string, align?: "left"|"center"|"right"}], rows: [Record<string,string|number>], maxRows?: number }
- **code-block**: { type: "code-block", language?: string, code: string, title?: string }
- **progress-bar**: { type: "progress-bar", label: string, value: number (0-100), variant?: "default"|"success"|"warning"|"error" }
- **markdown**: { type: "markdown", content: string }
- **chart**: { type: "chart", chartType: "line"|"bar"|"pie"|"donut", title?: string, data: [{label: string, value: number, color?: string}] }
- **divider**: { type: "divider" }

### Interactive Blocks
- **action-button**: { type: "action-button", label: string, action: string, payload?: object, variant?: "default"|"destructive"|"outline"|"ghost", confirm?: string }
- **quick-form**: { type: "quick-form", title?: string, description?: string, fields: [{name, label, type: "text"|"textarea"|"select"|"checkbox"|"number"|"date", options?: [{label,value}], required?, placeholder?, defaultValue?}], submitLabel?: string, submitAction: string, submitPayload?: object }

### Layout Blocks
- **stack**: { type: "stack", direction?: "horizontal"|"vertical", gap?: "sm"|"md"|"lg", children: Block[] }
- **section**: { type: "section", title?: string, collapsible?: boolean, children: Block[] }
`;

const DATA_ENDPOINTS_DOC = `
## Available API Endpoints for Data Sources

When creating widgets with a data_source, use these endpoints (relative paths):
- GET /companies/{companyId}/dashboard/summary — overview metrics (agents, issues, costs)
- GET /companies/{companyId}/agents — list agents (name, status, lastHeartbeatAt)
- GET /companies/{companyId}/issues — list issues (status, priority, assignee)
- GET /companies/{companyId}/issues?status=in_progress,todo — filtered issues
- GET /companies/{companyId}/heartbeats — recent runs (status, duration, errors)
- GET /companies/{companyId}/costs — cost summary
- GET /companies/{companyId}/approvals — pending approvals

For dynamic widgets, set data_source to refresh periodically:
{ "endpoint": "/companies/{companyId}/dashboard/summary", "refreshInterval": 120 }
`;

const WIDGET_EXAMPLES = `
## Widget Examples

### Burn-down Chart
\`\`\`json
{
  "schemaVersion": 1,
  "blocks": [
    { "type": "chart", "chartType": "bar", "title": "Issue Status Distribution", "data": [
      { "label": "Backlog", "value": 12, "color": "#94a3b8" },
      { "label": "In Progress", "value": 5, "color": "#3b82f6" },
      { "label": "Done", "value": 8, "color": "#22c55e" }
    ]}
  ]
}
\`\`\`

### Agent Health Overview
\`\`\`json
{
  "schemaVersion": 1,
  "blocks": [
    { "type": "stack", "direction": "horizontal", "gap": "md", "children": [
      { "type": "metric-card", "label": "Active Agents", "value": 5, "trend": "up" },
      { "type": "metric-card", "label": "Failed Runs (24h)", "value": 2, "trend": "down" },
      { "type": "metric-card", "label": "Avg Duration", "value": "4m 12s" }
    ]},
    { "type": "data-table", "title": "Recent Failures", "columns": [
      { "key": "agent", "label": "Agent" },
      { "key": "error", "label": "Error" },
      { "key": "time", "label": "When" }
    ], "rows": [], "maxRows": 5 }
  ]
}
\`\`\`
`;

/**
 * Build the enriched system prompt for CAO widget generation.
 */
export async function buildWidgetGenerationPrompt(
  db: Db,
  ctx: WidgetPromptContext,
): Promise<string> {
  const access = accessService(db);
  const [permData, userTags] = await Promise.all([
    access.getEffectivePermissions(ctx.companyId, "user", ctx.userId),
    getUserTags(db, ctx.companyId, ctx.userId),
  ]);

  const sections = [
    `# Widget Generation Mode`,
    ``,
    `You are generating a dashboard widget for a MnM user.`,
    ``,
    `## Requesting User`,
    `- Role: ${permData.roleName ?? "Unknown"}`,
    `- Tags: ${userTags.length > 0 ? userTags.join(", ") : "(none)"}`,
    `- Permissions: ${permData.effectivePermissions.slice(0, 20).join(", ")}${permData.effectivePermissions.length > 20 ? ` (and ${permData.effectivePermissions.length - 20} more)` : ""}`,
    ``,
    BLOCK_CATALOGUE_DOC,
    DATA_ENDPOINTS_DOC,
    WIDGET_EXAMPLES,
    `## User Request`,
    `"${ctx.userRequest}"`,
    ``,
    `## Output Format`,
    `Respond with ONLY a JSON object containing:`,
    `\`\`\`json`,
    `{`,
    `  "title": "Short widget title",`,
    `  "description": "Brief description of what this widget shows",`,
    `  "blocks": { "schemaVersion": 1, "blocks": [...] },`,
    `  "dataSource": { "endpoint": "/companies/${ctx.companyId}/...", "refreshInterval": 120 } or null`,
    `  "span": 2`,
    `}`,
    `\`\`\``,
    ``,
    `Rules:`,
    `- Use ONLY the block types listed above`,
    `- Generate realistic placeholder data if no data_source is provided`,
    `- Keep widgets focused and concise (3-6 blocks max)`,
    `- Use horizontal stacks for metric cards`,
    `- Set span to 1 for small widgets, 2 for medium, 3-4 for wide widgets`,
    `- If the request involves real-time data, include a data_source with appropriate endpoint`,
    `- Available block types: ${BLOCK_TYPES.join(", ")}`,
  ];

  return sections.join("\n");
}
