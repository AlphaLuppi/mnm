import { EventEmitter } from 'events'
import type { MainEvents } from '@shared/events'

class TypedEventBus {
  private emitter = new EventEmitter()

  emit<K extends keyof MainEvents>(event: K, data: MainEvents[K]): void {
    this.emitter.emit(event, data)
  }

  on<K extends keyof MainEvents>(event: K, handler: (data: MainEvents[K]) => void): void {
    this.emitter.on(event, handler)
  }

  off<K extends keyof MainEvents>(event: K, handler: (data: MainEvents[K]) => void): void {
    this.emitter.off(event, handler)
  }

  once<K extends keyof MainEvents>(event: K, handler: (data: MainEvents[K]) => void): void {
    this.emitter.once(event, handler)
  }

  removeAllListeners(event?: keyof MainEvents): void {
    if (event) {
      this.emitter.removeAllListeners(event)
    } else {
      this.emitter.removeAllListeners()
    }
  }
}

export const eventBus = new TypedEventBus()
