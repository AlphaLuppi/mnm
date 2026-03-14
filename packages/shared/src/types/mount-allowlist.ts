// cont-s03-type-violation
// Mount validation violation codes
export const MOUNT_VIOLATION_CODES = [
  "MOUNT_PATH_NOT_ALLOWED",     // Path not in the allowlist
  "MOUNT_PATH_TRAVERSAL",       // Path traversal detected (../, %2e%2e)
  "MOUNT_NULL_BYTES",           // Null bytes detected (\0, %00)
  "MOUNT_SYMLINK_ESCAPE",       // Symlink resolves outside the allowlist
  "MOUNT_SENSITIVE_PATH",       // Path is a known sensitive system path
  "MOUNT_EMPTY_PATH",           // Empty or whitespace-only path
  "MOUNT_ALLOWLIST_EMPTY",      // Allowlist is empty, all mounts blocked
] as const;
export type MountViolationCode = (typeof MOUNT_VIOLATION_CODES)[number];

// cont-s03-type-violation
// A single mount violation
export interface MountViolation {
  code: MountViolationCode;
  message: string;
  severity: "critical" | "error";
  originalPath: string;
  normalizedPath: string | null;
}

// cont-s03-type-result
// Result of validating a single mount path
export interface MountValidationResult {
  path: string;
  allowed: boolean;
  violation: MountViolation | null;
}

// Result of validating all mounts for a container launch
export interface MountValidationBatchResult {
  valid: boolean;
  results: MountValidationResult[];
  violations: MountViolation[];
}

// API payload for updating an allowlist
export interface MountAllowlistUpdatePayload {
  paths: string[];
}

// API payload for validating paths against a profile
export interface MountValidateRequest {
  profileId: string;
  paths: string[];
}

// API response for mount validation
export interface MountValidateResponse {
  profileId: string;
  results: MountValidationResult[];
  allValid: boolean;
}
