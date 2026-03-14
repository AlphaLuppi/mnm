import { z } from "zod";

// cont-s03-validator-paths
// Schema for allowlist path entries — each must be an absolute path
export const mountPathsSchema = z.object({
  paths: z.array(
    z.string()
      .min(1, "Path must not be empty")
      .max(4096, "Path must be <= 4096 characters")
      .refine(
        (p) => p.startsWith("/"),
        "Each path must be absolute (start with /)"
      )
  ).max(100, "Maximum 100 paths per allowlist"),
});

// cont-s03-validator-validate
// Schema for mount validate request
export const mountValidateSchema = z.object({
  profileId: z.string().uuid("profileId must be a valid UUID"),
  paths: z.array(
    z.string()
      .min(1, "Path must not be empty")
      .max(4096, "Path must be <= 4096 characters")
  ).min(1, "At least one path required").max(50, "Maximum 50 paths per validation"),
});

export type MountPathsInput = z.infer<typeof mountPathsSchema>;
export type MountValidateInput = z.infer<typeof mountValidateSchema>;
