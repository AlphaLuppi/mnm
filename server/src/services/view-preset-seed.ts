import { eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { viewPresets, companies } from "@mnm/db";
import { DEFAULT_LAYOUT, PRESET_LAYOUTS } from "@mnm/shared";
import { logger } from "../middleware/logger.js";

interface PresetDef {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  layout: Record<string, unknown>;
  isDefault: boolean;
}

const SEED_PRESETS: PresetDef[] = [
  {
    slug: "default",
    name: "Default",
    description: "Layout par defaut — toutes les sections visibles",
    icon: "layout-dashboard",
    color: "#6b7280",
    layout: DEFAULT_LAYOUT as unknown as Record<string, unknown>,
    isDefault: true,
  },
  {
    slug: "pm",
    name: "Product Manager",
    description: "Chat et folders en priorite, issues comme outil de ticketing",
    icon: "briefcase",
    color: "#6366f1",
    layout: PRESET_LAYOUTS.pm as unknown as Record<string, unknown>,
    isDefault: false,
  },
  {
    slug: "dev",
    name: "Developer",
    description: "Issues comme point d'entree, agents et traces pour le debug",
    icon: "code",
    color: "#10b981",
    layout: PRESET_LAYOUTS.dev as unknown as Record<string, unknown>,
    isDefault: false,
  },
  {
    slug: "exec",
    name: "Executive",
    description: "Vue synthetique — couts, sante globale, activite equipe",
    icon: "bar-chart-3",
    color: "#f59e0b",
    layout: PRESET_LAYOUTS.exec as unknown as Record<string, unknown>,
    isDefault: false,
  },
];

/**
 * Seeds the 4 default view presets for a company.
 * Idempotent — uses ON CONFLICT DO NOTHING.
 */
export async function seedViewPresets(db: Db, companyId: string): Promise<void> {
  const values = SEED_PRESETS.map((p) => ({
    companyId,
    slug: p.slug,
    name: p.name,
    description: p.description,
    icon: p.icon,
    color: p.color,
    layout: p.layout,
    isDefault: p.isDefault,
  }));

  await db.insert(viewPresets).values(values).onConflictDoNothing();
}

/**
 * Backfills view presets for ALL existing companies.
 * Idempotent — safe to run on every startup.
 */
export async function backfillViewPresets(db: Db): Promise<void> {
  const allCompanies = await db
    .select({ id: companies.id })
    .from(companies);

  if (allCompanies.length === 0) return;

  logger.info({ count: allCompanies.length }, "view-preset backfill: starting");

  for (const company of allCompanies) {
    await seedViewPresets(db, company.id);
  }

  logger.info({ count: allCompanies.length }, "view-preset backfill: complete");
}
