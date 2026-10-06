import {
  COUNTRY_LABEL_LAYER_IDS,
  COUNTRY_LABEL_LAYER_KEYS,
  COUNTRY_LABEL_PLACEMENTS,
  COUNTRY_LABEL_SOURCE_ID,
  countryLabelHaloCurve,
  countryLabelLayerId,
  countryLabelTextSize,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import {
  COUNTRY_LABELS_ATTRIBUTE,
  COUNTRY_LABELS_REFRESH_MS,
  CountryLabelOverlay,
  countryLabelCollection,
  countryLabelVisibility,
  isCompactMap,
  renderedCountryLabelNames,
  type CountryLabelMap,
  type CountryLabelState,
} from './country-labels'

describe('countryLabelCollection', () => {
  it('164 Point (D-100: bütün ülkeler); koordinat [boylam, enlem]; özellikler tablodan, dile ve harita genişliğine göre', () => {
    const collection = countryLabelCollection('tr', false)
    expect(collection.type).toBe('FeatureCollection')
    expect(collection.features).toHaveLength(164)
    const turkey = COUNTRY_LABEL_PLACEMENTS.tr.TR?.regular
    if (!turkey) throw new Error('TR')
    expect(collection.features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [turkey[0], turkey[1]] },
      properties: {
        code: 'TR',
        name: 'TÜRKİYE',
        label: 'TÜRKİYE',
        tier: 1,
        fitZoom: turkey[2],
        rank: 0,
      },
    })
    const en = countryLabelCollection('en', false)
    expect(en.features.find((f) => f.properties.code === 'CY')?.properties.name).toBe('CYPRUS')
    const compact = countryLabelCollection('tr', true)
    expect(compact.features[0]?.properties.fitZoom).toBe(
      COUNTRY_LABEL_PLACEMENTS.tr.TR?.compact?.[2],
    )
    expect(compact.features.find((f) => f.properties.code === 'SA')?.properties.label).toBe(
      'SUUDİ\nARABİSTAN',
    )
    // Havalimanı olmayan ülkeler de (HİNDİSTAN, ABD); sığmayan küçük ülkeler ve adalar yok.
    for (const code of ['IN', 'US']) {
      expect(
        collection.features.some((f) => f.properties.code === code),
        code,
      ).toBe(true)
    }
    for (const code of ['BH', 'LU', 'MT', 'MV', 'VA']) {
      expect(
        collection.features.some((f) => f.properties.code === code),
        code,
      ).toBe(false)
    }
    expect(JSON.parse(JSON.stringify(collection))).toEqual(collection)
  })
})

describe('yardımcılar', () => {
  it('görünürlük: Göster visible, Gizle none', () => {
    expect(countryLabelVisibility('shown')).toBe('visible')
    expect(countryLabelVisibility('hidden')).toBe('none')
  })

  it('dar harita: 767 px ve altı (sitenin alttan açılan kart kırılımı)', () => {
    expect(isCompactMap(375)).toBe(true)
    expect(isCompactMap(767)).toBe(true)
    expect(isCompactMap(768)).toBe(false)
    expect(isCompactMap(1280)).toBe(false)
  })

  it('renderedCountryLabelNames: tekil, koda göre sıralı, | ile', () => {
    const feature = (code: string, name: string) => ({ properties: { code, name } })
    expect(
      renderedCountryLabelNames([
        feature('TR', 'TÜRKİYE'),
        feature('IR', 'İRAN'),
        feature('TR', 'TÜRKİYE'),
        feature('AZ', 'AZERBAYCAN'),
        { properties: null },
        { properties: { code: 1, name: 'X' } },
      ]),
    ).toBe('AZERBAYCAN|İRAN|TÜRKİYE')
    expect(renderedCountryLabelNames([])).toBe('')
  })
})

interface Harness {
  overlay: CountryLabelOverlay
  calls: string[]
  attribute: () => string | null
  layers: Set<string>
  advance: (ms: number) => void
  timers: Map<number, { fn: () => void; at: number }>
  rendered: { properties: { code: string; name: string } }[]
}

function harness(state: Partial<CountryLabelState> = {}): Harness {
  const calls: string[] = []
  const layers = new Set<string>()
  const timers = new Map<number, { fn: () => void; at: number }>()
  let clock = 1_000
  let nextTimer = 1
  const attributes = new Map<string, string>()
  const rendered: Harness['rendered'] = []
  const map: CountryLabelMap = {
    getLayer: (id) => (layers.has(id) ? { id } : undefined),
    getSource: (id) =>
      id === COUNTRY_LABEL_SOURCE_ID
        ? {
            setData: (data: { features: unknown[] }) =>
              calls.push(`setData ${data.features.length}`),
          }
        : undefined,
    setLayoutProperty: (id, name, value) => calls.push(`${id} ${name} ${JSON.stringify(value)}`),
    setPaintProperty: (id, name, value) =>
      calls.push(`${id} paint ${name} ${JSON.stringify(value)}`),
    queryRenderedFeatures: (options) => {
      calls.push(`query ${options.layers.join(',')}`)
      return rendered
    },
  }
  const overlay = new CountryLabelOverlay({
    element: {
      getAttribute: (name) => attributes.get(name) ?? null,
      setAttribute: (name, value) => {
        calls.push(`attr "${value}"`)
        attributes.set(name, value)
      },
    },
    state: { mode: 'shown', locale: 'tr', compact: false, ...state },
    now: () => clock,
    setTimer: (fn, ms) => {
      const id = nextTimer++
      timers.set(id, { fn, at: clock + ms })
      return id
    },
    clearTimer: (id) => timers.delete(id as number),
  })
  overlay.attach(map)
  const advance = (ms: number) => {
    clock += ms
    for (const [id, timer] of [...timers]) {
      if (timer.at <= clock) {
        timers.delete(id)
        timer.fn()
      }
    }
  }
  return {
    overlay,
    calls,
    attribute: () => attributes.get(COUNTRY_LABELS_ATTRIBUTE) ?? null,
    layers,
    advance,
    timers,
    rendered,
  }
}

const install = (h: Harness) => {
  for (const id of COUNTRY_LABEL_LAYER_IDS) h.layers.add(id)
  h.overlay.installed()
}

describe('CountryLabelOverlay (D-095)', () => {
  it('harita kurulunca nitelik boş başlar', () => {
    const h = harness()
    expect(h.attribute()).toBe('')
    expect(h.calls).toEqual(['attr ""'])
  })

  it('katmanlar yokken (stil yükleniyor) ayar, boy ve dil değişimi ile zamanlayıcı haritaya dokunmaz', () => {
    const h = harness()
    h.calls.length = 0
    // Henüz `installed` yok.
    h.overlay.update({ mode: 'hidden', locale: 'en', compact: true })
    h.overlay.update({ mode: 'shown', locale: 'en', compact: true })
    h.overlay.rendered()
    h.advance(COUNTRY_LABELS_REFRESH_MS * 2)
    expect(h.calls).toEqual([])
    // Kuruldu, sonra stil değişiyor: katmanlar silinmiş (getLayer undefined).
    install(h)
    h.overlay.detached()
    h.layers.clear()
    h.calls.length = 0
    h.overlay.update({ mode: 'shown', locale: 'tr', compact: false })
    h.overlay.rendered()
    h.advance(COUNTRY_LABELS_REFRESH_MS * 2)
    expect(h.calls).toEqual([])
    // Yeni stil yüklendi ama katmanlar henüz eklenmedi: `installed` olsa da getLayer denetlenir.
    h.overlay.installed()
    h.advance(COUNTRY_LABELS_REFRESH_MS * 2)
    expect(h.calls).toEqual([])
    // Arada gelen durum saklandı: katmanlar onunla kurulur.
    expect(h.overlay.current).toEqual({ mode: 'shown', locale: 'tr', compact: false })
  })

  it('kurulunca yerleşen adları yazar; en fazla 500 ms’de bir sorgular, sondaki zamanlayıcı son durumu yazar', () => {
    const h = harness()
    h.rendered.push({ properties: { code: 'IR', name: 'İRAN' } })
    h.calls.length = 0
    install(h)
    expect(h.attribute()).toBe('İRAN')
    expect(h.calls).toEqual([`query ${COUNTRY_LABEL_LAYER_IDS.join(',')}`, 'attr "İRAN"'])
    h.calls.length = 0
    h.rendered.push({ properties: { code: 'IQ', name: 'IRAK' } })
    h.overlay.rendered()
    h.overlay.rendered()
    expect(h.calls).toEqual([])
    expect(h.timers.size).toBe(1)
    h.advance(COUNTRY_LABELS_REFRESH_MS)
    expect(h.attribute()).toBe('IRAK|İRAN')
    expect(h.calls.filter((c) => c.startsWith('query'))).toHaveLength(1)
    // Değişmeyen değer yeniden yazılmaz.
    h.calls.length = 0
    h.advance(COUNTRY_LABELS_REFRESH_MS)
    h.overlay.rendered()
    expect(h.calls).toEqual([`query ${COUNTRY_LABEL_LAYER_IDS.join(',')}`])
  })

  it('Gizle: 40 katman visibility none; nitelik sorgusuz boş; Göster geri getirir', () => {
    const h = harness()
    h.rendered.push({ properties: { code: 'IR', name: 'İRAN' } })
    install(h)
    h.advance(COUNTRY_LABELS_REFRESH_MS)
    h.calls.length = 0
    h.overlay.update({ mode: 'hidden', locale: 'tr', compact: false })
    expect(h.calls).toEqual([
      ...COUNTRY_LABEL_LAYER_IDS.map((id) => `${id} visibility "none"`),
      'attr ""',
    ])
    h.calls.length = 0
    h.overlay.rendered()
    h.advance(COUNTRY_LABELS_REFRESH_MS)
    expect(h.calls.filter((c) => c.startsWith('query'))).toEqual([])
    h.overlay.update({ mode: 'shown', locale: 'tr', compact: false })
    h.advance(COUNTRY_LABELS_REFRESH_MS)
    expect(h.calls).toContain(`${COUNTRY_LABEL_LAYER_IDS[0]} visibility "visible"`)
    expect(h.attribute()).toBe('İRAN')
  })

  it('dar harita: önce 40 katmanın boyu ve halesi küçülür, sonra kaynak; geri dönerken önce kaynak', () => {
    const h = harness()
    install(h)
    h.calls.length = 0
    h.overlay.update({ mode: 'shown', locale: 'tr', compact: true })
    const sizes = (compact: boolean) =>
      COUNTRY_LABEL_LAYER_KEYS.flatMap(([tier, fitZoom]) => {
        const id = countryLabelLayerId(tier, fitZoom)
        return [
          `${id} text-size ${JSON.stringify(countryLabelTextSize(tier, compact))}`,
          `${id} paint text-halo-width ${JSON.stringify(countryLabelHaloCurve(tier, compact, 'width'))}`,
          `${id} paint text-halo-blur ${JSON.stringify(countryLabelHaloCurve(tier, compact, 'blur'))}`,
        ]
      })
    expect(h.calls).toEqual([...sizes(true), 'setData 164'])
    expect(h.calls.filter((c) => c.includes('text-max-width'))).toEqual([])
    h.calls.length = 0
    h.overlay.update({ mode: 'shown', locale: 'tr', compact: false })
    expect(h.calls).toEqual(['setData 164', ...sizes(false)])
  })

  it('dil değişince yalnızca kaynak yenilenir (boy değişmez)', () => {
    const h = harness()
    install(h)
    h.calls.length = 0
    h.overlay.update({ mode: 'shown', locale: 'en', compact: false })
    expect(h.calls[0]).toBe('setData 164')
    expect(h.calls.filter((c) => c.includes('text-size') || c.includes('paint'))).toEqual([])
  })

  it('destroy bekleyen zamanlayıcıyı iptal eder', () => {
    const h = harness()
    install(h)
    h.overlay.rendered()
    expect(h.timers.size).toBe(1)
    h.overlay.destroy()
    expect(h.timers.size).toBe(0)
    h.calls.length = 0
    h.overlay.update({ mode: 'hidden', locale: 'tr', compact: false })
    expect(h.calls).toEqual([])
  })
})
