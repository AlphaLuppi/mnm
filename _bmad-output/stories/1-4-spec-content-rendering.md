# Story 1.4: Spec Content Rendering

Status: ready-for-dev

## Story

As a user,
I want to read specs with proper formatting and syntax highlighting,
so that I can understand the content easily.

## Acceptance Criteria

1. Selecting a spec opens it in the main content area at `/specs/[id]`
2. Markdown is rendered with: headings (H1-H6), lists (ordered/unordered), code blocks with syntax highlighting, tables, links (clickable), images
3. YAML frontmatter is displayed in a collapsible header section (key-value pairs, styled)
4. Rendering is fast (< 200ms for 1000 lines)
5. The content is scrollable with smooth scrolling
6. Text is selectable and copyable
7. The spec detail page shows a breadcrumb: Specs > [Type] > [Title]

## Tasks / Subtasks

- [ ] Task 1: Create spec detail page (AC: #1, #7)
  - [ ] Create `src/app/specs/[id]/page.tsx` as a Server Component
  - [ ] Fetch spec by ID from database
  - [ ] Read raw file content from disk (using `fs.readFile`)
  - [ ] Display breadcrumb using shadcn/ui `Breadcrumb` component
  - [ ] Pass content to renderer component
- [ ] Task 2: Implement Markdown renderer (AC: #2, #4, #6)
  - [ ] Create `src/components/specs/spec-renderer.tsx` (client component)
  - [ ] Install `react-markdown` and `remark-gfm` for GFM (tables, strikethrough, etc.)
  - [ ] Install `rehype-highlight` or `react-syntax-highlighter` for code block syntax highlighting
  - [ ] Configure component mapping for headings, lists, tables, links, images, code blocks
  - [ ] Ensure links open in new tab (`target="_blank"`) for external URLs
  - [ ] Wrap in shadcn/ui `ScrollArea` for smooth scrolling
- [ ] Task 3: Implement frontmatter display (AC: #3)
  - [ ] Parse YAML frontmatter with `gray-matter` (already installed in Story 1.2)
  - [ ] Create `src/components/specs/spec-frontmatter.tsx`
  - [ ] Use shadcn/ui `Collapsible` to show/hide frontmatter
  - [ ] Display as a styled key-value list (table or definition list)
  - [ ] Default state: collapsed (to prioritize content)
- [ ] Task 4: Style the renderer (AC: #2, #5)
  - [ ] Apply Tailwind typography plugin (`@tailwindcss/typography`) for prose styling
  - [ ] Or manually style via component class mapping in react-markdown
  - [ ] Ensure code blocks have dark background, monospace font, and proper padding
  - [ ] Style tables with borders and alternating row colors
  - [ ] Ensure heading anchors are visually distinct (font-weight, size)
- [ ] Task 5: Install rendering dependencies
  - [ ] Install `react-markdown`: `npm install react-markdown`
  - [ ] Install `remark-gfm`: `npm install remark-gfm`
  - [ ] Install `rehype-highlight`: `npm install rehype-highlight`
  - [ ] Install `@tailwindcss/typography`: `npm install @tailwindcss/typography`
- [ ] Task 6: Add shadcn/ui components
  - [ ] Add `breadcrumb` component: `npx shadcn@latest add breadcrumb`

## Dev Notes

### Key Packages

- **react-markdown**: React component for rendering Markdown as React elements
- **remark-gfm**: Plugin for GitHub Flavored Markdown (tables, checkboxes, strikethrough)
- **rehype-highlight**: Syntax highlighting for code blocks using highlight.js
- **@tailwindcss/typography**: Tailwind plugin for beautiful prose styling (`prose` class)

### Rendering Architecture

```
SpecDetailPage (Server Component)
  -> fetch spec metadata from DB
  -> read raw file from disk
  -> extract frontmatter with gray-matter
  |
  +-- SpecFrontmatter (Client Component, Collapsible)
  |     -> key-value display of YAML metadata
  |
  +-- SpecRenderer (Client Component)
        -> react-markdown with remark-gfm + rehype-highlight
        -> wrapped in ScrollArea
```

### Code Block Highlighting

Use `rehype-highlight` with a dark theme (e.g., `github-dark`). Import the CSS in the component or globally. Supported languages should include at minimum: TypeScript, JavaScript, Rust, Python, JSON, YAML, Markdown, SQL, Bash.

### Performance Notes

- react-markdown renders Markdown into React virtual DOM, which is fast for typical spec sizes
- For very large files (5000+ lines), consider lazy rendering or virtualization (defer to post-POC)
- The `@tailwindcss/typography` plugin handles most prose styling with a single `prose` class

### Project Structure Notes

- `src/app/specs/[id]/page.tsx` -- spec detail page
- `src/components/specs/spec-renderer.tsx` -- Markdown renderer
- `src/components/specs/spec-frontmatter.tsx` -- YAML frontmatter display

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4: Spec Content Rendering]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.3 - Spec-as-Interface]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
