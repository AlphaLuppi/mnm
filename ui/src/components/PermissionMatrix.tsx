import React, { useMemo } from "react";
import { Check, Minus } from "lucide-react";

export interface Permission {
  id: string;
  slug: string;
  description: string;
  category: string;
}

interface PermissionMatrixProps {
  presets: Record<string, readonly string[]>;
  permissions: Permission[];
}

/** Pretty-print a permission slug: "agents:create" → "Create" */
function permLabel(slug: string): string {
  const parts = slug.split(":");
  const action = parts[parts.length - 1] ?? slug;
  return action
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Pretty-print a category key: "config" → "Config" */
function categoryLabel(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function PermissionMatrix({ presets, permissions }: PermissionMatrixProps) {
  const roles = Object.keys(presets);

  // Group permissions dynamically by category
  const categories = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    for (const p of permissions) {
      (grouped[p.category] ??= []).push(p);
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, perms]) => ({
        id: cat,
        label: categoryLabel(cat),
        permissions: perms,
      }));
  }, [permissions]);

  function hasPermission(role: string, key: string): boolean {
    const perms = presets[role];
    if (!perms) return false;
    return perms.includes(key);
  }

  return (
    <div data-testid="rbac-s06-matrix" className="border border-border rounded-md overflow-x-auto">
      <table
        data-testid="rbac-s06-matrix-table"
        className="w-full text-sm"
      >
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th
              scope="col"
              className="text-left px-4 py-2.5 font-medium text-muted-foreground min-w-[200px]"
            >
              Permission
            </th>
            {roles.map((role) => (
              <th
                key={role}
                scope="col"
                data-testid={`rbac-s06-matrix-header-${role}`}
                className="text-center px-4 py-2.5 font-medium text-muted-foreground w-[100px]"
              >
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <React.Fragment key={category.id}>
              {/* Category header row */}
              <tr
                data-testid={`rbac-s06-matrix-category-${category.id}`}
                className="bg-muted/20"
              >
                <th
                  scope="row"
                  colSpan={roles.length + 1}
                  className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {category.label}
                </th>
              </tr>
              {/* Permission rows */}
              {category.permissions.map((perm) => (
                <tr
                  key={perm.slug}
                  data-testid={`rbac-s06-matrix-row-${perm.slug}`}
                  className="border-b border-border last:border-b-0 hover:bg-accent/20 transition-colors"
                >
                  <th
                    scope="row"
                    className="text-left px-4 py-2 font-normal text-foreground"
                    title={perm.description}
                  >
                    {perm.description || permLabel(perm.slug)}
                  </th>
                  {roles.map((role) => {
                    const granted = hasPermission(role, perm.slug);
                    return (
                      <td
                        key={`${perm.slug}-${role}`}
                        data-testid={`rbac-s06-matrix-cell-${perm.slug}-${role}`}
                        className="text-center px-4 py-2"
                      >
                        {granted ? (
                          <Check
                            data-testid={`rbac-s06-matrix-check-${perm.slug}-${role}`}
                            className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto"
                            aria-label="Granted"
                          />
                        ) : (
                          <Minus
                            data-testid={`rbac-s06-matrix-check-${perm.slug}-${role}`}
                            className="h-4 w-4 text-muted-foreground/40 mx-auto"
                            aria-label="Not granted"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
