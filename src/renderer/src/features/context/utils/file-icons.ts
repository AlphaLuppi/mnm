type FileIconInfo = {
  label: string
  color: string
}

const ICON_MAP: Record<string, FileIconInfo> = {
  ts: { label: 'TS', color: 'text-blue-400' },
  tsx: { label: 'TX', color: 'text-blue-300' },
  js: { label: 'JS', color: 'text-yellow-400' },
  jsx: { label: 'JX', color: 'text-yellow-300' },
  md: { label: 'MD', color: 'text-text-muted' },
  yaml: { label: 'YM', color: 'text-green-400' },
  yml: { label: 'YM', color: 'text-green-400' },
  json: { label: 'JS', color: 'text-yellow-500' },
  css: { label: 'CS', color: 'text-purple-400' },
  html: { label: 'HT', color: 'text-orange-400' },
  svg: { label: 'SV', color: 'text-pink-400' }
}

const DEFAULT_ICON: FileIconInfo = { label: 'FI', color: 'text-text-muted' }

export function getFileIcon(extension: string): FileIconInfo {
  const ext = extension.replace(/^\./, '').toLowerCase()
  return ICON_MAP[ext] ?? DEFAULT_ICON
}
