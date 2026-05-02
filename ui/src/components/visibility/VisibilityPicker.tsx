import { Building2, Lock, Tags, Users } from "lucide-react";
import type {
  Visibility,
  VisibilityValue,
} from "@mnm/shared";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { TagSelector } from "../principals/TagSelector";
import { PrincipalSelector } from "../principals/PrincipalSelector";

/**
 * Pure transition helper — exported for unit tests.
 *
 * Returns `null` when the transition should be ignored (no-op): same tier as
 * before, or trying to switch to `company` while it's not available.
 *
 * Otherwise returns the next `VisibilityValue`. We intentionally KEEP
 * `tagIds` and `principalIds` across transitions: a user toggling between
 * `tags` and `principals` shouldn't silently lose their previous selection.
 */
export function nextVisibilityValue(
  prev: VisibilityValue,
  next: Visibility,
  opts: { companyEnforcedAvailable: boolean },
): VisibilityValue | null {
  if (next === prev.visibility) return null;
  if (next === "company" && !opts.companyEnforcedAvailable) return null;
  return { ...prev, visibility: next };
}

export type VisibilityPickerProps = {
  value: VisibilityValue;
  onChange: (next: VisibilityValue) => void;
  companyId: string;
  /**
   * When `false` the `company` (tier 3 enforced) tab is disabled with a tooltip
   * explaining why. Wire this to `usePermissions().has(<feature>:enforce)` —
   * for hooks that's `hooks:enforce` (cf. plan T1.3).
   */
  companyEnforcedAvailable?: boolean;
  /** Custom labels (i18n / per-feature wording). */
  labels?: Partial<Record<Visibility, string>>;
  disabled?: boolean;
  testId?: string;
  className?: string;
};

const DEFAULT_LABELS: Record<Visibility, string> = {
  private: "Private",
  tags: "Tags",
  principals: "Members",
  company: "Company",
};

const ICONS: Record<Visibility, typeof Lock> = {
  private: Lock,
  tags: Tags,
  principals: Users,
  company: Building2,
};

const HELP: Record<Visibility, string> = {
  private: "Visible only to you (the creator).",
  tags: "Shared with members whose tags intersect with the selected tags.",
  principals: "Shared with the selected members directly.",
  company: "Enforced for the entire company. Cannot be bypassed.",
};

export function VisibilityPicker({
  value,
  onChange,
  companyId,
  companyEnforcedAvailable = false,
  labels,
  disabled = false,
  testId,
  className,
}: VisibilityPickerProps) {
  const resolvedLabels = { ...DEFAULT_LABELS, ...(labels ?? {}) };

  function setVisibility(next: Visibility) {
    const nextValue = nextVisibilityValue(value, next, {
      companyEnforcedAvailable,
    });
    if (nextValue) onChange(nextValue);
  }

  function setTagIds(tagIds: string[]) {
    onChange({ ...value, tagIds });
  }

  function setPrincipalIds(principalIds: string[]) {
    onChange({ ...value, principalIds });
  }

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      data-testid={testId}
    >
      <Tabs
        value={value.visibility}
        onValueChange={(v) => setVisibility(v as Visibility)}
      >
        <TabsList variant="line" className="w-full">
          {(Object.keys(DEFAULT_LABELS) as Visibility[]).map((tier) => {
            const Icon = ICONS[tier];
            const tierDisabled =
              disabled ||
              (tier === "company" && !companyEnforcedAvailable);
            const trigger = (
              <TabsTrigger
                key={tier}
                value={tier}
                disabled={tierDisabled}
                data-testid={
                  testId ? `${testId}-tab-${tier}` : undefined
                }
                className="gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {resolvedLabels[tier]}
              </TabsTrigger>
            );
            if (tier === "company" && !companyEnforcedAvailable) {
              return (
                <Tooltip key={tier}>
                  <TooltipTrigger asChild>
                    <span className="contents">{trigger}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Requires the <code>:enforce</code> permission.
                  </TooltipContent>
                </Tooltip>
              );
            }
            return trigger;
          })}
        </TabsList>
      </Tabs>

      <p className="text-xs text-muted-foreground">{HELP[value.visibility]}</p>

      {value.visibility === "tags" && (
        <TagSelector
          value={value.tagIds}
          onChange={setTagIds}
          companyId={companyId}
          disabled={disabled}
          placeholder="Select tags…"
          testId={testId ? `${testId}-tag-selector` : undefined}
        />
      )}

      {value.visibility === "principals" && (
        <PrincipalSelector
          value={value.principalIds}
          onChange={setPrincipalIds}
          companyId={companyId}
          disabled={disabled}
          placeholder="Select members…"
          testId={testId ? `${testId}-principal-selector` : undefined}
        />
      )}
    </div>
  );
}
