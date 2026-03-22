import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { companiesApi } from "../api/companies";
import { rolesApi, type Role, type CreateRoleInput } from "../api/roles";
import { tagsApi, type Tag } from "../api/tags";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "../lib/utils";
import { AsciiArtAnimation } from "./AsciiArtAnimation";
import { OnboardingProgressBar } from "./OnboardingProgressBar";
import { onboardingApi } from "../api/onboarding";
import { api } from "../api/client";
import {
  Building2,
  Shield,
  Tag as TagIcon,
  Users,
  Rocket,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  Loader2,
  X,
  Wifi,
  WifiOff,
  Plus,
  UserPlus,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------
// Role presets
// ---------------------------------------------------------------------------
type RolePreset = "startup" | "structured" | "custom";

const PRESET_ROLES: Record<Exclude<RolePreset, "custom">, CreateRoleInput[]> = {
  startup: [
    { name: "Member", slug: "member", description: "Standard team member", hierarchyLevel: 10, permissionSlugs: ["issues.read", "issues.write", "agents.read", "projects.read", "projects.write"] },
  ],
  structured: [
    { name: "Lead", slug: "lead", description: "Team lead with elevated access", hierarchyLevel: 5, permissionSlugs: ["issues.read", "issues.write", "issues.delete", "agents.read", "agents.write", "projects.read", "projects.write", "members.read"] },
    { name: "Member", slug: "member", description: "Standard team member", hierarchyLevel: 10, permissionSlugs: ["issues.read", "issues.write", "agents.read", "projects.read", "projects.write"] },
    { name: "Viewer", slug: "viewer", description: "Read-only access", hierarchyLevel: 20, permissionSlugs: ["issues.read", "agents.read", "projects.read"] },
  ],
};

// ---------------------------------------------------------------------------
// Tag suggestions
// ---------------------------------------------------------------------------
const TAG_SUGGESTIONS: { category: string; tags: { name: string; color: string }[] }[] = [
  {
    category: "By team",
    tags: [
      { name: "Frontend", color: "#3b82f6" },
      { name: "Backend", color: "#10b981" },
      { name: "Design", color: "#f59e0b" },
      { name: "QA", color: "#ef4444" },
    ],
  },
  {
    category: "By product",
    tags: [
      { name: "Product-A", color: "#8b5cf6" },
      { name: "Product-B", color: "#ec4899" },
    ],
  },
  {
    category: "By function",
    tags: [
      { name: "Engineering", color: "#06b6d4" },
      { name: "Marketing", color: "#f97316" },
      { name: "Operations", color: "#6366f1" },
    ],
  },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// OnboardingWizard
// ---------------------------------------------------------------------------
export function OnboardingWizard() {
  const [searchParams] = useSearchParams();
  const { companyId: paramCompanyId } = useParams<{ companyId?: string }>();
  const { companies, setSelectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const initialStep = (Number(searchParams.get("step")) || 1) as Step;
  const existingCompanyId = paramCompanyId ?? searchParams.get("companyId") ?? undefined;

  const [step, setStep] = useState<Step>(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Company
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");

  // Step 2 — Roles
  const [rolePreset, setRolePreset] = useState<RolePreset | null>(null);
  const [createdRoles, setCreatedRoles] = useState<Role[]>([]);
  const [customRoleName, setCustomRoleName] = useState("");
  const [customRoles, setCustomRoles] = useState<CreateRoleInput[]>([]);

  // Step 3 — Tags
  const [createdTags, setCreatedTags] = useState<Tag[]>([]);
  const [customTagName, setCustomTagName] = useState("");

  // Step 4 — Invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteTagIds, setInviteTagIds] = useState<string[]>([]);
  const [invites, setInvites] = useState<{ email: string; roleId: string; tagIds: string[] }[]>([]);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // onb-s01-sync-state
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("synced");
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Created entity IDs
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(
    existingCompanyId ?? null,
  );
  const [createdCompanyPrefix, setCreatedCompanyPrefix] = useState<string | null>(null);

  // Sync step and company from URL params on mount
  useEffect(() => {
    const cId = existingCompanyId ?? null;
    setStep(initialStep);
    setCreatedCompanyId(cId);
    setCreatedCompanyPrefix(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingCompanyId, initialStep]);

  // Backfill prefix for existing company
  useEffect(() => {
    if (!createdCompanyId || createdCompanyPrefix) return;
    const company = companies.find((c) => c.id === createdCompanyId);
    if (company) setCreatedCompanyPrefix(company.issuePrefix);
  }, [createdCompanyId, createdCompanyPrefix, companies]);

  // onb-s01-server-sync
  const syncToServer = useCallback((companyId: string, currentStep: number) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        await onboardingApi.updateStep(companyId, currentStep);
        setSyncStatus("synced");
      } catch {
        setSyncStatus("offline");
      }
    }, 2000);
  }, []);

  // onb-s01-localStorage-persistence
  useEffect(() => {
    if (!createdCompanyId) return;
    const key = `mnm-onboarding-${createdCompanyId}`;
    try {
      localStorage.setItem(key, JSON.stringify({ step, timestamp: Date.now() }));
    } catch {
      // localStorage not available
    }
    syncToServer(createdCompanyId, step);
  }, [step, createdCompanyId, syncToServer]);

  function reset() {
    setStep(1);
    setLoading(false);
    setError(null);
    setCompanyName("");
    setCompanyDescription("");
    setRolePreset(null);
    setCreatedRoles([]);
    setCustomRoleName("");
    setCustomRoles([]);
    setCreatedTags([]);
    setCustomTagName("");
    setInviteEmail("");
    setInviteRoleId("");
    setInviteTagIds([]);
    setInvites([]);
    setInviteSending(false);
    setInviteSuccess(null);
    setCreatedCompanyId(null);
    setCreatedCompanyPrefix(null);
  }

  function handleClose() {
    reset();
    navigate("/");
  }

  // -------------------------------------------------------------------------
  // Step 1: Create Company (bootstrapCompany runs server-side automatically)
  // -------------------------------------------------------------------------
  async function handleStep1Next() {
    setLoading(true);
    setError(null);
    try {
      const company = await companiesApi.create({
        name: companyName.trim(),
        description: companyDescription.trim() || undefined,
      });
      setCreatedCompanyId(company.id);
      setCreatedCompanyPrefix(company.issuePrefix);
      setSelectedCompanyId(company.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });

      // Fetch the admin role created by bootstrapCompany so we can show it
      try {
        const roles = await rolesApi.list(company.id);
        setCreatedRoles(roles);
      } catch {
        // Non-blocking: roles will be fetched in step 2
      }

      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Roles
  // -------------------------------------------------------------------------
  async function handleSelectPreset(preset: RolePreset) {
    if (!createdCompanyId) return;
    setRolePreset(preset);
    setError(null);

    if (preset === "custom") return;

    setLoading(true);
    try {
      const rolesToCreate = PRESET_ROLES[preset];
      const created: Role[] = [];
      for (const input of rolesToCreate) {
        const role = await rolesApi.create(createdCompanyId, input);
        created.push(role);
      }
      // Re-fetch all roles including the admin role from bootstrap
      const allRoles = await rolesApi.list(createdCompanyId);
      setCreatedRoles(allRoles);
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(createdCompanyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create roles");
      setRolePreset(null);
    } finally {
      setLoading(false);
    }
  }

  function handleAddCustomRole() {
    const name = customRoleName.trim();
    if (!name) return;
    if (customRoles.some((r) => r.slug === slugify(name))) {
      setError("A role with this name already exists");
      return;
    }
    setCustomRoles((prev) => [
      ...prev,
      {
        name,
        slug: slugify(name),
        description: "",
        hierarchyLevel: 10 + prev.length,
      },
    ]);
    setCustomRoleName("");
    setError(null);
  }

  function handleRemoveCustomRole(slug: string) {
    setCustomRoles((prev) => prev.filter((r) => r.slug !== slug));
  }

  async function handleStep2Next() {
    if (!createdCompanyId) return;

    // For custom preset, create the roles now
    if (rolePreset === "custom" && customRoles.length > 0) {
      setLoading(true);
      setError(null);
      try {
        for (const input of customRoles) {
          await rolesApi.create(createdCompanyId, input);
        }
        const allRoles = await rolesApi.list(createdCompanyId);
        setCreatedRoles(allRoles);
        queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(createdCompanyId) });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create roles");
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    setStep(3);
  }

  // -------------------------------------------------------------------------
  // Step 3: Tags
  // -------------------------------------------------------------------------
  async function handleAddTag(name: string, color: string) {
    if (!createdCompanyId) return;
    const slug = slugify(name);
    if (createdTags.some((t) => t.slug === slug)) {
      setError(`Tag "${name}" already exists`);
      return;
    }
    setError(null);
    try {
      const tag = await tagsApi.create(createdCompanyId, { name, slug, color });
      setCreatedTags((prev) => [...prev, tag]);
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.list(createdCompanyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag");
    }
  }

  async function handleAddCustomTag() {
    const name = customTagName.trim();
    if (!name) return;
    await handleAddTag(name, "#64748b");
    setCustomTagName("");
  }

  async function handleRemoveTag(tagId: string) {
    if (!createdCompanyId) return;
    try {
      await tagsApi.delete(createdCompanyId, tagId);
      setCreatedTags((prev) => prev.filter((t) => t.id !== tagId));
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.list(createdCompanyId) });
    } catch {
      // Non-blocking
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Invite
  // -------------------------------------------------------------------------
  function handleAddInvite() {
    const email = inviteEmail.trim();
    if (!email) {
      setError("Please enter an email address");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (invites.some((inv) => inv.email === email)) {
      setError("This email is already in the list");
      return;
    }
    setInvites((prev) => [...prev, { email, roleId: inviteRoleId, tagIds: [...inviteTagIds] }]);
    setInviteEmail("");
    setInviteTagIds([]);
    setError(null);
  }

  function handleRemoveInvite(index: number) {
    setInvites((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSendInvites() {
    if (!createdCompanyId || invites.length === 0) return;
    setInviteSending(true);
    setError(null);
    try {
      for (const inv of invites) {
        await api.post(`/companies/${createdCompanyId}/invites`, {
          allowedJoinTypes: "human",
          email: inv.email,
        });
      }
      setInviteSuccess(`Successfully sent ${invites.length} invitation(s)`);
      setInvites([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitations");
    } finally {
      setInviteSending(false);
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Complete
  // -------------------------------------------------------------------------
  async function handleComplete() {
    setLoading(true);
    setError(null);

    if (createdCompanyId) {
      try {
        await onboardingApi.complete(createdCompanyId);
      } catch {
        // non-blocking
      }
    }

    setLoading(false);
    reset();
    await queryClient.refetchQueries({ queryKey: queryKeys.companies.all });
    if (createdCompanyPrefix) {
      navigate(`/${createdCompanyPrefix}/dashboard`);
      return;
    }
    navigate("/dashboard");
  }

  // -------------------------------------------------------------------------
  // Keyboard navigation
  // -------------------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (step === 1 && companyName.trim()) handleStep1Next();
      else if (step === 2 && rolePreset) handleStep2Next();
      else if (step === 3) setStep(4);
      else if (step === 4) setStep(5);
      else if (step === 5) handleComplete();
    }
  }

  // Helpers for invite step
  const nonSystemRoles = createdRoles.filter((r) => !r.isSystem);
  const defaultRoleId = nonSystemRoles[0]?.id ?? createdRoles[0]?.id ?? "";

  // Set default role on step 4 mount
  useEffect(() => {
    if (step === 4 && !inviteRoleId && defaultRoleId) {
      setInviteRoleId(defaultRoleId);
    }
  }, [step, inviteRoleId, defaultRoleId]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div data-testid="onb-s01-wizard" className="fixed inset-0 z-50 flex" onKeyDown={handleKeyDown}>
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 z-10 rounded-sm p-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>

        {/* Sync status */}
        <div
          data-testid="onb-s01-sync-status"
          className="absolute top-4 right-4 z-10 flex items-center gap-1 text-xs text-muted-foreground/60"
        >
          {syncStatus === "synced" && <Wifi className="h-3 w-3 text-green-500" />}
          {syncStatus === "syncing" && <Loader2 className="h-3 w-3 animate-spin" />}
          {syncStatus === "offline" && <WifiOff className="h-3 w-3 text-orange-500" />}
        </div>

        {/* Left half — form */}
        <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
          <div className="w-full max-w-md mx-auto my-auto px-8 py-12 shrink-0">
            {/* Progress */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Get Started</span>
                <span data-testid="onb-s01-step-title" className="text-sm text-muted-foreground/60">
                  Step {step} of 5
                </span>
              </div>
              <OnboardingProgressBar currentStep={step} totalSteps={5} />
            </div>

            {/* ============================================================ */}
            {/* STEP 1: Company Info */}
            {/* ============================================================ */}
            {step === 1 && (
              <div className="space-y-5">
                <StepHeader
                  icon={Building2}
                  title="Name your company"
                  description="This is the organization your agents will work for."
                />
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Company name
                  </label>
                  <input
                    className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                    placeholder="Acme Corp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Description (optional)
                  </label>
                  <textarea
                    className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-none min-h-[60px]"
                    placeholder="What does this company do?"
                    value={companyDescription}
                    onChange={(e) => setCompanyDescription(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 2: Roles */}
            {/* ============================================================ */}
            {step === 2 && (
              <div className="space-y-5">
                <StepHeader
                  icon={Shield}
                  title="Set up roles"
                  description="Define who can do what. An Admin role was automatically created."
                />

                {/* Admin role badge */}
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-medium">Admin</span>
                  <Badge variant="secondary" className="text-[10px]">System</Badge>
                  <span className="text-xs text-muted-foreground">All permissions</span>
                </div>

                {/* Preset cards */}
                {!rolePreset && (
                  <div className="grid gap-3">
                    {[
                      {
                        key: "startup" as const,
                        title: "Startup",
                        desc: "Admin + Member (2 roles)",
                        detail: "Simple setup for small teams",
                      },
                      {
                        key: "structured" as const,
                        title: "Structured Team",
                        desc: "Admin + Lead + Member + Viewer (4 roles)",
                        detail: "Clear hierarchy with read-only access",
                      },
                      {
                        key: "custom" as const,
                        title: "Custom",
                        desc: "Define your own roles",
                        detail: "Full control over role names and hierarchy",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        disabled={loading}
                        className={cn(
                          "text-left rounded-md border border-border p-4 transition-colors hover:bg-accent/50",
                          loading && "opacity-50 cursor-not-allowed",
                        )}
                        onClick={() => handleSelectPreset(opt.key)}
                      >
                        <p className="text-sm font-medium">{opt.title}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1">{opt.detail}</p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Preset selected — summary */}
                {rolePreset && rolePreset !== "custom" && createdRoles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Created {createdRoles.length} role(s):
                    </p>
                    <div className="border border-border divide-y divide-border rounded-md">
                      {createdRoles.map((role) => (
                        <div key={role.id} className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{role.name}</span>
                            {role.isSystem && (
                              <Badge variant="secondary" className="text-[10px]">System</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {role.permissions.length} permission(s)
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setRolePreset(null); }}
                    >
                      Choose a different preset
                    </button>
                  </div>
                )}

                {/* Custom role builder */}
                {rolePreset === "custom" && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                        placeholder="Role name (e.g. Developer)"
                        value={customRoleName}
                        onChange={(e) => setCustomRoleName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomRole();
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddCustomRole}
                        disabled={!customRoleName.trim()}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                    {customRoles.length > 0 && (
                      <div className="border border-border divide-y divide-border rounded-md">
                        {customRoles.map((role) => (
                          <div key={role.slug} className="flex items-center justify-between px-3 py-2">
                            <span className="text-sm font-medium">{role.name}</span>
                            <button
                              onClick={() => handleRemoveCustomRole(role.slug)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setRolePreset(null); setCustomRoles([]); }}
                    >
                      Choose a different preset
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 3: Tags */}
            {/* ============================================================ */}
            {step === 3 && (
              <div className="space-y-5">
                <StepHeader
                  icon={TagIcon}
                  title="Organize with tags"
                  description="Tags control visibility. Team members see only what's tagged for them."
                />

                {/* Suggested tags by category */}
                {TAG_SUGGESTIONS.map((category) => (
                  <div key={category.category}>
                    <p className="text-xs text-muted-foreground mb-2">{category.category}</p>
                    <div className="flex flex-wrap gap-2">
                      {category.tags.map((tag) => {
                        const isCreated = createdTags.some((t) => t.slug === slugify(tag.name));
                        return (
                          <button
                            key={tag.name}
                            disabled={isCreated}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                              isCreated
                                ? "opacity-50 cursor-not-allowed border-border bg-muted"
                                : "border-border hover:bg-accent/50 cursor-pointer",
                            )}
                            onClick={() => handleAddTag(tag.name, tag.color)}
                          >
                            {isCreated ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Custom tag input */}
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                    placeholder="Custom tag name"
                    value={customTagName}
                    onChange={(e) => setCustomTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomTag}
                    disabled={!customTagName.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Created tags */}
                {createdTags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Created tags ({createdTags.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {createdTags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="gap-1 pr-1"
                          style={{ borderColor: tag.color ?? undefined }}
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color ?? "#64748b" }}
                          />
                          {tag.name}
                          <button
                            onClick={() => handleRemoveTag(tag.id)}
                            className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 4: Invite Members */}
            {/* ============================================================ */}
            {step === 4 && (
              <div className="space-y-5">
                <StepHeader
                  icon={Users}
                  title="Invite your team"
                  description="Bring your team members on board. You can also do this later from Settings."
                />

                {/* Email + Role + Tags input */}
                <div className="space-y-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Email
                      </label>
                      <input
                        data-testid="onb-invite-email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddInvite();
                          }
                        }}
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Role
                      </label>
                      <select
                        data-testid="onb-invite-role"
                        value={inviteRoleId}
                        onChange={(e) => setInviteRoleId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {createdRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddInvite}
                      className="h-[38px]"
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>

                  {/* Tag multi-select */}
                  {createdTags.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Tags (optional)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {createdTags.map((tag) => {
                          const isSelected = inviteTagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs border transition-colors",
                                isSelected
                                  ? "bg-primary/10 border-primary text-primary"
                                  : "border-border hover:bg-accent/50",
                              )}
                              onClick={() =>
                                setInviteTagIds((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== tag.id)
                                    : [...prev, tag.id],
                                )
                              }
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: tag.color ?? "#64748b" }}
                              />
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Invite list */}
                <div
                  className={cn(
                    "space-y-2 min-h-[48px]",
                    invites.length === 0 &&
                      "flex items-center justify-center text-sm text-muted-foreground",
                  )}
                >
                  {invites.length === 0 ? (
                    <span>No invitations added yet</span>
                  ) : (
                    invites.map((inv, i) => {
                      const role = createdRoles.find((r) => r.id === inv.roleId);
                      return (
                        <div
                          key={inv.email}
                          className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{inv.email}</span>
                            {role && (
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                {role.name}
                              </Badge>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveInvite(i)}
                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Error / Success */}
                {inviteSuccess && (
                  <div className="text-sm text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-md">
                    {inviteSuccess}
                  </div>
                )}

                {/* Send / Skip buttons */}
                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(5)}
                    disabled={inviteSending}
                  >
                    Skip for now
                  </Button>
                  {invites.length > 0 && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await handleSendInvites();
                        setStep(5);
                      }}
                      disabled={inviteSending}
                    >
                      {inviteSending ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-1" />
                      )}
                      Send {invites.length} Invitation{invites.length !== 1 ? "s" : ""} & Continue
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 5: Done / Summary */}
            {/* ============================================================ */}
            {step === 5 && (
              <div className="space-y-5">
                <StepHeader
                  icon={Rocket}
                  title="You're all set!"
                  description="Here's a summary of your setup. You can change everything later from Settings."
                />

                {/* Summary */}
                <div className="border border-border divide-y divide-border rounded-md">
                  <SummaryRow
                    icon={Building2}
                    label="Company"
                    value={companyName}
                  />
                  <SummaryRow
                    icon={Shield}
                    label="Roles"
                    value={`${createdRoles.length} role(s)`}
                  />
                  <SummaryRow
                    icon={TagIcon}
                    label="Tags"
                    value={
                      createdTags.length > 0
                        ? `${createdTags.length} tag(s)`
                        : "None yet"
                    }
                  />
                  <SummaryRow
                    icon={Users}
                    label="Invitations"
                    value={inviteSuccess ?? "None sent"}
                  />
                </div>

                <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                  Your sandbox will be provisioned automatically when you create your first agent.
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-3">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {/* Footer navigation */}
            <div className="flex items-center justify-between mt-8">
              <div>
                {step > 1 && step > initialStep && step !== 4 && (
                  <Button
                    data-testid="onb-s01-back"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep((step - 1) as Step)}
                    disabled={loading}
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {step === 1 && (
                  <Button
                    data-testid="onb-s01-next"
                    size="sm"
                    disabled={!companyName.trim() || loading}
                    onClick={handleStep1Next}
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 mr-1" />
                    )}
                    {loading ? "Creating..." : "Next"}
                  </Button>
                )}
                {step === 2 && (
                  <Button
                    data-testid="onb-s01-next"
                    size="sm"
                    disabled={
                      !rolePreset ||
                      loading ||
                      (rolePreset === "custom" && customRoles.length === 0)
                    }
                    onClick={handleStep2Next}
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 mr-1" />
                    )}
                    {loading ? "Creating..." : "Next"}
                  </Button>
                )}
                {step === 3 && (
                  <Button
                    data-testid="onb-s01-next"
                    size="sm"
                    onClick={() => setStep(4)}
                  >
                    <ArrowRight className="h-3.5 w-3.5 mr-1" />
                    {createdTags.length === 0 ? "Skip" : "Next"}
                  </Button>
                )}
                {/* Step 4 has its own buttons */}
                {step === 5 && (
                  <Button
                    data-testid="onb-s01-complete"
                    size="sm"
                    disabled={loading}
                    onClick={handleComplete}
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Rocket className="h-3.5 w-3.5 mr-1" />
                    )}
                    {loading ? "Finishing..." : "Go to Dashboard"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right half — ASCII art (hidden on mobile) */}
        <div className="hidden md:block w-1/2 overflow-hidden">
          <AsciiArtAnimation />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="bg-muted/50 p-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <Check className="h-4 w-4 text-green-500 shrink-0" />
    </div>
  );
}
