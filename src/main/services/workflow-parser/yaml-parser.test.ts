import { describe, it, expect } from 'vitest'
import { parseYamlWorkflow } from './yaml-parser'

describe('parseYamlWorkflow', () => {
  it('parses a workflow with name and description', () => {
    const yaml = `
name: test-workflow
description: "A test workflow"
author: BMad
`
    const result = parseYamlWorkflow('test.yaml', yaml)
    expect(result.metadata.name).toBe('test-workflow')
    expect(result.metadata.description).toBe('A test workflow')
    expect(result.errors).toHaveLength(0)
    expect(result.nodes.length).toBeGreaterThan(0)
  })

  it('parses steps array into nodes', () => {
    const yaml = `
name: step-workflow
steps:
  - id: init
    name: Initialize
    role: developer
    instructions: "Set up the project"
  - id: build
    name: Build
    instructions: "Build the project"
  - id: deploy
    name: Deploy
    next: init
`
    const result = parseYamlWorkflow('test.yaml', yaml)
    expect(result.nodes).toHaveLength(3)
    expect(result.nodes[0].id).toBe('init')
    expect(result.nodes[0].label).toBe('Initialize')
    expect(result.nodes[0].role).toBe('developer')
    expect(result.nodes[1].id).toBe('build')
  })

  it('creates edges from next references', () => {
    const yaml = `
name: edge-workflow
steps:
  - id: a
    name: Step A
    next: b
  - id: b
    name: Step B
    next:
      - c
      - d
  - id: c
    name: Step C
  - id: d
    name: Step D
`
    const result = parseYamlWorkflow('test.yaml', yaml)
    const explicitEdges = result.edges.filter((e) => e.source === 'a' || e.source === 'b')
    expect(explicitEdges.some((e) => e.source === 'a' && e.target === 'b')).toBe(true)
    expect(explicitEdges.some((e) => e.source === 'b' && e.target === 'c')).toBe(true)
    expect(explicitEdges.some((e) => e.source === 'b' && e.target === 'd')).toBe(true)
  })

  it('parses variables as a check node', () => {
    const yaml = `
name: var-workflow
variables:
  test_dir: "./tests"
  source_dir: "./src"
`
    const result = parseYamlWorkflow('test.yaml', yaml)
    const varNode = result.nodes.find((n) => n.id === 'variables')
    expect(varNode).toBeDefined()
    expect(varNode?.type).toBe('check')
    expect(varNode?.instructions).toContain('test_dir')
  })

  it('returns errors for malformed YAML', () => {
    const yaml = `
name: bad
steps:
  - this is: [not: valid
`
    const result = parseYamlWorkflow('bad.yaml', yaml)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].file).toBe('bad.yaml')
  })

  it('handles empty content', () => {
    const result = parseYamlWorkflow('empty.yaml', '')
    expect(result.nodes).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('parses required_tools as action node', () => {
    const yaml = `
name: tools-workflow
required_tools:
  - read_file
  - write_file
  - search_repo
`
    const result = parseYamlWorkflow('test.yaml', yaml)
    const toolsNode = result.nodes.find((n) => n.id === 'required-tools')
    expect(toolsNode).toBeDefined()
    expect(toolsNode?.type).toBe('action')
    expect(toolsNode?.instructions).toContain('read_file')
  })
})
