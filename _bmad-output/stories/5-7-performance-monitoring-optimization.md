# Story 5.7: Performance Monitoring & Optimization

Status: ready-for-dev

## Story

As a developer,
I want performance metrics and optimization,
so that MnM meets its performance targets for a responsive user experience.

## Acceptance Criteria

1. UI responsiveness is measured: target 60 FPS in browser (measured via `requestAnimationFrame` or Performance API), logged at startup and periodically
2. Drift detection performance is measured: target < 5s for 1000 LOC, measured per detection, logged per analysis
3. Git operations performance is measured: target < 500ms (web target via simple-git CLI), measured per operation (status, diff, checkout)
4. When performance degrades below targets, a warning is logged and user is optionally notified for severe cases
5. Performance metrics are aggregated (average, p50, p95) and displayed in an optional debug panel in settings
6. Optimization applied: lazy loading for large spec files, debouncing for real-time UI updates, background execution for heavy operations (git, AI)

## Tasks / Subtasks

- [ ] Task 1: Create performance measurement utilities (AC: #1, #2, #3)
  - [ ] Create `src/lib/core/performance.ts` with `measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T>` wrapper
  - [ ] Record measurements: operation name, duration in ms, timestamp
  - [ ] Store measurements in memory (circular buffer, last 1000 measurements)
  - [ ] Calculate aggregates: average, p50, p95, p99 per operation type
- [ ] Task 2: Instrument git operations (AC: #3)
  - [ ] Wrap `simple-git` calls in `src/lib/git/repository.ts` with `measureAsync()`
  - [ ] Track: `git.status()`, `git.diff()`, `git.log()`, `git.branch()`
  - [ ] Log warning if any operation exceeds 500ms threshold
- [ ] Task 3: Instrument drift detection (AC: #2)
  - [ ] Wrap drift detection pipeline steps in `measureAsync()`
  - [ ] Track total pipeline duration and per-step durations (diff generation, AI analysis, classification)
  - [ ] Log warning if total exceeds 5s for standard analysis
- [ ] Task 4: Implement client-side performance monitoring (AC: #1)
  - [ ] Create `src/components/shared/performance-monitor.tsx` that measures frame rate using `requestAnimationFrame`
  - [ ] Log FPS metrics every 30 seconds in development mode
  - [ ] Report to performance aggregator via `/api/performance` endpoint
- [ ] Task 5: Apply lazy loading optimizations (AC: #6)
  - [ ] Use Next.js `dynamic()` import for heavy components (diff viewer, spec renderer, log viewer)
  - [ ] Add `loading` fallback with shadcn/ui Skeleton components
  - [ ] Lazy-load large spec file content (only load content when spec is selected, not on index)
- [ ] Task 6: Apply debouncing optimizations (AC: #6)
  - [ ] Debounce spec search input (300ms delay before API call)
  - [ ] Debounce window resize events for layout recalculation
  - [ ] Throttle agent log append operations (batch every 100ms for high-frequency logs)
- [ ] Task 7: Build performance debug panel (AC: #5)
  - [ ] Create `src/components/settings/performance-panel.tsx` showing current metrics
  - [ ] Display as a table: operation name, avg duration, p50, p95, sample count
  - [ ] Add toggle in settings to enable/disable performance panel visibility
  - [ ] Use SWR to fetch metrics from `/api/performance` endpoint
- [ ] Task 8: Create performance API endpoint (AC: #5)
  - [ ] `GET /api/performance` returns aggregated metrics
  - [ ] `POST /api/performance` accepts client-side metrics (FPS, page load time)
- [ ] Task 9: Write tests (AC: #1, #2, #3, #4)
  - [ ] Unit tests for measurement wrapper (records duration correctly)
  - [ ] Unit tests for aggregate calculations (avg, p50, p95)
  - [ ] Test warning is emitted when threshold exceeded
  - [ ] Test lazy loading with dynamic imports renders skeleton then content

## Dev Notes

- Performance targets are adapted for web: 60 FPS (not 120 FPS as in native), < 500ms git ops (not 200ms, since simple-git spawns CLI processes)
- The `measureAsync` wrapper should have negligible overhead (< 1ms) so it can be used in production
- Circular buffer for measurements prevents unbounded memory growth: keep last 1000 measurements per operation type
- `requestAnimationFrame`-based FPS monitoring is standard browser technique; only enable in dev/debug mode to avoid overhead
- For debouncing, use a simple custom hook `useDebounce(value, delay)` rather than adding lodash dependency
- Next.js `dynamic()` with `{ ssr: false }` for components that use browser-only APIs (EventSource, requestAnimationFrame)

### Project Structure Notes

- `src/lib/core/performance.ts` -- measurement utilities and aggregation
- `src/components/shared/performance-monitor.tsx` -- client-side FPS monitor
- `src/components/settings/performance-panel.tsx` -- debug metrics panel
- `src/app/api/performance/route.ts` -- performance metrics API

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 2.2 - Trade-offs vs Native: 60 FPS browser target]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 6.3 - Real-Time Strategy Summary]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.7]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
