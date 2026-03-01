import { useEffect } from 'react'
import mitt from 'mitt'
import type { RendererEvents } from '@shared/events'

export const rendererBus = mitt<RendererEvents>()

export function useEventBus<K extends keyof RendererEvents>(
  event: K,
  handler: (data: RendererEvents[K]) => void
): void {
  useEffect(() => {
    rendererBus.on(event, handler)
    return (): void => {
      rendererBus.off(event, handler)
    }
  }, [event, handler])
}
