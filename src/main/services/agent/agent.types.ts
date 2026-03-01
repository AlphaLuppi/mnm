import type { ChildProcess } from 'node:child_process'
import type { AgentInfo } from '@shared/types/agent.types'
import type { StdoutParser } from './stdout-parser'
import type { ChatSegmenter } from './chat-segmenter'

export type AgentProcess = {
  info: AgentInfo
  process: ChildProcess
  parser: StdoutParser
  segmenter: ChatSegmenter
  stderrBuffer: string
}
