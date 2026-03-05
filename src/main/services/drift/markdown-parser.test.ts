import { describe, it, expect } from 'vitest'
import { parseMarkdownToAST, extractSections, extractTextContent } from './markdown-parser'

const SAMPLE_MD = `# Title

Some intro text.

## Section A

Content of section A with **bold** text.

## Section B

Content of section B.

### Subsection B1

Nested content.
`

describe('markdown-parser', () => {
  describe('parseMarkdownToAST', () => {
    it('parses markdown into AST', () => {
      const ast = parseMarkdownToAST(SAMPLE_MD)
      expect(ast.type).toBe('root')
      expect(ast.children.length).toBeGreaterThan(0)
    })
  })

  describe('extractSections', () => {
    it('extracts sections from AST', () => {
      const ast = parseMarkdownToAST(SAMPLE_MD)
      const sections = extractSections(ast)

      expect(sections.length).toBe(4)
      expect(sections[0].title).toBe('Title')
      expect(sections[0].depth).toBe(1)
      expect(sections[1].title).toBe('Section A')
      expect(sections[1].depth).toBe(2)
      expect(sections[2].title).toBe('Section B')
      expect(sections[3].title).toBe('Subsection B1')
      expect(sections[3].depth).toBe(3)
    })

    it('extracts content between sections', () => {
      const ast = parseMarkdownToAST(SAMPLE_MD)
      const sections = extractSections(ast)

      expect(sections[0].content).toContain('Some intro text')
      expect(sections[1].content).toContain('Content of section A')
      expect(sections[1].content).toContain('bold')
    })
  })

  describe('extractTextContent', () => {
    it('extracts all text from AST', () => {
      const ast = parseMarkdownToAST(SAMPLE_MD)
      const text = extractTextContent(ast)

      expect(text).toContain('Title')
      expect(text).toContain('Some intro text')
      expect(text).toContain('Content of section A')
      expect(text).toContain('bold')
      expect(text).toContain('Nested content')
    })

    it('handles empty markdown', () => {
      const ast = parseMarkdownToAST('')
      const text = extractTextContent(ast)
      expect(text).toBe('')
    })
  })
})
