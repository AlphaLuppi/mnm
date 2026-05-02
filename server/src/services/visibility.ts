/**
 * 3-tier visibility helper — invariant produit MnM.
 *
 * Voir [`docs/conventions/visibility-tiers.md`](../../../../docs/conventions/visibility-tiers.md)
 * et [`docs/decision-log.md` §1.6](../../../../docs/decision-log.md).
 *
 * Cette fonction est PURE et générique : elle décrit l'algorithme d'access
 * (tier 3 → tier 1 → tier 2b → tier 2a), mais délègue la lecture des tables
 * de jointure (`<entity>_tags`, `<entity>_principals`) à des resolvers
 * injectés par chaque feature concrète. Cela permet de la tester sans DB
 * et de la réutiliser sur n'importe quel kind d'entité partageable
 * (Workflow Hooks, Step Assignments, Config Layers, futures features).
 */
import type { VisibilityResource } from "@mnm/shared";

/**
 * Resolvers fournis par la feature concrète au moment de l'appel.
 * Doivent être idempotents et tolérer un resourceId inconnu (return false).
 */
export type VisibilityResolvers = {
  /**
   * `true` si `principalId` partage au moins un tag avec la ressource (`tier 2a`).
   */
  hasTagIntersection: (
    resourceId: string,
    principalId: string,
  ) => Promise<boolean>;
  /**
   * `true` si `principalId` est listé directement sur la ressource (`tier 2b`).
   */
  isPrincipalListed: (
    resourceId: string,
    principalId: string,
  ) => Promise<boolean>;
};

/**
 * Évalue si `principalId` peut accéder à `resource` selon le modèle 3-tier.
 *
 * Ordre de résolution (court-circuit) :
 *   1. Tier 3 (`visibility = company`) → `true` quoi qu'il arrive.
 *      Sert pour les hooks/policies enforced que la company impose à tous.
 *   2. Tier 1 (`createdByPrincipalId === principalId`) → `true`.
 *      Le créateur a toujours accès à sa propre ressource.
 *   3. Tier 2b (`visibility = principals`) → délègue à `isPrincipalListed`.
 *   4. Tier 2a (`visibility = tags`) → délègue à `hasTagIntersection`.
 *   5. `visibility = private` (et non créateur) → `false`.
 */
export async function canPrincipalAccess(
  resource: VisibilityResource,
  principalId: string,
  resolvers: VisibilityResolvers,
): Promise<boolean> {
  // Tier 3 : company-enforced > tout le reste.
  if (resource.visibility === "company") return true;

  // Tier 1 : creator bypass.
  if (resource.createdByPrincipalId === principalId) return true;

  // Tier 2b : principal direct.
  if (resource.visibility === "principals") {
    return resolvers.isPrincipalListed(resource.id, principalId);
  }

  // Tier 2a : tag intersection.
  if (resource.visibility === "tags") {
    return resolvers.hasTagIntersection(resource.id, principalId);
  }

  // Tier 1 (private) sans match créateur.
  return false;
}
