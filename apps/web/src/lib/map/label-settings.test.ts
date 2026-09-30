import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LABEL_SETTINGS,
  LABEL_SETTINGS_KEY,
  loadLabelSettings,
  saveLabelSettings,
} from './label-settings'

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

describe('etiket ayarı', () => {
  it('varsayılan ikisi için de Tam', () => {
    expect(DEFAULT_LABEL_SETTINGS).toEqual({ selected: 'full', others: 'full' })
    expect(LABEL_SETTINGS_KEY).toBe('hy:map:labels')
  })

  it('kaydeder ve geri okur', () => {
    const storage = memoryStorage()
    saveLabelSettings(storage, { selected: 'short', others: 'hidden' })
    expect(storage.data.get(LABEL_SETTINGS_KEY)).toBe('{"selected":"short","others":"hidden"}')
    expect(loadLabelSettings(storage)).toEqual({ selected: 'short', others: 'hidden' })
  })

  it('kayıt yoksa, depolama yoksa ya da erişim hata verirse varsayılanı döndürür', () => {
    expect(loadLabelSettings(memoryStorage())).toEqual(DEFAULT_LABEL_SETTINGS)
    expect(loadLabelSettings(null)).toEqual(DEFAULT_LABEL_SETTINGS)
    expect(loadLabelSettings(throwing)).toEqual(DEFAULT_LABEL_SETTINGS)
    expect(() => saveLabelSettings(throwing, DEFAULT_LABEL_SETTINGS)).not.toThrow()
    expect(() => saveLabelSettings(null, DEFAULT_LABEL_SETTINGS)).not.toThrow()
  })

  it('bozuk içerikte varsayılana, geçersiz alanda o alanın varsayılanına döner', () => {
    for (const raw of ['{', 'null', '[]', '"full"', '42']) {
      expect(loadLabelSettings(memoryStorage({ [LABEL_SETTINGS_KEY]: raw })), raw).toEqual(
        DEFAULT_LABEL_SETTINGS,
      )
    }
    const partial = memoryStorage({
      [LABEL_SETTINGS_KEY]: JSON.stringify({ selected: 'tiny', others: 'short' }),
    })
    expect(loadLabelSettings(partial)).toEqual({ selected: 'full', others: 'short' })
  })

  it('dönen nesne varsayılan sabitini paylaşmaz', () => {
    const loaded = loadLabelSettings(null)
    loaded.others = 'hidden'
    expect(DEFAULT_LABEL_SETTINGS.others).toBe('full')
  })
})
