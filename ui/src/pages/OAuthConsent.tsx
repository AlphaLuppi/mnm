import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Shield } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FullPageLoader } from "@/components/FullPageLoader";

// ── Types ──────────────────────────────────────────────────────────────────

interface ConsentData {
  clientName: string;
  userPermissions: string[];
  csrfToken: string;
}

interface PermEntry {
  slug: string;
  description: string;
  action: string;
  category: string;
  tier: "read" | "write" | "admin";
  destructive: boolean;
}

// ── Permission metadata (client-side, mirrors @mnm/shared) ─────────────────

const CATEGORY_LABELS: Record<string, string> = {
  agents: "Agents",
  issues: "Issues & Taches",
  stories: "Stories",
  projects: "Projets",
  users: "Utilisateurs",
  workflows: "Workflows",
  traces: "Traces & Observabilite",
  dashboard: "Dashboard",
  admin: "Administration",
  chat: "Chat",
  documents: "Documents",
  artifacts: "Artefacts",
  folders: "Dossiers",
  sandbox: "Sandbox",
  config: "Configuration",
  feedback: "Feedback",
  routines: "Routines",
  org: "Organisation",
  inbox: "Boite de reception",
};

const CATEGORY_ORDER = [
  "agents", "issues", "stories", "projects", "users",
  "workflows", "traces", "dashboard", "admin", "chat",
  "documents", "artifacts", "folders", "sandbox", "config",
  "feedback", "routines", "org", "inbox",
];

function classifyPermission(slug: string, destructive: boolean): "read" | "write" | "admin" {
  if (destructive) return "admin";
  if (
    slug.endsWith(":read") || slug.endsWith(":view") ||
    slug === "dashboard:view" || slug === "org:view" || slug === "inbox:read"
  ) return "read";
  return "write";
}

function actionLabel(slug: string): string {
  const action = slug.split(":")[1] ?? slug;
  return action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, " ");
}

function categoryFromSlug(slug: string): string {
  return slug.split(":")[0] ?? "unknown";
}

// ── Component ──────────────────────────────────────────────────────────────

export function OAuthConsentPage() {
  const [searchParams] = useSearchParams();

  // OAuth params from URL
  const clientId = searchParams.get("client_id") ?? "";
  const redirectUri = searchParams.get("redirect_uri") ?? "";
  const codeChallenge = searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = searchParams.get("code_challenge_method") ?? "S256";
  const state = searchParams.get("state") ?? "";
  const scope = searchParams.get("scope") ?? "";
  const resource = searchParams.get("resource") ?? "";

  // Fetch consent data (client name + user permissions + CSRF token)
  const { data: consentData, isLoading, error } = useQuery<ConsentData>({
    queryKey: ["oauth-consent-data", clientId],
    queryFn: async () => {
      const res = await fetch(`/oauth/consent-data?client_id=${encodeURIComponent(clientId)}`, {
        credentials: "include",
      });
      if (res.status === 401) {
        // Not logged in — redirect to auth with return
        const returnUrl = `/oauth-consent?${searchParams.toString()}`;
        window.location.href = `/auth?next=${encodeURIComponent(returnUrl)}`;
        throw new Error("Redirecting to login");
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { error_description?: string } | null)?.error_description ?? "Failed to load consent data");
      }
      return res.json();
    },
    retry: false,
    enabled: !!clientId,
  });

  // Build permission entries from user's permission slugs
  const { domains, allPerms, permTiers } = useMemo(() => {
    if (!consentData?.userPermissions) return { domains: [] as { category: string; label: string; permissions: PermEntry[] }[], allPerms: [] as PermEntry[], permTiers: {} as Record<string, string> };

    const permsMap = new Map<string, PermEntry[]>();
    const allEntries: PermEntry[] = [];
    const tierMap: Record<string, string> = {};

    for (const slug of consentData.userPermissions) {
      const cat = categoryFromSlug(slug);
      // We don't have PERMISSION_META on the client, so infer what we can
      const destructive = slug.endsWith(":delete") || slug === "company:delete" || slug === "users:remove";
      const tier = classifyPermission(slug, destructive);
      const entry: PermEntry = {
        slug,
        description: slug, // Will be overridden by server data if available
        action: actionLabel(slug),
        category: cat,
        tier,
        destructive,
      };
      if (!permsMap.has(cat)) permsMap.set(cat, []);
      permsMap.get(cat)!.push(entry);
      allEntries.push(entry);
      tierMap[slug] = tier;
    }

    const domainList = CATEGORY_ORDER
      .filter((cat) => permsMap.has(cat))
      .map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] ?? cat,
        permissions: permsMap.get(cat)!,
      }));

    return { domains: domainList, allPerms: allEntries, permTiers: tierMap };
  }, [consentData?.userPermissions]);

  // Permission selection state — default: read+write checked, admin unchecked
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (allPerms.length > 0 && !initialized.current) {
      initialized.current = true;
      const defaultSelected = new Set(
        allPerms.filter((p) => p.tier === "read" || p.tier === "write").map((p) => p.slug),
      );
      setSelectedPerms(defaultSelected);
      // Expand all domains by default
      setExpandedDomains(new Set(domains.map((d) => d.category)));
    }
  }, [allPerms, domains]);

  const togglePerm = useCallback((slug: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const toggleDomain = useCallback((cat: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const toggleAllInTier = useCallback((cat: string, tier: string) => {
    const domain = domains.find((d) => d.category === cat);
    if (!domain) return;
    const tierPerms = domain.permissions.filter((p) => p.tier === tier);
    const allChecked = tierPerms.every((p) => selectedPerms.has(p.slug));
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      for (const p of tierPerms) {
        if (allChecked) next.delete(p.slug);
        else next.add(p.slug);
      }
      return next;
    });
  }, [domains, selectedPerms]);

  // Quick action helpers
  const selectAll = useCallback(() => {
    setSelectedPerms(new Set(allPerms.map((p) => p.slug)));
  }, [allPerms]);

  const selectReadOnly = useCallback(() => {
    setSelectedPerms(new Set(allPerms.filter((p) => p.tier === "read").map((p) => p.slug)));
  }, [allPerms]);

  const selectNone = useCallback(() => {
    setSelectedPerms(new Set());
  }, []);

  // Derive scopes from selected permissions
  const derivedScopes = useMemo(() => {
    const scopes = new Set<string>();
    for (const slug of selectedPerms) {
      const tier = permTiers[slug];
      if (tier === "read") scopes.add("mcp:read");
      else if (tier === "write") scopes.add("mcp:write");
      else if (tier === "admin") scopes.add("mcp:admin");
    }
    return [...scopes].join(",");
  }, [selectedPerms, permTiers]);

  // Form submission via fetch
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleApprove = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new URLSearchParams();
      formData.set("client_id", clientId);
      formData.set("redirect_uri", redirectUri);
      formData.set("code_challenge", codeChallenge);
      formData.set("code_challenge_method", codeChallengeMethod);
      if (state) formData.set("state", state);
      if (resource) formData.set("resource", resource);
      formData.set("csrf_token", consentData!.csrfToken);
      formData.set("consent", "approve");
      derivedScopes.split(",").filter(Boolean).forEach(s => formData.append("scopes", s));
      selectedPerms.forEach(p => formData.append("permissions", p));

      const res = await fetch("/oauth/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: formData.toString(),
        credentials: "include",
      });

      const data = await res.json().catch(() => ({ error: "unknown" }));

      if (!res.ok) {
        if (data.error === "login_required") {
          window.location.href = `/auth?next=${encodeURIComponent(window.location.href)}`;
          return;
        }
        setSubmitError(data.error_description || data.error || "Echec de l'autorisation");
        return;
      }

      // Server returns JSON with redirect URL — navigate to complete OAuth flow
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }
    } catch {
      setSubmitError("Erreur reseau — veuillez reessayer");
    } finally {
      setSubmitting(false);
    }
  }, [clientId, redirectUri, codeChallenge, codeChallengeMethod, state, resource, consentData, derivedScopes, selectedPerms]);

  const denyUrl = useMemo(() => {
    if (!redirectUri) return "/";
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    return url.toString();
  }, [redirectUri, state]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading) return <FullPageLoader />;

  if (error || !consentData) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Card className="max-w-md w-full rounded-xl">
          <CardHeader>
            <CardTitle>Erreur</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : "Impossible de charger les donnees de consentement."}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              Retour
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const tierDotColor = { read: "bg-emerald-500", write: "bg-blue-500", admin: "bg-red-500" };
  const tierLabels = { read: "Lecture", write: "Ecriture", admin: "Admin" };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4 overflow-y-auto">
      <div className="w-full max-w-xl my-auto">
        <Card className="rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">MnM OAuth</span>
            </div>
            <CardTitle className="text-base">Autoriser l'acces</CardTitle>
            <CardDescription>
              <span className="font-semibold text-primary">{consentData.clientName}</span> demande acces a votre compte MnM.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedPerms.size}</span> / {allPerms.length} permissions
              </span>
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-6 px-2.5 text-xs" onClick={selectAll}>
                  Tout
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-6 px-2.5 text-xs" onClick={selectReadOnly}>
                  Lecture
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-6 px-2.5 text-xs" onClick={selectNone}>
                  Aucun
                </Button>
              </div>
            </div>

            {/* Domains */}
            <div className="border border-border rounded-md overflow-hidden max-h-[440px] overflow-y-auto">
              {domains.map((domain) => {
                const domainSelected = domain.permissions.filter((p) => selectedPerms.has(p.slug)).length;
                const isExpanded = expandedDomains.has(domain.category);

                // Group permissions by tier
                const byTier: Record<string, PermEntry[]> = { read: [], write: [], admin: [] };
                for (const p of domain.permissions) byTier[p.tier].push(p);

                return (
                  <div key={domain.category} className="border-b border-border last:border-b-0">
                    {/* Domain header */}
                    <button
                      type="button"
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
                      onClick={() => toggleDomain(domain.category)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1 text-sm font-semibold">{domain.label}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {domainSelected}/{domain.permissions.length}
                      </Badge>
                    </button>

                    {/* Domain body */}
                    {isExpanded && (
                      <div className="px-3 pb-2.5">
                        {(["read", "write", "admin"] as const)
                          .filter((tier) => byTier[tier].length > 0)
                          .map((tier) => (
                            <div key={tier} className="mt-1.5">
                              {/* Tier header */}
                              <div className="flex items-center gap-1.5 py-1">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tierDotColor[tier]}`} />
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {tierLabels[tier]}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {byTier[tier].length}
                                </span>
                                <button
                                  type="button"
                                  className="ml-auto text-[11px] font-medium text-primary hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAllInTier(domain.category, tier);
                                  }}
                                >
                                  {byTier[tier].every((p) => selectedPerms.has(p.slug)) ? "Tout decocher" : "Tout"}
                                </button>
                              </div>

                              {/* Permission rows */}
                              <div className="flex flex-col gap-px mt-0.5">
                                {byTier[tier].map((p) => (
                                  <label
                                    key={p.slug}
                                    className={`flex items-start gap-2 px-1.5 py-1 rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                                      p.destructive ? "text-destructive" : ""
                                    }`}
                                  >
                                    <Checkbox
                                      checked={selectedPerms.has(p.slug)}
                                      onCheckedChange={() => togglePerm(p.slug)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-baseline gap-1.5 flex-wrap">
                                        <span className={`text-xs font-medium ${p.destructive ? "text-destructive" : ""}`}>
                                          {p.action}
                                        </span>
                                        <code className={`text-[10px] px-1 py-0 rounded ${
                                          p.destructive
                                            ? "bg-destructive/10 text-destructive"
                                            : "bg-muted text-muted-foreground"
                                        }`}>
                                          {p.slug}
                                        </code>
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>

          <Separator />

          <CardFooter className="flex flex-col gap-3 pt-4">
            {submitError && (
              <div className="w-full rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {submitError}
              </div>
            )}
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" asChild>
                <a href={denyUrl}>Refuser</a>
              </Button>
              <Button className="flex-1" onClick={handleApprove} disabled={selectedPerms.size === 0 || submitting}>
                {submitting ? "Autorisation..." : "Autoriser"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
