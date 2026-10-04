import { describe, expect, it } from 'vitest'
import { AIRCRAFT_LIST_KEY, loadAircraftListOpen, saveAircraftListOpen } from './list-settings'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

const throwing = {
  getItem: () => {
    throw new DOMException('denied', 'SecurityError')
  },
  setItem: () => {
    throw new DOMException('full', 'QuotaExceededError')
  },
}

describe('uçak listesinin daraltılmış hâli (D-085)', () => {
  it('anahtar hy:map:list; kayıt yoksa ya da depolama yoksa liste açıktır', () => {
    expect(AIRCRAFT_LIST_KEY).toBe('hy:map:list')
    expect(loadAircraftListOpen(memoryStorage())).toBe(true)
    expect(loadAircraftListOpen(null)).toBe(true)
  })

  it('"closed" ve "open" kaydedilir ve geri okunur', () => {
    const storage = memoryStorage()
    saveAircraftListOpen(storage, false)
    expect(storage.data.get(AIRCRAFT_LIST_KEY)).toBe('closed')
    expect(loadAircraftListOpen(storage)).toBe(false)
    saveAircraftListOpen(storage, true)
    expect(storage.data.get(AIRCRAFT_LIST_KEY)).toBe('open')
    expect(loadAircraftListOpen(storage)).toBe(true)
  })

  it('geçersiz değer açık sayılır', () => {
    for (const raw of ['', 'CLOSED', 'false', '0', '{"open":false}']) {
      expect(loadAircraftListOpen(memoryStorage({ [AIRCRAFT_LIST_KEY]: raw })), raw).toBe(true)
    }
  })

  it('hata veren depolama güvenlidir: okuma açık döner, yazma sessizce geçer', () => {
    expect(loadAircraftListOpen(throwing)).toBe(true)
    expect(() => saveAircraftListOpen(throwing, false)).not.toThrow()
    expect(() => saveAircraftListOpen(null, false)).not.toThrow()
  })
})
