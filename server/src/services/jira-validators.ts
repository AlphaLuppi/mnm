// onb-s03-validators

import { z } from "zod";

// Schema for Jira connection credentials
export const jiraConnectionSchema = z.object({
  baseUrl: z
    .string()
    .url("baseUrl must be a valid URL")
    .refine((url) => url.startsWith("https://") || url.startsWith("http://"), {
      message: "baseUrl must start with http:// or https://",
    }),
  email: z.string().email("email must be a valid email address"),
  apiToken: z.string().min(1, "apiToken must not be empty"),
});

// Schema for import configuration
export const importConfigSchema = z.object({
  baseUrl: z.string().url(),
  email: z.string().email(),
  apiToken: z.string().min(1),
  projectKeys: z.array(z.string().min(1)).min(1, "At least one project key is required"),
  fieldMapping: z
    .object({
      statusMapping: z.record(z.string()).optional(),
      priorityMapping: z.record(z.string()).optional(),
    })
    .optional(),
});

export type JiraConnectionInput = z.infer<typeof jiraConnectionSchema>;
export type ImportConfigInput = z.infer<typeof importConfigSchema>;
