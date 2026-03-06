import { describe, it, expect } from 'vitest'
import { parseMarkdownWorkflow } from './markdown-parser'

describe('parseMarkdownWorkflow', () => {
  it('parses frontmatter name and description', () => {
    const md = `---
name: brainstorming
description: Facilitate brainstorming sessions
---

# Brainstorming Session Workflow

Some content.
`
    const result = parseMarkdownWorkflow('workflow.md', md)
    expect(result.metadata.name).toBe('brainstorming')
    expect(result.metadata.description).toBe('Facilitate brainstorming sessions')
    expect(result.errors).toHaveLength(0)
  })

  it('parses H1 title as name when no frontmatter', () => {
    const md = `# My Workflow

## Step One

Some instructions.

## Step Two

More instructions.
`
    const result = parseMarkdownWorkflow('workflow.md', md)
    expect(result.metadata.name).toBe('My Workflow')
    expect(result.nodes).toHaveLength(2)
    expect(result.nodes[0].label).toBe('Step One')
    expect(result.nodes[1].label).toBe('Step Two')
  })

  it('creates sequential edges between H2 sections', () => {
    const md = `# Workflow

## Phase 1

Content.

## Phase 2

Content.

## Phase 3

Content.
`
    const result = parseMarkdownWorkflow('workflow.md', md)
    expect(result.edges).toHaveLength(2)
    expect(result.edges[0].type).toBe('sequential')
  })

  it('parses H3 subsections as steps', () => {
    const md = `# Workflow

## Initialization

### Configuration Loading

Load config.

### Path Resolution

Resolve paths.
`
    const result = parseMarkdownWorkflow('workflow.md', md)
    expect(result.nodes).toHaveLength(3) // 1 H2 + 2 H3
    expect(result.nodes[1].label).toBe('Configuration Loading')
    expect(result.nodes[2].label).toBe('Path Resolution')
  })

  it('detects conditional H3 sections as check nodes', () => {
    const md = `# Workflow

## Decision

### Check prerequisites

Verify.

### If ready

Proceed.
`
    const result = parseMarkdownWorkflow('workflow.md', md)
    const checkNode = result.nodes.find((n) => n.label === 'Check prerequisites')
    const ifNode = result.nodes.find((n) => n.label === 'If ready')
    expect(checkNode?.type).toBe('check')
    expect(ifNode?.type).toBe('check')
  })

  it('parses numbered lists as action nodes', () => {
    const md = `# Workflow

## Steps

1. Do the first thing
2. Do the second thing
3. Do the third thing
`
    const result = parseMarkdownWorkflow('workflow.md', md)
    const actionNodes = result.nodes.filter((n) => n.type === 'action')
    expect(actionNodes).toHaveLength(3)
    expect(actionNodes[0].label).toBe('Do the first thing')
  })

  it('handles empty content with fallback', () => {
    const result = parseMarkdownWorkflow('empty.md', '')
    expect(result.nodes).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('preserves source line numbers', () => {
    const md = `# Workflow

## Phase One

Content.

## Phase Two

Content.
`
    const result = parseMarkdownWorkflow('workflow.md', md)
    expect(result.nodes[0].sourceLine).toBeDefined()
    expect(result.nodes[0].sourceLine).toBeGreaterThan(0)
  })
})
