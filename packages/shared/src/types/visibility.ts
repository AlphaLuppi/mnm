/**
 * 3-tier visibility model — invariant produit MnM.
 *
 * Voir `docs/decision-log.md` §1.6 et `docs/conventions/visibility-tiers.md`.
 *
 * | Tier | `visibility` value | Sémantique                                          |
 * |------|--------------------|-----------------------------------------------------|
 * | 1    | `private`          | Seul le créateur (ou l'assigné direct) voit/utilise.|
 * | 2a   | `tags`             | Partagé aux principals dont les tags intersectent.  |
 * | 2b   | `principals`       | Partagé à des principals spécifiques par id.        |
 * | 3    | `company`          | Imposé par la company à tous (= "company-enforced").|
 */
export const VISIBILITY_TIERS = [
  "private",
  "tags",
  "principals",
  "company",
] as const;

export type Visibility = (typeof VISIBILITY_TIERS)[number];

/**
 * Minimal projection of a shareable resource needed to compute access.
 * Each entity type (workflow_hooks_config, governed_step_assignments, …)
 * exposes itself as a `VisibilityResource` for `canPrincipalAccess`.
 */
export type VisibilityResource = {
  /** Resource id (used by the join-table resolvers). */
  id: string;
  visibility: Visibility;
  /** The principal that created the resource (tier 1 bypass). */
  createdByPrincipalId: string;
};

/**
 * UI form value for `<VisibilityPicker>`. Always carries the full state
 * even when only one tier is "active" — the picker writes a fresh value
 * on each transition, the empty arrays cost nothing.
 */
export type VisibilityValue = {
  visibility: Visibility;
  tagIds: string[];
  principalIds: string[];
};

export const EMPTY_VISIBILITY_VALUE: VisibilityValue = {
  visibility: "private",
  tagIds: [],
  principalIds: [],
};

export function isVisibility(value: unknown): value is Visibility {
  return (
    typeof value === "string" &&
    (VISIBILITY_TIERS as readonly string[]).includes(value)
  );
}
