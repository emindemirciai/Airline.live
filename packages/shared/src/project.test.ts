import { describe, expect, it } from 'vitest'
import { shortSha } from './project'

describe('shortSha', () => {
  it('40 haneli kimliği ilk 7 haneye kısaltır', () => {
    expect(shortSha('65a6f4ddf0bf900f09225e1d541dd5a3c33268a5')).toBe('65a6f4d')
  })
  it('zaten kısa kimliği ve commit olmayan değeri değiştirmez', () => {
    expect(shortSha('65a6f4d')).toBe('65a6f4d')
    expect(shortSha('dev')).toBe('dev')
    expect(shortSha('')).toBe('')
  })
})
