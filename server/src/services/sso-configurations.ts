import { and, eq, desc } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { ssoConfigurations, companies } from "@mnm/db";
import type {
  SsoConfiguration,
  CreateSsoConfigurationInput,
  UpdateSsoConfigurationInput,
} from "@mnm/shared";
import { notFound, conflict, badRequest } from "../errors.js";

function formatConfig(row: typeof ssoConfigurations.$inferSelect): SsoConfiguration {
  return {
    id: row.id,
    companyId: row.companyId,
    provider: row.provider as SsoConfiguration["provider"],
    displayName: row.displayName,
    config: row.config as Record<string, unknown>,
    enabled: row.enabled,
    emailDomain: row.emailDomain,
    metadataUrl: row.metadataUrl,
    entityId: row.entityId,
    certificate: row.certificate,
    status: (row.status ?? "draft") as SsoConfiguration["status"],
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastSyncError: row.lastSyncError,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// sso-s01-svc-list, sso-s01-svc-get, sso-s01-svc-create
// sso-s01-svc-update, sso-s01-svc-delete, sso-s01-svc-toggle
// sso-s01-svc-verify, sso-s01-svc-get-by-domain
export function ssoConfigurationService(db: Db) {
  // sso-s01-svc-list
  async function listConfigurations(companyId: string): Promise<SsoConfiguration[]> {
    const rows = await db
      .select()
      .from(ssoConfigurations)
      .where(eq(ssoConfigurations.companyId, companyId))
      .orderBy(desc(ssoConfigurations.createdAt));
    return rows.map(formatConfig);
  }

  // sso-s01-svc-get
  async function getConfigurationById(companyId: string, configId: string): Promise<SsoConfiguration> {
    const [row] = await db
      .select()
      .from(ssoConfigurations)
      .where(
        and(
          eq(ssoConfigurations.id, configId),
          eq(ssoConfigurations.companyId, companyId),
        ),
      );
    if (!row) throw notFound("SSO configuration not found");
    return formatConfig(row);
  }

  // sso-s01-svc-create
  async function createConfiguration(
    companyId: string,
    input: CreateSsoConfigurationInput,
    actorId: string,
  ): Promise<SsoConfiguration> {
    // Check unique provider per company
    const existing = await db
      .select()
      .from(ssoConfigurations)
      .where(
        and(
          eq(ssoConfigurations.companyId, companyId),
          eq(ssoConfigurations.provider, input.provider),
        ),
      );
    if (existing.length > 0) {
      throw conflict(`SSO configuration for provider ${input.provider} already exists`);
    }

    const [row] = await db
      .insert(ssoConfigurations)
      .values({
        companyId,
        provider: input.provider,
        displayName: input.displayName ?? null,
        config: input.config ?? {},
        enabled: input.enabled ?? false,
        emailDomain: input.emailDomain ?? null,
        metadataUrl: input.metadataUrl ?? null,
        entityId: input.entityId ?? null,
        certificate: input.certificate ?? null,
        status: "draft",
        createdByUserId: actorId,
      })
      .returning();

    // If created as enabled, sync company ssoEnabled
    if (row!.enabled) {
      await syncCompanySsoEnabled(companyId);
    }

    return formatConfig(row!);
  }

  // sso-s01-svc-update
  async function updateConfiguration(
    companyId: string,
    configId: string,
    input: UpdateSsoConfigurationInput,
  ): Promise<SsoConfiguration> {
    // Verify exists
    await getConfigurationById(companyId, configId);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.config !== undefined) updateData.config = input.config;
    if (input.emailDomain !== undefined) updateData.emailDomain = input.emailDomain;
    if (input.metadataUrl !== undefined) updateData.metadataUrl = input.metadataUrl;
    if (input.entityId !== undefined) updateData.entityId = input.entityId;
    if (input.certificate !== undefined) updateData.certificate = input.certificate;

    const [updated] = await db
      .update(ssoConfigurations)
      .set(updateData)
      .where(
        and(
          eq(ssoConfigurations.id, configId),
          eq(ssoConfigurations.companyId, companyId),
        ),
      )
      .returning();

    return formatConfig(updated!);
  }

  // sso-s01-svc-delete
  async function deleteConfiguration(
    companyId: string,
    configId: string,
  ): Promise<SsoConfiguration> {
    const config = await getConfigurationById(companyId, configId);

    if (config.enabled) {
      throw badRequest("Cannot delete an enabled SSO configuration. Disable it first.");
    }

    await db
      .delete(ssoConfigurations)
      .where(
        and(
          eq(ssoConfigurations.id, configId),
          eq(ssoConfigurations.companyId, companyId),
        ),
      );

    // Sync company ssoEnabled after deletion
    await syncCompanySsoEnabled(companyId);

    return config;
  }

  // sso-s01-svc-toggle
  async function toggleEnabled(
    companyId: string,
    configId: string,
  ): Promise<SsoConfiguration> {
    const config = await getConfigurationById(companyId, configId);
    const newEnabled = !config.enabled;

    const [updated] = await db
      .update(ssoConfigurations)
      .set({
        enabled: newEnabled,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ssoConfigurations.id, configId),
          eq(ssoConfigurations.companyId, companyId),
        ),
      )
      .returning();

    // Sync company ssoEnabled
    await syncCompanySsoEnabled(companyId);

    return formatConfig(updated!);
  }

  // sso-s01-svc-verify
  async function verifyConfiguration(
    companyId: string,
    configId: string,
  ): Promise<SsoConfiguration> {
    // Verify exists
    await getConfigurationById(companyId, configId);

    const [updated] = await db
      .update(ssoConfigurations)
      .set({
        status: "verified",
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ssoConfigurations.id, configId),
          eq(ssoConfigurations.companyId, companyId),
        ),
      )
      .returning();

    return formatConfig(updated!);
  }

  // sso-s01-svc-get-by-domain
  async function getByEmailDomain(emailDomain: string): Promise<SsoConfiguration | null> {
    const [row] = await db
      .select()
      .from(ssoConfigurations)
      .where(
        and(
          eq(ssoConfigurations.emailDomain, emailDomain.toLowerCase()),
          eq(ssoConfigurations.enabled, true),
        ),
      );
    return row ? formatConfig(row) : null;
  }

  // Internal helper: sync company.ssoEnabled based on whether any SSO config is enabled
  async function syncCompanySsoEnabled(companyId: string): Promise<void> {
    const enabledConfigs = await db
      .select()
      .from(ssoConfigurations)
      .where(
        and(
          eq(ssoConfigurations.companyId, companyId),
          eq(ssoConfigurations.enabled, true),
        ),
      );

    const hasSsoEnabled = enabledConfigs.length > 0;

    await db
      .update(companies)
      .set({
        ssoEnabled: hasSsoEnabled,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId));
  }

  return {
    listConfigurations,
    getConfigurationById,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
    toggleEnabled,
    verifyConfiguration,
    getByEmailDomain,
  };
}
