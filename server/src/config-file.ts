import fs from "node:fs";
import { mnmConfigSchema, type MnMConfig } from "@mnm/shared";
import { resolveMnMConfigPath } from "./paths.js";

export function readConfigFile(): MnMConfig | null {
  const configPath = resolveMnMConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return mnmConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
