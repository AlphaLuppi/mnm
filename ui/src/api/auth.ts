import { apiBase } from "@/lib/api-base";
import { getCachedSessionToken, setSessionToken, clearSessionToken } from "@/lib/secrets-client";

export type AuthSession = {
  session: { id: string; userId: string };
  user: { id: string; email: string | null; name: string | null };
};

function authUrl(path: string): string {
  const base = apiBase();
  return base ? `${base}/api/auth${path}` : `/api/auth${path}`;
}

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

function extractSessionToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.token === "string") return record.token;
  if (record.session && typeof record.session === "object") {
    const session = record.session as Record<string, unknown>;
    if (typeof session.token === "string") return session.token;
  }
  return null;
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getCachedSessionToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function authPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(authUrl(path), {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
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
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = getCachedSessionToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(authUrl("/get-session"), {
      credentials: "include",
      headers,
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
    const payload = await authPost("/sign-in/email", input);
    const token = extractSessionToken(payload);
    if (token) {
      await setSessionToken(token);
    }
  },

  signUpEmail: async (input: { name: string; email: string; password: string }) => {
    const payload = await authPost("/sign-up/email", input);
    const token = extractSessionToken(payload);
    if (token) {
      await setSessionToken(token);
    }
  },

  signOut: async () => {
    await authPost("/sign-out", {});
    await clearSessionToken();
  },
};
