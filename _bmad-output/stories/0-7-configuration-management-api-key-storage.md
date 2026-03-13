# Story 0.7: Configuration Management & API Key Storage

Status: ready-for-dev

## Story

As a user,
I want my Claude API key stored securely and my preferences saved to a config file,
so that I can use drift detection without exposing sensitive credentials.

## Acceptance Criteria

1. Non-sensitive configuration is stored in `.mnm/config.json` with defined schema
2. The config file is created with sensible defaults on first run if missing
3. A `getConfig()` function reads and validates configuration
4. A `updateConfig(patch)` function merges partial updates into the config file
5. API key is stored in `.mnm/config.json` (acceptable for local-only MVP -- keychain integration is post-MVP)
6. If API key is missing, drift detection features gracefully degrade with a clear message
7. Configuration schema is validated with Zod on read

## Tasks / Subtasks

- [ ] Task 1: Define configuration schema (AC: #1, #7)
  - [ ] Create Zod schema for `MnMConfig` at `src/lib/config/schema.ts`
  - [ ] Fields: repositoryPath, claudeApiKey (optional), driftDetectionEnabled, customInstructionsPath, theme, logLevel
  - [ ] Define sensible defaults for all fields
- [ ] Task 2: Implement config read/write (AC: #2, #3, #4)
  - [ ] `getConfig(repoRoot)` -- read `.mnm/config.json`, validate with Zod, return typed config
  - [ ] `updateConfig(repoRoot, patch)` -- deep merge patch into existing config and write
  - [ ] Auto-create `.mnm/config.json` with defaults if missing
- [ ] Task 3: Implement API key handling (AC: #5, #6)
  - [ ] Store API key in config.json `claudeApiKey` field
  - [ ] `getApiKey(repoRoot)` -- convenience function to retrieve key
  - [ ] Return `null` if key is not set (caller handles graceful degradation)
- [ ] Task 4: Create barrel exports
  - [ ] Export all config functions and types from `src/lib/config/index.ts`

## Dev Notes

### File Structure

```
src/lib/config/
├── index.ts      # Barrel exports
├── schema.ts     # Zod schema and defaults
└── config.ts     # getConfig, updateConfig, getApiKey functions
```

### Configuration Schema

```typescript
// src/lib/config/schema.ts
import { z } from 'zod'

export const mnmConfigSchema = z.object({
  repositoryPath: z.string().default('.'),
  claudeApiKey: z.string().nullable().default(null),
  driftDetectionEnabled: z.boolean().default(true),
  customInstructionsPath: z.string().nullable().default(null),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type MnMConfig = z.infer<typeof mnmConfigSchema>

export const defaultConfig: MnMConfig = mnmConfigSchema.parse({})
```

### Config Read/Write Pattern

```typescript
// src/lib/config/config.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { mnmConfigSchema, defaultConfig, type MnMConfig } from './schema'

export function getConfig(repoRoot: string = process.cwd()): MnMConfig {
  const configPath = join(repoRoot, '.mnm', 'config.json')
  if (!existsSync(configPath)) {
    // Create default config on first run
    mkdirSync(join(repoRoot, '.mnm'), { recursive: true })
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2))
    return defaultConfig
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
  return mnmConfigSchema.parse(raw)
}

export function updateConfig(repoRoot: string, patch: Partial<MnMConfig>): MnMConfig {
  const current = getConfig(repoRoot)
  const updated = mnmConfigSchema.parse({ ...current, ...patch })
  const configPath = join(repoRoot, '.mnm', 'config.json')
  writeFileSync(configPath, JSON.stringify(updated, null, 2))
  return updated
}

export function getApiKey(repoRoot: string = process.cwd()): string | null {
  return getConfig(repoRoot).claudeApiKey
}
```

### Graceful Degradation Pattern

When API key is missing, callers should check before attempting drift detection:

```typescript
const apiKey = getApiKey()
if (!apiKey) {
  logger.warn('Claude API key not configured. Drift detection disabled.')
  // Show UI message: "Configure your API key in Settings to enable drift detection"
  return
}
```

### Security Notes

For the MVP, storing the API key in `.mnm/config.json` is acceptable because:
- `.mnm/` is git-ignored (set up in Story 0.1)
- MnM is local-first, single-user
- The file is in a project-specific directory, not globally accessible

Post-MVP improvement: use system keychain (macOS Keychain) via a package like `keytar`.

### Critical Constraints

- Config operations are synchronous (using `fs.readFileSync`/`writeFileSync`) -- acceptable for config files
- Always validate with Zod on read to handle corrupted/manually-edited config files
- If Zod validation fails on read, log a warning and return default config (do not crash)
- `.mnm/config.json` must be in `.gitignore` (already handled by Story 0.1)
- Config file format is JSON with 2-space indentation for human readability

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Section 4.2 - mnm-core (config mentions)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.7]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 6.4 - Custom Instructions Support]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
