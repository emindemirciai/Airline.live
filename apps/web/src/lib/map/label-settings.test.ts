import { describe, expect, it } from 'vitest'
import {
  AIRPORT_LABEL_MODES,
  copyLabelSettings,
  DEFAULT_LABEL_SETTINGS,
  LABEL_SETTINGS_KEY,
  loadLabelSettings,
  sameLabelSettings,
  saveLabelSettings,
  type LabelSettings,
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
  it('varsayılan: uçaklar için Tam, havalimanları için Kod (kullanıcı kararı 2026-10-03)', () => {
    expect(DEFAULT_LABEL_SETTINGS).toEqual({ selected: 'full', others: 'full', airports: 'code' })
    expect(LABEL_SETTINGS_KEY).toBe('hy:map:labels')
    expect(AIRPORT_LABEL_MODES).toEqual(['hidden', 'code', 'name'])
  })

  it('kaydeder ve geri okur (havalimanı alanı dahil)', () => {
    const storage = memoryStorage()
    saveLabelSettings(storage, { selected: 'short', others: 'hidden', airports: 'name' })
    expect(storage.data.get(LABEL_SETTINGS_KEY)).toBe(
      '{"selected":"short","others":"hidden","airports":"name"}',
    )
    expect(loadLabelSettings(storage)).toEqual({
      selected: 'short',
      others: 'hidden',
      airports: 'name',
    })
    saveLabelSettings(storage, { selected: 'full', others: 'full', airports: 'hidden' })
    expect(loadLabelSettings(storage).airports).toBe('hidden')
  })

  it('yalnızca bilinen alanlar yazılır', () => {
    const storage = memoryStorage()
    const extra = { ...DEFAULT_LABEL_SETTINGS, theme: 'dark' } as LabelSettings
    saveLabelSettings(storage, extra)
    expect(JSON.parse(storage.data.get(LABEL_SETTINGS_KEY) ?? '{}')).toEqual(DEFAULT_LABEL_SETTINGS)
  })

  it('havalimanı alanı olmayan eski kayıt geçerlidir: uçak ayarları korunur, havalimanları Kod', () => {
    const old = memoryStorage({
      [LABEL_SETTINGS_KEY]: JSON.stringify({ selected: 'short', others: 'hidden' }),
    })
    expect(loadLabelSettings(old)).toEqual({
      selected: 'short',
      others: 'hidden',
      airports: 'code',
    })
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
      [LABEL_SETTINGS_KEY]: JSON.stringify({ selected: 'tiny', others: 'short', airports: 'full' }),
    })
    expect(loadLabelSettings(partial)).toEqual({
      selected: 'full',
      others: 'short',
      airports: 'code',
    })
    for (const airports of ['short', 'names', '', null, 1, ['name']]) {
      const storage = memoryStorage({ [LABEL_SETTINGS_KEY]: JSON.stringify({ airports }) })
      expect(loadLabelSettings(storage).airports, JSON.stringify(airports)).toBe('code')
    }
  })

  it('dönen nesne varsayılan sabitini paylaşmaz', () => {
    const loaded = loadLabelSettings(null)
    loaded.others = 'hidden'
    loaded.airports = 'hidden'
    expect(DEFAULT_LABEL_SETTINGS.others).toBe('full')
    expect(DEFAULT_LABEL_SETTINGS.airports).toBe('code')
  })

  it('copyLabelSettings ve sameLabelSettings bütün alanları kapsar', () => {
    const base: LabelSettings = { selected: 'full', others: 'short', airports: 'code' }
    const copy = copyLabelSettings(base)
    expect(copy).toEqual(base)
    expect(copy).not.toBe(base)
    expect(sameLabelSettings(base, copy)).toBe(true)
    expect(sameLabelSettings(base, { ...base, selected: 'hidden' })).toBe(false)
    expect(sameLabelSettings(base, { ...base, others: 'full' })).toBe(false)
    expect(sameLabelSettings(base, { ...base, airports: 'name' })).toBe(false)
  })
})
