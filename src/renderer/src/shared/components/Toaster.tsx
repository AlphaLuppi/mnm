import { useState, useCallback, useEffect, useRef } from 'react'

type Toast = {
  id: string
  title: string
  description?: string
  duration: number
  onClick?: () => void
}

const MAX_TOASTS = 3
let toastIdCounter = 0
let globalAddToast: ((toast: Omit<Toast, 'id'>) => void) | null = null

export function toast(options: Omit<Toast, 'id'>): void {
  globalAddToast?.(options)
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (options: Omit<Toast, 'id'>) => {
      const id = `toast-${++toastIdCounter}`
      const newToast: Toast = { ...options, id }

      setToasts((prev) => {
        const next = [...prev, newToast]
        // Enforce max limit — remove oldest
        while (next.length > MAX_TOASTS) {
          const removed = next.shift()!
          const timer = timersRef.current.get(removed.id)
          if (timer) {
            clearTimeout(timer)
            timersRef.current.delete(removed.id)
          }
        }
        return next
      })

      // Auto-dismiss
      if (options.duration > 0) {
        const timer = setTimeout(() => removeToast(id), options.duration)
        timersRef.current.set(id, timer)
      }
    },
    [removeToast]
  )

  // Register global toast function
  useEffect(() => {
    globalAddToast = addToast
    return () => {
      globalAddToast = null
    }
  }, [addToast])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer)
      }
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="w-80 rounded-lg border border-border-default bg-bg-elevated p-3 shadow-lg
                     motion-safe:animate-toast-slide-in cursor-pointer"
          onClick={() => {
            t.onClick?.()
            removeToast(t.id)
          }}
          role="alert"
        >
          <p className="text-sm font-medium text-text-primary">{t.title}</p>
          {t.description && (
            <p className="mt-1 text-xs text-text-secondary">{t.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}
