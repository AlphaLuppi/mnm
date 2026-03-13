# Story 1.6: Code File Browser & Syntax Highlighting

Status: ready-for-dev

## Story

As a user,
I want to browse code files with syntax highlighting,
so that I can review implementation alongside specs.

## Acceptance Criteria

1. A "Files" tab or section displays the repository file structure as a tree view
2. Clicking a file opens it in a read-only code viewer
3. Syntax highlighting works for: Rust (.rs), TypeScript (.ts, .tsx), Python (.py), Markdown (.md), JSON (.json), YAML (.yaml, .yml)
4. Line numbers are displayed alongside code
5. Files up to 10,000 LOC render in < 500ms
6. Scrolling is smooth
7. No code editing is allowed (read-only in MVP)
8. Common directories are excluded from the tree (.git, node_modules, .mnm, .next)

## Tasks / Subtasks

- [ ] Task 1: Create file tree API route (AC: #1, #8)
  - [ ] Create `src/app/api/files/route.ts`
  - [ ] GET handler: scan repository directory recursively
  - [ ] Return nested tree structure: `{ name, path, type: 'file' | 'directory', children? }`
  - [ ] Exclude: `.git/`, `node_modules/`, `.mnm/`, `.next/`, `dist/`, `build/`
  - [ ] Sort: directories first, then files alphabetically
- [ ] Task 2: Create file content API route (AC: #2)
  - [ ] Create `src/app/api/files/[...path]/route.ts` (catch-all route)
  - [ ] GET handler: read file content from disk, return as text
  - [ ] Validate path is within repository root (prevent path traversal)
  - [ ] Return 404 for non-existent files
  - [ ] Set size limit (skip files > 1MB)
- [ ] Task 3: Build file tree component (AC: #1, #8)
  - [ ] Create `src/components/files/file-tree.tsx` (client component)
  - [ ] Render recursive tree with expand/collapse per directory
  - [ ] Use Lucide icons: `Folder` / `FolderOpen` for directories, `File` for files (or language-specific icons)
  - [ ] Use shadcn/ui `Collapsible` for directory expand/collapse
  - [ ] Clicking a file loads its content in the viewer
- [ ] Task 4: Build code viewer component (AC: #2, #3, #4, #6, #7)
  - [ ] Create `src/components/files/code-viewer.tsx` (client component)
  - [ ] Use `react-syntax-highlighter` with `oneDark` or `vscDarkPlus` theme
  - [ ] Or use `shiki` for more accurate VS Code-like highlighting
  - [ ] Display line numbers (enabled by default)
  - [ ] Wrap in shadcn/ui `ScrollArea` for smooth scrolling
  - [ ] Set `readOnly` / non-editable (no contentEditable, no textarea)
  - [ ] Detect language from file extension for highlighter
- [ ] Task 5: Create files page (AC: #1)
  - [ ] Create `src/app/files/page.tsx`
  - [ ] Two-panel layout: file tree (left, ~250px) + code viewer (right, flex)
  - [ ] Use shadcn/ui `ResizablePanelGroup` for adjustable split
  - [ ] Add route to sidebar navigation (Story 1.1 sidebar update)
- [ ] Task 6: Install dependencies (AC: #3)
  - [ ] Install `react-syntax-highlighter`: `npm install react-syntax-highlighter @types/react-syntax-highlighter`
  - [ ] Or install `shiki`: `npm install shiki`
  - [ ] Add shadcn/ui `resizable` component: `npx shadcn@latest add resizable`
- [ ] Task 7: Handle large files (AC: #5)
  - [ ] For files > 10,000 lines, show first 1000 lines with a "Show more" button
  - [ ] Display file size and line count in header

## Dev Notes

### Key Components

- **react-syntax-highlighter** or **shiki**: For code syntax highlighting. `shiki` provides more accurate, VS Code-like highlighting but is heavier. `react-syntax-highlighter` is lighter and sufficient for POC.
- **shadcn/ui ResizablePanelGroup**: For the adjustable two-panel layout (tree + viewer)
- **shadcn/ui ScrollArea**: For smooth scrolling in the code viewer

### Language Detection Map

```typescript
const languageMap: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.rs': 'rust',
  '.py': 'python',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.css': 'css',
  '.html': 'html',
  '.sql': 'sql',
  '.sh': 'bash',
}
```

### Security: Path Traversal Prevention

The file content API route MUST validate that the requested path:
1. Is relative (no absolute paths)
2. Does not contain `..` segments
3. Resolves to a path within the repository root
4. Is not a binary file (check extension or use file type detection)

```typescript
import path from 'path'

function validatePath(requestedPath: string, repoRoot: string): string {
  const resolved = path.resolve(repoRoot, requestedPath)
  if (!resolved.startsWith(repoRoot)) {
    throw new Error('Path traversal detected')
  }
  return resolved
}
```

### Project Structure Notes

- `src/app/files/page.tsx` -- files browser page
- `src/app/api/files/route.ts` -- file tree API
- `src/app/api/files/[...path]/route.ts` -- file content API (catch-all)
- `src/components/files/file-tree.tsx` -- tree component
- `src/components/files/code-viewer.tsx` -- syntax-highlighted viewer

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6: Code File Browser & Syntax Highlighting]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9 - UI Architecture]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 10 - Security Considerations]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
