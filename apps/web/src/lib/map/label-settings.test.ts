import { describe, expect, it } from 'vitest'
import {
  AIRPORT_DISPLAY_MODES,
  COUNTRY_LABEL_MODES,
  copyLabelSettings,
  DEFAULT_LABEL_SETTINGS,
  isAirportDisplayMode,
  LABEL_SETTINGS_KEY,
  legacyAirportDisplay,
  legacyAirportsValue,
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

/** Kayıttaki JSON nesnesiyle bellek deposu. */
const stored = (record: unknown) => memoryStorage({ [LABEL_SETTINGS_KEY]: JSON.stringify(record) })

const throwing = {
  getItem: () => {
    throw new DOMException('denied', 'SecurityError')
  },
  setItem: () => {
    throw new DOMException('full', 'QuotaExceededError')
  },
}

describe('etiket ayarı', () => {
  it('varsayılan: uçaklar Tam, havalimanları Simge ve kod, ülke adları Göster (D-084, D-095, D-114)', () => {
    expect(DEFAULT_LABEL_SETTINGS).toEqual({
      selected: 'full',
      others: 'full',
      airportDisplay: 'icon-code',
      countries: 'shown',
    })
    expect(LABEL_SETTINGS_KEY).toBe('hy:map:labels')
    // Seçenek sırası: Gizle, Simge, Simge ve kod.
    expect(AIRPORT_DISPLAY_MODES).toEqual(['hidden', 'icon', 'icon-code'])
    expect(COUNTRY_LABEL_MODES).toEqual(['hidden', 'shown'])
  })

  it('kaydeder ve geri okur; yeni biçimin yanına türetilmiş eski `airports` yazılır (D-114)', () => {
    const storage = memoryStorage()
    const legacy = { hidden: 'hidden', icon: 'hidden', 'icon-code': 'code' } as const
    for (const airportDisplay of AIRPORT_DISPLAY_MODES) {
      const settings: LabelSettings = {
        selected: 'short',
        others: 'hidden',
        airportDisplay,
        countries: 'hidden',
      }
      saveLabelSettings(storage, settings)
      expect(storage.data.get(LABEL_SETTINGS_KEY)).toBe(
        `{"selected":"short","others":"hidden","airportDisplay":"${airportDisplay}","countries":"hidden","airports":"${legacy[airportDisplay]}"}`,
      )
      // Geçerli `airportDisplay` türetilmiş alandan önce gelir: Gizle, Simge'ye dönmez.
      expect(loadLabelSettings(storage)).toEqual(settings)
    }
  })

  it('yalnızca bilinen alanlar yazılır; `airports` ayardan türetilir, gelen değer yazılmaz', () => {
    const storage = memoryStorage()
    const extra = {
      ...DEFAULT_LABEL_SETTINGS,
      theme: 'dark',
      airports: 'hidden',
      airportIcons: 'hidden',
    } as LabelSettings
    saveLabelSettings(storage, extra)
    expect(JSON.parse(storage.data.get(LABEL_SETTINGS_KEY) ?? '{}')).toEqual({
      ...DEFAULT_LABEL_SETTINGS,
      airports: 'code',
    })
  })

  describe('eski sürümlerle birlikte yaşama (açık kalmış sekme, geri alma; D-114)', () => {
    /** v0.14.0–v0.25.2'nin okuması: yalnız `airports`, geçersizse ya da yoksa Kod. */
    const oldReader = (raw: string | undefined): string => {
      const { airports } = JSON.parse(raw ?? '{}') as { airports?: unknown }
      return airports === 'hidden' || airports === 'code' ? airports : 'code'
    }
    /** v0.25.2'nin yazması: bilinen dört alan, `airportDisplay` düşer. */
    const oldWriter = (raw: string | undefined, change: Record<string, string>): string => {
      const { selected, others, airports, countries } = JSON.parse(raw ?? '{}') as Record<
        string,
        unknown
      >
      return JSON.stringify({ selected, others, airports, countries, ...change })
    }

    it('legacyAirportsValue: Simge ve kod → Kod; Simge ve Gizle → eski Gizle (kodsuz pin)', () => {
      expect(legacyAirportsValue('icon-code')).toBe('code')
      expect(legacyAirportsValue('icon')).toBe('hidden')
      expect(legacyAirportsValue('hidden')).toBe('hidden')
    })

    it('eski sürüm yeni kaydı en yakın değerle okur', () => {
      const storage = memoryStorage()
      const expected = { hidden: 'hidden', icon: 'hidden', 'icon-code': 'code' } as const
      for (const airportDisplay of AIRPORT_DISPLAY_MODES) {
        saveLabelSettings(storage, { ...DEFAULT_LABEL_SETTINGS, airportDisplay })
        expect(oldReader(storage.data.get(LABEL_SETTINGS_KEY)), airportDisplay).toBe(
          expected[airportDisplay],
        )
      }
    })

    it('eski sekme başka bir ayarı yazınca Simge ve Simge ve kod korunur, Gizle Simge olur', () => {
      const expected = { hidden: 'icon', icon: 'icon', 'icon-code': 'icon-code' } as const
      for (const airportDisplay of AIRPORT_DISPLAY_MODES) {
        const storage = memoryStorage()
        saveLabelSettings(storage, { ...DEFAULT_LABEL_SETTINGS, airportDisplay })
        storage.setItem(
          LABEL_SETTINGS_KEY,
          oldWriter(storage.data.get(LABEL_SETTINGS_KEY), { others: 'short' }),
        )
        expect(loadLabelSettings(storage), airportDisplay).toEqual({
          ...DEFAULT_LABEL_SETTINGS,
          others: 'short',
          airportDisplay: expected[airportDisplay],
        })
      }
    })
  })

  describe('eski kayıtlar (v0.14.0–v0.25.2, `airports` alanı; D-084 → D-114)', () => {
    it('legacyAirportDisplay: Gizle (pin kalıyordu) → Simge; Kod ve "Kod ve ad" → Simge ve kod', () => {
      expect(legacyAirportDisplay('hidden')).toBe('icon')
      expect(legacyAirportDisplay('code')).toBe('icon-code')
      expect(legacyAirportDisplay('name')).toBe('icon-code')
      for (const value of [
        undefined,
        null,
        '',
        'icon',
        'icon-code',
        'shown',
        'full',
        1,
        true,
        ['code'],
      ]) {
        expect(legacyAirportDisplay(value), JSON.stringify(value)).toBeUndefined()
      }
    })

    it('`airports: "hidden"` kaydı Simge okunur; öbür alanlar korunur', () => {
      expect(
        loadLabelSettings(
          stored({ selected: 'short', others: 'hidden', airports: 'hidden', countries: 'hidden' }),
        ),
      ).toEqual({
        selected: 'short',
        others: 'hidden',
        airportDisplay: 'icon',
        countries: 'hidden',
      })
    })

    it('`airports: "code"` ve kaldırılan "Kod ve ad"ın `"name"`i (v0.14.0–v0.15.0) Simge ve kod okunur', () => {
      for (const airports of ['code', 'name']) {
        expect(
          loadLabelSettings(stored({ selected: 'short', others: 'hidden', airports })),
        ).toEqual({
          selected: 'short',
          others: 'hidden',
          airportDisplay: 'icon-code',
          countries: 'shown',
        })
      }
    })

    it('ülke alanı olmayan v0.18.1 kaydı: ülke adları Göster, havalimanları eski alandan (D-095)', () => {
      expect(
        loadLabelSettings(stored({ selected: 'full', others: 'hidden', airports: 'hidden' })),
      ).toEqual({ selected: 'full', others: 'hidden', airportDisplay: 'icon', countries: 'shown' })
    })

    it('havalimanı alanı hiç olmayan ya da geçersiz eski kayıt varsayılanı alır (Simge ve kod)', () => {
      expect(loadLabelSettings(stored({ selected: 'short', others: 'hidden' }))).toEqual({
        selected: 'short',
        others: 'hidden',
        airportDisplay: 'icon-code',
        countries: 'shown',
      })
      for (const airports of ['short', 'names', 'icon', '', null, 1, ['hidden'], { code: true }]) {
        expect(
          loadLabelSettings(stored({ airports })).airportDisplay,
          JSON.stringify(airports),
        ).toBe('icon-code')
      }
    })

    it('geçerli `airportDisplay` her zaman önce gelir; geçersizse eski alandan türetilir', () => {
      expect(
        loadLabelSettings(stored({ airportDisplay: 'icon-code', airports: 'hidden' }))
          .airportDisplay,
      ).toBe('icon-code')
      expect(
        loadLabelSettings(stored({ airportDisplay: 'hidden', airports: 'code' })).airportDisplay,
      ).toBe('hidden')
      expect(
        loadLabelSettings(stored({ airportDisplay: 'icon', airports: 'code' })).airportDisplay,
      ).toBe('icon')
      for (const airportDisplay of ['code', 'shown', 'Icon', '', null, 0, ['icon']]) {
        expect(
          loadLabelSettings(stored({ airportDisplay, airports: 'hidden' })).airportDisplay,
          JSON.stringify(airportDisplay),
        ).toBe('icon')
        expect(
          loadLabelSettings(stored({ airportDisplay })).airportDisplay,
          JSON.stringify(airportDisplay),
        ).toBe('icon-code')
      }
    })

    it('yayımlanmamış `airportIcons` alanı yok sayılır', () => {
      expect(
        loadLabelSettings(stored({ airports: 'code', airportIcons: 'hidden' })).airportDisplay,
      ).toBe('icon-code')
      expect(
        loadLabelSettings(stored({ airports: 'hidden', airportIcons: 'shown' })).airportDisplay,
      ).toBe('icon')
      expect(loadLabelSettings(stored({ airportIcons: 'hidden' }))).toEqual(DEFAULT_LABEL_SETTINGS)
    })

    it('eski kayıt okunurken yeniden yazılmaz; ayar değişince yeni biçim ve türetilmiş `airports` yazılır', () => {
      const raw = JSON.stringify({ selected: 'full', others: 'hidden', airports: 'hidden' })
      const storage = memoryStorage({ [LABEL_SETTINGS_KEY]: raw })
      const loaded = loadLabelSettings(storage)
      expect(storage.data.get(LABEL_SETTINGS_KEY)).toBe(raw)
      saveLabelSettings(storage, { ...loaded, countries: 'hidden' })
      expect(JSON.parse(storage.data.get(LABEL_SETTINGS_KEY) ?? '{}')).toEqual({
        selected: 'full',
        others: 'hidden',
        airportDisplay: 'icon',
        countries: 'hidden',
        airports: 'hidden',
      })
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
    expect(
      loadLabelSettings(stored({ selected: 'tiny', others: 'short', airportDisplay: 'full' })),
    ).toEqual({
      selected: 'full',
      others: 'short',
      airportDisplay: 'icon-code',
      countries: 'shown',
    })
    for (const countries of ['show', 'visible', '', null, 1, true, ['shown'], { shown: true }]) {
      expect(
        loadLabelSettings(stored({ selected: 'short', airportDisplay: 'hidden', countries })),
        JSON.stringify(countries),
      ).toEqual({ selected: 'short', others: 'full', airportDisplay: 'hidden', countries: 'shown' })
    }
    expect(isAirportDisplayMode('hidden')).toBe(true)
    expect(isAirportDisplayMode('icon')).toBe(true)
    expect(isAirportDisplayMode('icon-code')).toBe(true)
    for (const value of ['code', 'shown', 'iconCode', '', null, undefined, 1]) {
      expect(isAirportDisplayMode(value), JSON.stringify(value)).toBe(false)
    }
  })

  it('dönen nesne varsayılan sabitini paylaşmaz', () => {
    const loaded = loadLabelSettings(null)
    loaded.others = 'hidden'
    loaded.airportDisplay = 'hidden'
    loaded.countries = 'hidden'
    expect(DEFAULT_LABEL_SETTINGS.others).toBe('full')
    expect(DEFAULT_LABEL_SETTINGS.airportDisplay).toBe('icon-code')
    expect(DEFAULT_LABEL_SETTINGS.countries).toBe('shown')
  })

  it('copyLabelSettings ve sameLabelSettings bütün alanları kapsar', () => {
    const base: LabelSettings = {
      selected: 'full',
      others: 'short',
      airportDisplay: 'icon-code',
      countries: 'shown',
    }
    const copy = copyLabelSettings(base)
    expect(copy).toEqual(base)
    expect(copy).not.toBe(base)
    expect(sameLabelSettings(base, copy)).toBe(true)
    expect(sameLabelSettings(base, { ...base, selected: 'hidden' })).toBe(false)
    expect(sameLabelSettings(base, { ...base, others: 'full' })).toBe(false)
    expect(sameLabelSettings(base, { ...base, airportDisplay: 'icon' })).toBe(false)
    expect(sameLabelSettings(base, { ...base, airportDisplay: 'hidden' })).toBe(false)
    expect(sameLabelSettings(base, { ...base, countries: 'hidden' })).toBe(false)
    expect(copyLabelSettings({ ...base, countries: 'hidden' }).countries).toBe('hidden')
    expect(copyLabelSettings({ ...base, airportDisplay: 'hidden' }).airportDisplay).toBe('hidden')
    // Yalnız bilinen alanlar kopyalanır.
    const extra = { ...base, airports: 'code', airportIcons: 'shown' } as LabelSettings
    expect(Object.keys(copyLabelSettings(extra))).toEqual([
      'selected',
      'others',
      'airportDisplay',
      'countries',
    ])
  })
})
