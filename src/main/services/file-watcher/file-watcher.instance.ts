import { FileWatcherService } from './file-watcher.service'
import type { WatcherOptions } from './file-watcher.types'

let fileWatcher: FileWatcherService | null = null

export function initFileWatcher(options?: WatcherOptions): FileWatcherService {
  if (fileWatcher) {
    fileWatcher.stop()
  }
  fileWatcher = new FileWatcherService(options)
  return fileWatcher
}

export function getFileWatcher(): FileWatcherService | null {
  return fileWatcher
}
