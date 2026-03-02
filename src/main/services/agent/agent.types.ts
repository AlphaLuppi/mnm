import type { ChildProcess } from 'node:child_process'
import type { AgentInfo, BlockingContext } from '@shared/types/agent.types'
import type { StdoutParser } from './stdout-parser'
import type { ChatSegmenter } from './chat-segmenter'
import type { BlockingDetector } from './blocking-detector'

export type AgentProcess = {
  info: AgentInfo
  process: ChildProcess
  parser: StdoutParser
  segmenter: ChatSegmenter
  blockingDetector: BlockingDetector
  blockingContext?: BlockingContext
  stderrBuffer: string
}
