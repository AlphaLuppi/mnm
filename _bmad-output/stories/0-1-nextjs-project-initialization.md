# Story 0.1: Next.js Project Initialization

Status: ready-for-dev

## Story

As a developer,
I want a well-structured Next.js project with all required dependencies,
so that I can develop modular, maintainable code for the MnM web POC.

## Acceptance Criteria

1. Next.js 15 app router project is initialized with TypeScript strict mode
2. All core dependencies are installed and configured (see Dev Notes for exact list)
3. Tailwind CSS v4 is configured with a base design system (Zed-inspired dark theme)
4. shadcn/ui is initialized with required base components
5. Drizzle ORM is configured with SQLite (better-sqlite3) driver
6. Project compiles and runs with `npm run dev` without errors
7. ESLint and Prettier are configured with consistent rules
8. The project structure matches the defined layout (see Dev Notes)

## Tasks / Subtasks

- [ ] Task 1: Initialize Next.js project (AC: #1)
  - [ ] Run `npx create-next-app@latest` with App Router, TypeScript, Tailwind, ESLint
  - [ ] Verify `tsconfig.json` has `strict: true` and path aliases (`@/*`)
- [ ] Task 2: Install core dependencies (AC: #2)
  - [ ] Install runtime deps: `drizzle-orm`, `better-sqlite3`, `simple-git`, `uuid`, `zod`
  - [ ] Install dev deps: `drizzle-kit`, `@types/better-sqlite3`, `@types/uuid`, `prettier`
- [ ] Task 3: Configure Tailwind CSS design system (AC: #3)
  - [ ] Set up dark theme colors (Zed-inspired: neutral grays, blue accents)
  - [ ] Configure font: mono for code, sans for UI
- [ ] Task 4: Initialize shadcn/ui (AC: #4)
  - [ ] Run `npx shadcn@latest init` (New York style, neutral theme)
  - [ ] Add base components: `button`, `card`, `badge`, `tabs`, `scroll-area`, `separator`
- [ ] Task 5: Configure Drizzle ORM (AC: #5)
  - [ ] Create `drizzle.config.ts` pointing to SQLite file at `.mnm/state.db`
  - [ ] Create `src/lib/db/index.ts` with database connection setup
- [ ] Task 6: Create project directory structure (AC: #8)
  - [ ] Create all directories per the project structure layout
  - [ ] Add placeholder `index.ts` barrel exports where appropriate
- [ ] Task 7: Configure linting and formatting (AC: #7)
  - [ ] Configure ESLint with Next.js recommended rules
  - [ ] Configure Prettier with consistent settings (single quotes, no semicolons, trailing commas)
- [ ] Task 8: Verify build (AC: #6)
  - [ ] Run `npm run build` and ensure zero errors
  - [ ] Run `npm run dev` and verify app loads at localhost:3000

## Dev Notes

### Exact Dependencies

**Runtime:**
```
next react react-dom
drizzle-orm better-sqlite3
simple-git
uuid
zod
```

**Dev:**
```
typescript @types/node @types/react @types/react-dom
drizzle-kit @types/better-sqlite3 @types/uuid
tailwindcss @tailwindcss/postcss postcss
prettier eslint-config-prettier
```

**shadcn/ui** (installed via CLI, not npm):
```
npx shadcn@latest init
npx shadcn@latest add button card badge tabs scroll-area separator
```

### Project Structure

```
mnm/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Dashboard home page
│   │   └── globals.css         # Global styles + Tailwind
│   ├── components/             # React UI components
│   │   └── ui/                 # shadcn/ui components (auto-generated)
│   ├── lib/                    # Shared libraries
│   │   ├── db/                 # Database layer (Drizzle)
│   │   │   ├── index.ts        # DB connection singleton
│   │   │   ├── schema.ts       # Drizzle schema definitions
│   │   │   └── migrations/     # SQL migration files
│   │   ├── models/             # Domain types and enums (pure TS, no deps)
│   │   │   └── index.ts
│   │   ├── git/                # Git integration (simple-git wrapper)
│   │   │   └── index.ts
│   │   ├── agent/              # Agent orchestration
│   │   │   └── index.ts
│   │   ├── drift/              # Drift detection
│   │   │   └── index.ts
│   │   └── spec/               # Spec parsing and indexing
│   │       └── index.ts
│   └── hooks/                  # React hooks
├── drizzle.config.ts           # Drizzle ORM configuration
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── .prettierrc                 # Prettier configuration
├── package.json
└── .gitignore                  # Must include .mnm/ directory
```

### Configuration Files

**drizzle.config.ts:**
```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: '.mnm/state.db',
  },
})
```

**tsconfig.json** key settings:
- `strict: true`
- `paths: { "@/*": ["./src/*"] }`

**.prettierrc:**
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

**.gitignore** additions:
```
.mnm/
!.mnm/important-files.json
```

### Critical Constraints

- Use App Router (NOT Pages Router)
- TypeScript strict mode must be enabled
- better-sqlite3 is a native Node module -- Next.js server components and API routes can use it, but it CANNOT be imported in client components
- All database access must happen server-side (Server Components, Server Actions, or API Routes)
- The `.mnm/` directory must be git-ignored except for `important-files.json`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 4.1 - Cargo Workspace Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 2 - Technical Stack]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
