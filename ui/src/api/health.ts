import { apiBase } from "@/lib/api-base";

export type HealthStatus = {
  status: "ok";
  deploymentMode?: "local_trusted" | "authenticated";
  deploymentExposure?: "private" | "public";
  authReady?: boolean;
  bootstrapStatus?: "ready" | "bootstrap_pending";
  hasCompany?: boolean;
  features?: {
    companyDeletionEnabled?: boolean;
  };
  /**
   * Minimum desktop-client version this backend still accepts. `null`
   * means no minimum is enforced. Desktop builds below this version
   * surface a non-blocking update banner; older backends that do not
   * know the field leave it undefined, which the desktop treats the
   * same as `null` (never outdated).
   */
  minClientVersion?: string | null;
};

export const healthApi = {
  get: async (): Promise<HealthStatus> => {
    const base = apiBase();
    const url = base ? `${base}/api/health` : "/api/health";
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? `Failed to load health (${res.status})`);
    }
    return res.json();
  },
};
