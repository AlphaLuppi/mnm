type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function formatTimestamp(): string {
  return new Date().toISOString()
}

function log(level: LogLevel, source: string, message: string, data?: unknown): void {
  const timestamp = formatTimestamp()
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${source}]`
  if (data !== undefined) {
    console[level](`${prefix} ${message}`, data)
  } else {
    console[level](`${prefix} ${message}`)
  }
}

export const logger = {
  debug: (source: string, message: string, data?: unknown): void =>
    log('debug', source, message, data),
  info: (source: string, message: string, data?: unknown): void =>
    log('info', source, message, data),
  warn: (source: string, message: string, data?: unknown): void =>
    log('warn', source, message, data),
  error: (source: string, message: string, data?: unknown): void =>
    log('error', source, message, data)
}
