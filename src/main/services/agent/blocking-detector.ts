export type BlockingContext = {
  lastMessage: string
  timestamp: number
  stderrSnippet?: string
  checkpointId?: string
  reason: 'timeout' | 'error-pattern' | 'stderr-error'
}

export type BlockingDetectorConfig = {
  timeoutMs: number
  errorPatterns: RegExp[]
  stderrPatterns: RegExp[]
}

const DEFAULT_CONFIG: BlockingDetectorConfig = {
  timeoutMs: 60_000,
  errorPatterns: [
    /rate.?limit/i,
    /permission.?denied/i,
    /authentication.?failed/i,
    /connection.?refused/i,
    /timed?\s*out/i,
    /quota.?exceeded/i
  ],
  stderrPatterns: [/fatal/i, /permission.?denied/i]
}

export class BlockingDetector {
  private config: BlockingDetectorConfig
  private lastOutputContent = ''
  private stderrBuffer = ''
  private timer: ReturnType<typeof setTimeout> | null = null
  private onBlocked: (context: BlockingContext) => void
  private isBlocked = false
  private lastCheckpointId?: string

  constructor(
    onBlocked: (context: BlockingContext) => void,
    config?: Partial<BlockingDetectorConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.onBlocked = onBlocked
    this.startTimer()
  }

  onOutput(content: string): void {
    this.lastOutputContent = content
    this.resetTimer()

    for (const pattern of this.config.errorPatterns) {
      if (pattern.test(content)) {
        this.triggerBlocked({
          lastMessage: content,
          timestamp: Date.now(),
          reason: 'error-pattern'
        })
        return
      }
    }

    // Only reset blocked state when output doesn't match error patterns
    this.isBlocked = false
  }

  onStderr(data: string): void {
    this.stderrBuffer += data

    for (const pattern of this.config.stderrPatterns) {
      if (pattern.test(data)) {
        this.triggerBlocked({
          lastMessage: this.lastOutputContent,
          timestamp: Date.now(),
          stderrSnippet: this.stderrBuffer.slice(-500),
          reason: 'stderr-error'
        })
        return
      }
    }
  }

  setCheckpoint(checkpointId: string): void {
    this.lastCheckpointId = checkpointId
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private startTimer(): void {
    this.timer = setTimeout(() => {
      if (!this.isBlocked) {
        this.triggerBlocked({
          lastMessage: this.lastOutputContent,
          timestamp: Date.now(),
          stderrSnippet: this.stderrBuffer.slice(-500) || undefined,
          reason: 'timeout'
        })
      }
    }, this.config.timeoutMs)
  }

  private resetTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.startTimer()
  }

  private triggerBlocked(context: BlockingContext): void {
    if (this.isBlocked) return
    this.isBlocked = true
    context.checkpointId = this.lastCheckpointId
    this.onBlocked(context)
  }
}
