import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'

export type MarkdownSection = {
  title: string
  depth: number
  content: string
  startLine: number
  endLine: number
}

export function parseMarkdownToAST(content: string): Root {
  const processor = unified().use(remarkParse)
  return processor.parse(content)
}

export function extractSections(ast: Root): MarkdownSection[] {
  const sections: MarkdownSection[] = []
  const headings: { title: string; depth: number; startLine: number; index: number }[] = []

  visit(ast, 'heading', (node) => {
    const title = extractNodeText(node)
    headings.push({
      title,
      depth: node.depth,
      startLine: node.position?.start.line ?? 0,
      index: ast.children.indexOf(node)
    })
  })

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i]
    const nextHeading = headings[i + 1]
    const endLine = nextHeading?.startLine ? nextHeading.startLine - 1 : (ast.position?.end.line ?? 0)

    // Collect content between this heading and the next
    const contentParts: string[] = []
    for (let j = heading.index + 1; j < ast.children.length; j++) {
      const child = ast.children[j]
      if (nextHeading && j >= nextHeading.index) break
      contentParts.push(extractNodeText(child))
    }

    sections.push({
      title: heading.title,
      depth: heading.depth,
      content: contentParts.join('\n'),
      startLine: heading.startLine,
      endLine
    })
  }

  return sections
}

export function extractTextContent(ast: Root): string {
  const parts: string[] = []
  visit(ast, 'text', (node) => {
    parts.push(node.value)
  })
  return parts.join(' ')
}

function extractNodeText(node: unknown): string {
  const parts: string[] = []
  visit(node as Root, 'text', (textNode) => {
    parts.push(textNode.value)
  })
  return parts.join(' ')
}
