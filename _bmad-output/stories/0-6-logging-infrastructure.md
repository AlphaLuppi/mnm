# Story 0.6: Logging Infrastructure

Status: ready-for-dev

## Story

As a developer,
I want structured logging with proper levels,
so that I can debug issues and monitor application health.

## Acceptance Criteria

1. A `logger` module exists at `src/lib/logger/` that provides structured logging
2. Log levels are supported: ERROR, WARN, INFO, DEBUG
3. Development logs output to server console with readable formatting
4. Logs include structured context fields (agentId, specId, filePath, etc.)
5. A `createLogger(context)` function creates scoped loggers with preset context
6. Log level is configurable via environment variable `LOG_LEVEL` (default: `info`)

## Tasks / Subtasks

- [ ] Task 1: Create logger module (AC: #1, #2, #6)
  - [ ] Create `src/lib/logger/index.ts` with log level configuration
  - [ ] Support ERROR, WARN, INFO, DEBUG levels with level filtering
  - [ ] Read `LOG_LEVEL` from `process.env` with default `info`
- [ ] Task 2: Implement structured logging (AC: #3, #4)
  - [ ] Format log entries with timestamp, level, message, and context fields
  - [ ] Use `console.error` for ERROR, `console.warn` for WARN, `console.log` for INFO/DEBUG
  - [ ] Include JSON-serialized context in log output for structured data
- [ ] Task 3: Create scoped logger factory (AC: #5)
  - [ ] `createLogger(context)` returns logger with preset context merged into every log call
  - [ ] Scoped loggers support `.info()`, `.warn()`, `.error()`, `.debug()` methods
- [ ] Task 4: Add logging to existing infrastructure
  - [ ] Add database connection logging (INFO on connect, ERROR on failure)
  - [ ] Add migration logging (INFO per migration applied)

## Dev Notes

### File Structure

```
src/lib/logger/
├── index.ts    # Logger implementation and createLogger factory
```

### Implementation Approach

Keep it simple -- use `console.*` methods with structured formatting. No external logging library needed for the MVP.

```typescript
// src/lib/logger/index.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

interface LogContext {
  [key: string]: unknown
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel]
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const ctx = context ? ` ${JSON.stringify(context)}` : ''
  return `${timestamp} [${level.toUpperCase()}] ${message}${ctx}`
}

export function createLogger(defaultContext: LogContext = {}) {
  return {
    debug(message: string, context?: LogContext) {
      if (shouldLog('debug')) console.log(formatLog('debug', message, { ...defaultContext, ...context }))
    },
    info(message: string, context?: LogContext) {
      if (shouldLog('info')) console.log(formatLog('info', message, { ...defaultContext, ...context }))
    },
    warn(message: string, context?: LogContext) {
      if (shouldLog('warn')) console.warn(formatLog('warn', message, { ...defaultContext, ...context }))
    },
    error(message: string, context?: LogContext) {
      if (shouldLog('error')) console.error(formatLog('error', message, { ...defaultContext, ...context }))
    },
  }
}

// Default logger instance (no preset context)
export const logger = createLogger()
```

### Usage Examples

```typescript
import { logger, createLogger } from '@/lib/logger'

// Simple logging
logger.info('Application started')
logger.error('Database connection failed', { dbPath: '.mnm/state.db' })

// Scoped logger
const agentLogger = createLogger({ module: 'agent', agentId: 'abc-123' })
agentLogger.info('Agent spawned', { specId: 'spec-456' })
// Output: 2026-02-20T10:00:00.000Z [INFO] Agent spawned {"module":"agent","agentId":"abc-123","specId":"spec-456"}
```

### Critical Constraints

- No external logging library -- use `console.*` methods only
- Logger must work in both Server Components and API Routes (Node.js runtime)
- Do NOT import logger in client components (it uses `process.env`)
- Keep the implementation under 50 lines -- this is infrastructure, not a feature
- Log format: `{ISO timestamp} [{LEVEL}] {message} {JSON context}`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Section 8.4 - Logging Strategy]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.6]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
