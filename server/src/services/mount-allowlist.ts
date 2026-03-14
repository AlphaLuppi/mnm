import path from "node:path";
import fs from "node:fs/promises";
import { eq, and } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { containerProfiles } from "@mnm/db";
import type {
  MountValidationResult,
  MountValidationBatchResult,
  MountViolation,
  MountViolationCode,
} from "@mnm/shared";
import { notFound } from "../errors.js";
import { logger } from "../middleware/logger.js";

// cont-s03-svc-sensitive-paths
// These paths are ALWAYS forbidden, even if listed in the allowlist
const SENSITIVE_PATHS: string[] = [
  "/etc/passwd",
  "/etc/shadow",
  "/etc/hosts",
  "/etc/hostname",
  "/etc/resolv.conf",
  "/etc/ssh",
  "/etc/ssl",
  "/var/run/docker.sock",
  "/var/run/containerd",
  "/proc",
  "/sys",
  "/dev",
  "/root",
  "/home",
  "/.ssh",
  "/.gnupg",
  "/.aws",
  "/.config",
  "/.kube",
  "/boot",
  "/sbin",
  "/usr/sbin",
  "/var/log",
];

export function mountAllowlistService(db: Db) {

  // cont-s03-svc-detect-null
  /**
   * Detect null bytes in a path string.
   * Null bytes can truncate path checks in C-level functions.
   */
  function detectNullBytes(inputPath: string): boolean {
    // Check raw null byte
    if (inputPath.includes("\0")) return true;
    // Check URL-encoded null byte
    if (inputPath.includes("%00")) return true;
    return false;
  }

  // cont-s03-svc-detect-traversal
  /**
   * Detect path traversal patterns in a path string.
   * Checks both literal `..` and URL-encoded `%2e%2e`.
   */
  function detectPathTraversal(inputPath: string): boolean {
    // Decode URL-encoded characters first
    let decoded: string;
    try {
      decoded = decodeURIComponent(inputPath);
    } catch {
      // If decoding fails, the path is likely maliciously encoded
      return true;
    }

    // Normalize the path and compare
    const normalized = path.normalize(decoded);

    // Check for `..` segments
    if (decoded.includes("..")) return true;
    if (normalized.includes("..")) return true;

    // Check for URL-encoded `..` patterns that weren't decoded
    if (inputPath.includes("%2e%2e") || inputPath.includes("%2E%2E")) return true;
    if (inputPath.includes("%2e%2E") || inputPath.includes("%2E%2e")) return true;

    return false;
  }

  // cont-s03-svc-detect-symlink
  /**
   * Detect symlink escape by resolving the real path.
   * If the resolved path is outside all allowed paths, it's a symlink escape.
   * Returns the resolved path or null if the path doesn't exist.
   */
  async function detectSymlinkEscape(
    inputPath: string,
    allowedPaths: string[],
  ): Promise<{ escaped: boolean; resolvedPath: string | null }> {
    try {
      const resolved = await fs.realpath(inputPath);
      const isWithinAllowed = allowedPaths.some((allowed) => {
        const normalizedAllowed = path.resolve(allowed);
        return resolved === normalizedAllowed || resolved.startsWith(normalizedAllowed + path.sep);
      });
      return { escaped: !isWithinAllowed, resolvedPath: resolved };
    } catch {
      // Path doesn't exist yet — cannot resolve symlinks, so treat as safe
      // (Docker will fail to mount non-existent paths anyway)
      return { escaped: false, resolvedPath: null };
    }
  }

  // cont-s03-svc-normalize
  /**
   * Normalize a mount path:
   * 1. URL-decode
   * 2. Strip null bytes
   * 3. Normalize (resolve . and ..)
   * 4. Ensure absolute
   */
  function normalizePath(inputPath: string): string {
    // Step 1: URL-decode
    let decoded: string;
    try {
      decoded = decodeURIComponent(inputPath);
    } catch {
      decoded = inputPath;
    }

    // Step 2: Strip null bytes
    decoded = decoded.replace(/\0/g, "");

    // Step 3: Normalize
    const normalized = path.normalize(decoded);

    // Step 4: Ensure absolute
    return path.resolve("/", normalized);
  }

  /**
   * Check if a path matches or is a child of any sensitive path.
   */
  function isSensitivePath(inputPath: string): boolean {
    const normalized = normalizePath(inputPath);
    return SENSITIVE_PATHS.some((sensitive) => {
      return normalized === sensitive || normalized.startsWith(sensitive + "/");
    });
  }

  // cont-s03-svc-validate-mount
  /**
   * Validate a single mount path against an allowlist.
   * Checks for: null bytes, path traversal, sensitive paths, allowlist membership.
   */
  async function validateMountPath(
    inputPath: string,
    allowedPaths: string[],
  ): Promise<MountValidationResult> {
    // Check empty
    if (!inputPath || inputPath.trim().length === 0) {
      return {
        path: inputPath,
        allowed: false,
        violation: makeViolation("MOUNT_EMPTY_PATH", "Empty mount path", inputPath, null),
      };
    }

    // Check null bytes first (before any normalization)
    if (detectNullBytes(inputPath)) {
      return {
        path: inputPath,
        allowed: false,
        violation: makeViolation("MOUNT_NULL_BYTES", "Null bytes detected in mount path", inputPath, null),
      };
    }

    // Check path traversal
    if (detectPathTraversal(inputPath)) {
      return {
        path: inputPath,
        allowed: false,
        violation: makeViolation("MOUNT_PATH_TRAVERSAL", "Path traversal detected in mount path", inputPath, normalizePath(inputPath)),
      };
    }

    const normalized = normalizePath(inputPath);

    // Check sensitive paths
    if (isSensitivePath(normalized)) {
      return {
        path: inputPath,
        allowed: false,
        violation: makeViolation("MOUNT_SENSITIVE_PATH", `Mount path targets a sensitive system path: ${normalized}`, inputPath, normalized),
      };
    }

    // Check allowlist empty
    if (allowedPaths.length === 0) {
      return {
        path: inputPath,
        allowed: false,
        violation: makeViolation("MOUNT_ALLOWLIST_EMPTY", "Mount allowlist is empty — all mounts blocked", inputPath, normalized),
      };
    }

    // Check path is within allowlist
    const isAllowed = allowedPaths.some((allowed) => {
      const normalizedAllowed = path.resolve("/", path.normalize(allowed));
      return normalized === normalizedAllowed || normalized.startsWith(normalizedAllowed + "/");
    });

    if (!isAllowed) {
      return {
        path: inputPath,
        allowed: false,
        violation: makeViolation("MOUNT_PATH_NOT_ALLOWED", `Mount path ${normalized} is not in the allowlist`, inputPath, normalized),
      };
    }

    // Check symlink escape (only for paths that exist on disk)
    const symlinkCheck = await detectSymlinkEscape(normalized, allowedPaths);
    if (symlinkCheck.escaped) {
      return {
        path: inputPath,
        allowed: false,
        violation: makeViolation(
          "MOUNT_SYMLINK_ESCAPE",
          `Symlink resolves outside allowlist: ${normalized} → ${symlinkCheck.resolvedPath}`,
          inputPath,
          symlinkCheck.resolvedPath,
        ),
      };
    }

    return { path: inputPath, allowed: true, violation: null };
  }

  // cont-s03-svc-validate-all
  /**
   * Validate all mount paths for a container launch.
   * Returns a batch result with all individual results and aggregated violations.
   */
  async function validateAllMounts(
    mountPaths: string[],
    allowedPaths: string[],
  ): Promise<MountValidationBatchResult> {
    const results: MountValidationResult[] = [];
    const violations: MountViolation[] = [];

    for (const mountPath of mountPaths) {
      const result = await validateMountPath(mountPath, allowedPaths);
      results.push(result);
      if (result.violation) {
        violations.push(result.violation);
      }
    }

    return {
      valid: violations.length === 0,
      results,
      violations,
    };
  }

  // cont-s03-svc-get-allowlist
  /**
   * Get the effective mount allowlist for a profile.
   * Uses allowedMountPaths column from container_profiles.
   */
  async function getEffectiveAllowlist(companyId: string, profileId: string): Promise<string[]> {
    const [profile] = await db.select().from(containerProfiles).where(
      and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId))
    );
    if (!profile) throw notFound("Container profile not found");

    return (profile.allowedMountPaths as string[] | null) ?? [];
  }

  // cont-s03-svc-add-allowlist
  /**
   * Add paths to a profile's mount allowlist.
   * Deduplicates and normalizes paths before saving.
   */
  async function addToAllowlist(companyId: string, profileId: string, paths: string[]): Promise<string[]> {
    const current = await getEffectiveAllowlist(companyId, profileId);

    // Normalize and deduplicate
    const normalizedNew = paths.map((p) => normalizePath(p));
    const merged = [...new Set([...current, ...normalizedNew])];

    await db.update(containerProfiles)
      .set({ allowedMountPaths: merged, updatedAt: new Date() })
      .where(and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId)));

    return merged;
  }

  // cont-s03-svc-remove-allowlist
  /**
   * Remove paths from a profile's mount allowlist.
   */
  async function removeFromAllowlist(companyId: string, profileId: string, paths: string[]): Promise<string[]> {
    const current = await getEffectiveAllowlist(companyId, profileId);

    const normalizedRemove = new Set(paths.map((p) => normalizePath(p)));
    const filtered = current.filter((p) => !normalizedRemove.has(normalizePath(p)));

    await db.update(containerProfiles)
      .set({ allowedMountPaths: filtered, updatedAt: new Date() })
      .where(and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId)));

    return filtered;
  }

  /**
   * Set the full allowlist for a profile (replace).
   */
  async function setAllowlist(companyId: string, profileId: string, paths: string[]): Promise<string[]> {
    // Verify profile exists
    const [profile] = await db.select().from(containerProfiles).where(
      and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId))
    );
    if (!profile) throw notFound("Container profile not found");

    const normalized = [...new Set(paths.map((p) => normalizePath(p)))];

    await db.update(containerProfiles)
      .set({ allowedMountPaths: normalized, updatedAt: new Date() })
      .where(and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId)));

    return normalized;
  }

  return {
    validateMountPath,
    validateAllMounts,
    normalizePath,
    detectPathTraversal,
    detectNullBytes,
    detectSymlinkEscape,
    isSensitivePath,
    addToAllowlist,
    removeFromAllowlist,
    getEffectiveAllowlist,
    setAllowlist,
  };
}

// ---- Pure helpers ----

function makeViolation(
  code: MountViolationCode,
  message: string,
  originalPath: string,
  normalizedPath: string | null,
): MountViolation {
  return {
    code,
    message,
    severity: "critical",
    originalPath,
    normalizedPath,
  };
}
