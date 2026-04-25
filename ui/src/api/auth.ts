export type AuthSession = {
  session: { id: string; userId: string };
  user: { id: string; email: string | null; name: string | null };
};

function toSession(value: unknown): AuthSession | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const sessionValue = record.session;
  const userValue = record.user;
  if (!sessionValue || typeof sessionValue !== "object") return null;
  if (!userValue || typeof userValue !== "object") return null;
  const session = sessionValue as Record<string, unknown>;
  const user = userValue as Record<string, unknown>;
  if (typeof session.id !== "string" || typeof session.userId !== "string") return null;
  if (typeof user.id !== "string") return null;
  return {
    session: { id: session.id, userId: session.userId },
    user: {
      id: user.id,
      email: typeof user.email === "string" ? user.email : null,
      name: typeof user.name === "string" ? user.name : null,
    },
  };
}

async function authPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/auth${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (payload as { error?: { message?: string } | string } | null)?.error &&
      typeof (payload as { error?: { message?: string } | string }).error === "object"
        ? ((payload as { error?: { message?: string } }).error?.message ?? `Request failed: ${res.status}`)
        : (payload as { error?: string } | null)?.error ?? `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return payload;
}

export const authApi = {
  getSession: async (): Promise<AuthSession | null> => {
    const res = await fetch("/api/auth/get-session", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (res.status === 401) return null;
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`Failed to load session (${res.status})`);
    }
    const direct = toSession(payload);
    if (direct) return direct;
    const nested = payload && typeof payload === "object" ? toSession((payload as Record<string, unknown>).data) : null;
    return nested;
  },

  signInEmail: async (input: { email: string; password: string }) => {
    await authPost("/sign-in/email", input);
  },

  signUpEmail: async (input: { name: string; email: string; password: string }) => {
    await authPost("/sign-up/email", input);
  },

  signOut: async () => {
    await authPost("/sign-out", {});
    try { window.sessionStorage.removeItem("mnm.splash.shown"); } catch {}
  },

  listLinkedAccounts: async (): Promise<LinkedAccount[]> => {
    const res = await fetch("/api/auth/list-accounts", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Failed to list accounts (${res.status})`);
    const payload = await res.json().catch(() => null);
    const rows = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as unknown[])
        : [];
    return rows
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => ({
        id: String(r.id ?? ""),
        providerId: String(r.providerId ?? r.provider_id ?? ""),
        accountId: String(r.accountId ?? r.account_id ?? ""),
        scopes: Array.isArray(r.scopes)
          ? (r.scopes as string[])
          : typeof r.scopes === "string"
            ? (r.scopes as string).split(",").map((s) => s.trim()).filter(Boolean)
            : [],
        accessTokenExpiresAt:
          r.accessTokenExpiresAt != null
            ? String(r.accessTokenExpiresAt)
            : r.access_token_expires_at != null
              ? String(r.access_token_expires_at)
              : null,
        createdAt: r.createdAt != null ? String(r.createdAt) : null,
      }));
  },

  /**
   * Start an OAuth flow to link a social provider to the current session.
   * BetterAuth returns `{url, redirect: true}` — we navigate to `url`, the
   * provider authenticates the user, then redirects back to `callbackURL`.
   *
   * IMPORTANT: this call must hit the BetterAuth origin DIRECTLY (not via
   * the Vite proxy on :5173), otherwise the state/pkce cookies end up on
   * :5173 and GitLab's post-auth redirect back to :3100 cannot find them
   * → `state_security_mismatch`. We hard-code `http://localhost:3100` in
   * dev (when the UI is on :5173); in prod UI + API share the same origin
   * so we fall back to a relative URL.
   */
  linkSocial: async (provider: "gitlab" | "microsoft", callbackURL: string) => {
    const isViteDev =
      typeof window !== "undefined" && window.location.port === "5173";
    const target = isViteDev
      ? "http://localhost:3100/api/auth/link-social"
      : "/api/auth/link-social";
    const res = await fetch(target, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, callbackURL }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        (payload as { error?: { message?: string } | string } | null)?.error &&
          typeof (payload as { error?: { message?: string } | string }).error === "object"
          ? ((payload as { error?: { message?: string } }).error?.message ??
              `link-social failed (${res.status})`)
          : (payload as { error?: string } | null)?.error ??
              `link-social failed (${res.status})`,
      );
    }
    const url =
      payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).url === "string"
        ? (payload as { url: string }).url
        : null;
    if (!url) throw new Error("Link flow did not return a redirect URL");
    window.location.href = url;
  },

  unlinkAccount: async (providerId: string, accountId?: string) => {
    await authPost("/unlink-account", accountId ? { providerId, accountId } : { providerId });
  },
};

export type LinkedAccount = {
  id: string;
  providerId: string;
  accountId: string;
  scopes: string[];
  accessTokenExpiresAt: string | null;
  createdAt: string | null;
};
