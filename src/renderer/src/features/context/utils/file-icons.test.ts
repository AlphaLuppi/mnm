import { describe, it, expect } from 'vitest'
import { getFileIcon } from './file-icons'

describe('getFileIcon', () => {
  it('returns TS icon for .ts extension', () => {
    const icon = getFileIcon('ts')
    expect(icon.label).toBe('TS')
    expect(icon.color).toContain('blue')
  })

  it('returns TX icon for .tsx extension', () => {
    const icon = getFileIcon('tsx')
    expect(icon.label).toBe('TX')
  })

  it('handles dot prefix', () => {
    const icon = getFileIcon('.ts')
    expect(icon.label).toBe('TS')
  })

  it('handles uppercase extensions', () => {
    const icon = getFileIcon('JSON')
    expect(icon.label).toBe('JS')
  })

  it('returns MD icon for markdown', () => {
    const icon = getFileIcon('md')
    expect(icon.label).toBe('MD')
  })

  it('returns YM icon for yaml/yml', () => {
    expect(getFileIcon('yaml').label).toBe('YM')
    expect(getFileIcon('yml').label).toBe('YM')
  })

  it('returns default icon for unknown extension', () => {
    const icon = getFileIcon('xyz')
    expect(icon.label).toBe('FI')
  })
})
