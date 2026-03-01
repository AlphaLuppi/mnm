import { useEffect, useState, useMemo } from 'react'
import { useHierarchyStore } from '@renderer/stores/hierarchy.store'

type CommandItem = {
  id: string
  label: string
  level: 'epic' | 'story'
  epicId: string
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const hierarchy = useHierarchyStore((s) => s.hierarchy)
  const selectEpic = useHierarchyStore((s) => s.selectEpic)
  const selectStory = useHierarchyStore((s) => s.selectStory)

  // Cmd+K / Ctrl+K toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
        setQuery('')
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const items = useMemo<CommandItem[]>(() => {
    if (hierarchy.status !== 'success') return []
    const result: CommandItem[] = []
    for (const epic of hierarchy.data.epics) {
      result.push({
        id: epic.id,
        label: `Epic ${epic.number}: ${epic.title}`,
        level: 'epic',
        epicId: epic.id
      })
      for (const story of epic.stories) {
        result.push({
          id: story.id,
          label: `Story ${story.number}: ${story.title}`,
          level: 'story',
          epicId: epic.id
        })
      }
    }
    return result
  }, [hierarchy])

  const filtered = useMemo(() => {
    if (!query) return items
    const lower = query.toLowerCase()
    return items.filter((item) => item.label.toLowerCase().includes(lower))
  }, [items, query])

  const handleSelect = (item: CommandItem) => {
    if (item.level === 'epic') {
      selectEpic(item.id)
    } else {
      selectStory(item.epicId, item.id)
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

      {/* Dialog */}
      <div
        role="dialog"
        aria-label="Command palette"
        className="relative w-full max-w-lg rounded-lg border border-border-default bg-bg-surface shadow-xl"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Naviguer vers..."
          autoFocus
          className="w-full border-b border-border-default bg-transparent px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        <div className="max-h-64 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-xs text-text-muted">Aucun resultat.</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
              >
                <span className="shrink-0 text-text-muted">
                  {item.level === 'epic' ? 'E' : 'S'}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
