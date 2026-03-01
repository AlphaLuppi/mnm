import { describe, it, expectTypeOf } from 'vitest'
import type {
  IpcInvokeChannels,
  IpcStreamChannels,
  ProjectInfo,
  AgentStatus
} from './ipc-channels'

describe('IPC Channel Types', () => {
  it('should have correct type for project:open', () => {
    type Args = IpcInvokeChannels['project:open']['args']
    type Result = IpcInvokeChannels['project:open']['result']

    expectTypeOf<Args>().toEqualTypeOf<{ path: string }>()
    expectTypeOf<Result>().toEqualTypeOf<ProjectInfo>()
  })

  it('should have correct type for agent:launch', () => {
    type Args = IpcInvokeChannels['agent:launch']['args']
    type Result = IpcInvokeChannels['agent:launch']['result']

    expectTypeOf<Args>().toEqualTypeOf<{ task: string; context: string[] }>()
    expectTypeOf<Result>().toEqualTypeOf<{ agentId: string }>()
  })

  it('should have correct stream types', () => {
    type AgentOutput = IpcStreamChannels['stream:agent-output']

    expectTypeOf<AgentOutput>().toHaveProperty('agentId')
    expectTypeOf<AgentOutput>().toHaveProperty('data')
    expectTypeOf<AgentOutput>().toHaveProperty('timestamp')
  })

  it('should define AgentStatus as union of string literals', () => {
    expectTypeOf<AgentStatus>().toBeString()
  })
})
