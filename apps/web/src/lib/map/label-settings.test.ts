import { describe, expect, it } from 'vitest'
import {
  AIRPORT_ICON_MODES,
  AIRPORT_LABEL_MODES,
  COUNTRY_LABEL_MODES,
  copyLabelSettings,
  DEFAULT_LABEL_SETTINGS,
  isAirportIconMode,
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
  it('varsayılan: uçaklar için Tam, havalimanları için Kod, simgeler ve ülke adları Göster (D-084, D-095, D-113)', () => {
    expect(DEFAULT_LABEL_SETTINGS).toEqual({
      selected: 'full',
      others: 'full',
      airports: 'code',
      airportIcons: 'shown',
      countries: 'shown',
    })
    expect(LABEL_SETTINGS_KEY).toBe('hy:map:labels')
    expect(AIRPORT_LABEL_MODES).toEqual(['hidden', 'code'])
    expect(AIRPORT_ICON_MODES).toEqual(['hidden', 'shown'])
    expect(COUNTRY_LABEL_MODES).toEqual(['hidden', 'shown'])
  })

  it('kaydeder ve geri okur (havalimanı, simge ve ülke alanı dahil)', () => {
    const storage = memoryStorage()
    saveLabelSettings(storage, {
      selected: 'short',
      others: 'hidden',
      airports: 'hidden',
      airportIcons: 'hidden',
      countries: 'hidden',
    })
    expect(storage.data.get(LABEL_SETTINGS_KEY)).toBe(
      '{"selected":"short","others":"hidden","airports":"hidden","airportIcons":"hidden","countries":"hidden"}',
    )
    expect(loadLabelSettings(storage)).toEqual({
      selected: 'short',
      others: 'hidden',
      airports: 'hidden',
      airportIcons: 'hidden',
      countries: 'hidden',
    })
    saveLabelSettings(storage, {
      selected: 'full',
      others: 'full',
      airports: 'code',
      airportIcons: 'shown',
      countries: 'shown',
    })
    expect(loadLabelSettings(storage).airports).toBe('code')
    expect(loadLabelSettings(storage).airportIcons).toBe('shown')
    expect(loadLabelSettings(storage).countries).toBe('shown')
  })

  it('simgeler gizliyken havalimanı etiketinin değeri saklı kalır (D-113)', () => {
    const storage = memoryStorage()
    saveLabelSettings(storage, { ...DEFAULT_LABEL_SETTINGS, airportIcons: 'hidden' })
    expect(loadLabelSettings(storage)).toMatchObject({ airports: 'code', airportIcons: 'hidden' })
    saveLabelSettings(storage, {
      ...DEFAULT_LABEL_SETTINGS,
      airports: 'hidden',
      airportIcons: 'hidden',
    })
    expect(loadLabelSettings(storage)).toMatchObject({ airports: 'hidden', airportIcons: 'hidden' })
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
      airportIcons: 'shown',
      countries: 'shown',
    })
  })

  it('ülke alanı olmayan v0.18.1 kaydı geçerlidir: ülke adları Göster, diğerleri korunur (D-095)', () => {
    const old = memoryStorage({
      [LABEL_SETTINGS_KEY]: JSON.stringify({
        selected: 'full',
        others: 'hidden',
        airports: 'hidden',
      }),
    })
    expect(loadLabelSettings(old)).toEqual({
      selected: 'full',
      others: 'hidden',
      airports: 'hidden',
      airportIcons: 'shown',
      countries: 'shown',
    })
  })

  it('simge alanı olmayan v0.25.1 kaydı geçerlidir: simgeler Göster, diğerleri korunur (D-113)', () => {
    const old = memoryStorage({
      [LABEL_SETTINGS_KEY]: JSON.stringify({
        selected: 'short',
        others: 'hidden',
        airports: 'hidden',
        countries: 'hidden',
      }),
    })
    expect(loadLabelSettings(old)).toEqual({
      selected: 'short',
      others: 'hidden',
      airports: 'hidden',
      airportIcons: 'shown',
      countries: 'hidden',
    })
  })

  it('kaldırılan "Kod ve ad" ile saklanmış kayıt Kod okunur; uçak ayarları korunur (2026-10-04)', () => {
    const old = memoryStorage({
      [LABEL_SETTINGS_KEY]: JSON.stringify({
        selected: 'short',
        others: 'hidden',
        airports: 'name',
      }),
    })
    expect(loadLabelSettings(old)).toEqual({
      selected: 'short',
      others: 'hidden',
      airports: 'code',
      airportIcons: 'shown',
      countries: 'shown',
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
      airportIcons: 'shown',
      countries: 'shown',
    })
    for (const airports of ['short', 'name', 'names', '', null, 1, ['code']]) {
      const storage = memoryStorage({ [LABEL_SETTINGS_KEY]: JSON.stringify({ airports }) })
      expect(loadLabelSettings(storage).airports, JSON.stringify(airports)).toBe('code')
    }
    for (const countries of ['show', 'visible', '', null, 1, true, ['shown'], { shown: true }]) {
      const storage = memoryStorage({
        [LABEL_SETTINGS_KEY]: JSON.stringify({ selected: 'short', countries }),
      })
      expect(loadLabelSettings(storage), JSON.stringify(countries)).toEqual({
        selected: 'short',
        others: 'full',
        airports: 'code',
        airportIcons: 'shown',
        countries: 'shown',
      })
    }
    for (const airportIcons of ['show', 'code', 'none', '', null, 0, false, ['hidden']]) {
      const storage = memoryStorage({
        [LABEL_SETTINGS_KEY]: JSON.stringify({ airports: 'hidden', airportIcons }),
      })
      expect(loadLabelSettings(storage), JSON.stringify(airportIcons)).toEqual({
        selected: 'full',
        others: 'full',
        airports: 'hidden',
        airportIcons: 'shown',
        countries: 'shown',
      })
    }
    expect(isAirportIconMode('hidden')).toBe(true)
    expect(isAirportIconMode('shown')).toBe(true)
    expect(isAirportIconMode('code')).toBe(false)
  })

  it('dönen nesne varsayılan sabitini paylaşmaz', () => {
    const loaded = loadLabelSettings(null)
    loaded.others = 'hidden'
    loaded.airports = 'hidden'
    loaded.airportIcons = 'hidden'
    loaded.countries = 'hidden'
    expect(DEFAULT_LABEL_SETTINGS.others).toBe('full')
    expect(DEFAULT_LABEL_SETTINGS.airports).toBe('code')
    expect(DEFAULT_LABEL_SETTINGS.airportIcons).toBe('shown')
    expect(DEFAULT_LABEL_SETTINGS.countries).toBe('shown')
  })

  it('copyLabelSettings ve sameLabelSettings bütün alanları kapsar', () => {
    const base: LabelSettings = {
      selected: 'full',
      others: 'short',
      airports: 'code',
      airportIcons: 'shown',
      countries: 'shown',
    }
    const copy = copyLabelSettings(base)
    expect(copy).toEqual(base)
    expect(copy).not.toBe(base)
    expect(sameLabelSettings(base, copy)).toBe(true)
    expect(sameLabelSettings(base, { ...base, selected: 'hidden' })).toBe(false)
    expect(sameLabelSettings(base, { ...base, others: 'full' })).toBe(false)
    expect(sameLabelSettings(base, { ...base, airports: 'hidden' })).toBe(false)
    expect(sameLabelSettings(base, { ...base, airportIcons: 'hidden' })).toBe(false)
    expect(sameLabelSettings(base, { ...base, countries: 'hidden' })).toBe(false)
    expect(copyLabelSettings({ ...base, countries: 'hidden' }).countries).toBe('hidden')
    expect(copyLabelSettings({ ...base, airportIcons: 'hidden' }).airportIcons).toBe('hidden')
  })
})
