import { describe, it, expect } from 'vitest'
import { serializeToMarkdown } from './markdown-serializer'
import type { WorkflowGraph } from '@shared/types/workflow.types'

const linearGraph: WorkflowGraph = {
  id: 'wf-1',
  name: 'Test Workflow',
  sourceFile: 'test.md',
  sourceFormat: 'markdown',
  nodes: [
    { id: 'n1', label: 'Phase 1', type: 'step', role: 'architect', sourceFile: 'test.md' },
    { id: 'n2', label: 'Phase 2', type: 'step', instructions: 'Build it', sourceFile: 'test.md' },
    { id: 'n3', label: 'Check Result', type: 'check', conditions: 'All tests pass', sourceFile: 'test.md' }
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2', type: 'sequential' },
    { id: 'e2', source: 'n2', target: 'n3', type: 'sequential' }
  ]
}

describe('serializeToMarkdown', () => {
  it('produces frontmatter with name', () => {
    const output = serializeToMarkdown(linearGraph)
    expect(output).toContain('---')
    expect(output).toContain('name: Test Workflow')
  })

  it('produces H1 title', () => {
    const output = serializeToMarkdown(linearGraph)
    expect(output).toContain('# Test Workflow')
  })

  it('renders step nodes as H2', () => {
    const output = serializeToMarkdown(linearGraph)
    expect(output).toContain('## Phase 1')
    expect(output).toContain('## Phase 2')
  })

  it('renders check nodes as H3', () => {
    const output = serializeToMarkdown(linearGraph)
    expect(output).toContain('### Check Result')
  })

  it('includes role and instructions', () => {
    const output = serializeToMarkdown(linearGraph)
    expect(output).toContain('**Role:** architect')
    expect(output).toContain('Build it')
  })

  it('includes conditions for check nodes', () => {
    const output = serializeToMarkdown(linearGraph)
    expect(output).toContain('**Conditions:** All tests pass')
  })

  it('handles graph with metadata description', () => {
    const graph: WorkflowGraph = {
      ...linearGraph,
      metadata: { description: 'A workflow description' }
    }
    const output = serializeToMarkdown(graph)
    expect(output).toContain('description: A workflow description')
  })
})
