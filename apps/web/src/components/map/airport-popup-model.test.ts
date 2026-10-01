import { getMessages, NO_VALUE } from '@havayolu/i18n'
import { decodeMetar, type AirportMetar, type AirportWeather } from '@havayolu/shared'
import { describe, expect, it, vi } from 'vitest'
import type { MapAirport } from './airport-data'
import {
  airportFacts,
  airportPlace,
  escapeClosesPopup,
  formatClock,
  formatElevation,
  formatRunways,
  popupStatusText,
  popupWeatherView,
  returnFocusTarget,
  sunToday,
  type PopupWeatherReport,
} from './airport-popup-model'
import type { BulkWeatherState } from './use-airport-weather'

const tr = getMessages('tr')
const en = getMessages('en')

const IST: MapAirport = {
  icao: 'LTFM',
  iata: 'IST',
  name: 'Istanbul Airport',
  city: 'Istanbul',
  lat: 41.2753,
  lon: 28.7519,
  elevationFt: 325,
  type: 'large_airport',
  scheduled: true,
  isoRegion: 'TR-34',
  municipality: 'Arnavutköy',
  runways: [{ lengthFt: 12303 }, { lengthFt: 13451 }, { lengthFt: 12303 }],
}

/** 1 Ekim 2026 13:00 UTC = 16:00 İstanbul. */
const NOW = Date.parse('2026-10-01T13:00:00Z')
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

function metar(raw: string, observedAt: string): AirportMetar {
  return { ...decodeMetar(raw, { observedAt }), observedAt }
}

function state(stations: AirportWeather[], failed = false): BulkWeatherState {
  return {
    data: {
      generatedAt: new Date(NOW).toISOString(),
      stations: new Map(stations.map((station) => [station.icao, station])),
    },
    failed,
  }
}

const station = (icao: string, m: AirportMetar | null): AirportWeather => ({
  icao,
  generatedAt: new Date(NOW).toISOString(),
  metar: m,
  tafs: [],
})

function report(view: ReturnType<typeof popupWeatherView>): PopupWeatherReport {
  if (view.kind !== 'report') throw new Error(`expected a report, got ${view.kind}`)
  return view
}

const value = (view: PopupWeatherReport, key: string) =>
  view.rows.find((row) => row.key === key)?.value

describe('havalimanı bilgileri', () => {
  it('rakım metrik önce, ft ikinci', () => {
    expect(formatElevation(325, 'tr')).toBe('99 m (325 ft)')
    expect(formatElevation(3281, 'en')).toBe('1,000 m (3,281 ft)')
    expect(formatElevation(null, 'tr')).toBe(NO_VALUE)
  })

  it('pist özeti: sayı ve en uzun pist (m)', () => {
    expect(formatRunways(IST, 'tr', tr.map.airportPopup)).toBe('3 pist, en uzunu 4.100 m')
    expect(formatRunways(IST, 'en', en.map.airportPopup)).toBe('3 runways, longest 4,100 m')
    const one = { ...IST, runways: [{ lengthFt: 9843 }] }
    expect(formatRunways(one, 'tr', tr.map.airportPopup)).toBe('Tek pist, 3.000 m')
    const unknown = { ...IST, runways: [{ lengthFt: null }, { lengthFt: null }] }
    expect(formatRunways(unknown, 'tr', tr.map.airportPopup)).toBe('2')
    expect(formatRunways({ ...IST, runways: [] }, 'tr', tr.map.airportPopup)).toBe(NO_VALUE)
  })

  it('il adı; tanınmayan bölgede temiz yerleşim adı; o da yoksa null', () => {
    expect(airportPlace(IST, 'tr')).toBe('İstanbul')
    expect(airportPlace(IST, 'en')).toBe('Istanbul')
    expect(airportPlace({ ...IST, isoRegion: 'XX-1', municipality: 'Ercan' }, 'tr')).toBe('Ercan')
    expect(airportPlace({ ...IST, isoRegion: 'XX-1', municipality: null }, 'tr')).toBeNull()
  })

  it('saat havalimanının yerel saatiyle; saat yoksa "—"', () => {
    expect(formatClock(NOW)).toBe('16:00')
    expect(formatClock(0)).toBe(NO_VALUE)
    expect(formatClock(Number.NaN)).toBe(NO_VALUE)
  })

  it('gün doğumu ve batımı LTFM, 1 Ekim 2026: 07:01 ve 18:47 (±1 dk)', () => {
    const sun = sunToday(IST, NOW)
    const minutes = (ms: number | null) => {
      const [h, m] = formatClock(ms ?? Number.NaN)
        .split(':')
        .map(Number)
      return (h ?? 0) * 60 + (m ?? 0)
    }
    expect(Math.abs(minutes(sun.sunrise) - (7 * 60 + 1))).toBeLessThanOrEqual(1)
    expect(Math.abs(minutes(sun.sunset) - (18 * 60 + 47))).toBeLessThanOrEqual(1)
    expect(sunToday(IST, 0)).toEqual({ sunrise: null, sunset: null })
  })

  it('başlık, erişilebilir ad ve satırlar (TR ve EN)', () => {
    const facts = airportFacts(IST, NOW, sunToday(IST, NOW), 'tr', tr.map.airportPopup)
    expect(facts.name).toBe('İstanbul Havalimanı')
    expect(facts.label).toBe('İstanbul Havalimanı bilgileri')
    expect(facts.rows.map((row) => row.key)).toEqual([
      'elevation',
      'runways',
      'localTime',
      'sunrise',
      'sunset',
    ])
    expect(facts.rows.find((row) => row.key === 'localTime')?.value).toBe('16:00')
    const english = airportFacts(IST, NOW, sunToday(IST, NOW), 'en', en.map.airportPopup)
    expect(english.name).toBe('Istanbul Airport')
    expect(english.rows.map((row) => row.label)).toEqual([
      'Elevation',
      'Runways',
      'Local time',
      'Sunrise',
      'Sunset',
    ])
  })
})

describe('popupWeatherView', () => {
  const t = tr.map.airportPopup
  const w = tr.weather

  it('veri gelmeden yükleniyor; istek başarısızsa alınamıyor', () => {
    expect(popupWeatherView({ data: null, failed: false }, 'LTFM', NOW, 'tr', w, t)).toEqual({
      kind: 'loading',
      text: t.loading,
    })
    expect(popupWeatherView({ data: null, failed: true }, 'LTFM', NOW, 'tr', w, t)).toEqual({
      kind: 'unavailable',
      text: t.unavailable,
    })
  })

  it('istasyon yanıtta yoksa, raporu yoksa ya da 12 saatten eskiyse "Hava durumu raporu yok"', () => {
    const none = { kind: 'none', text: 'Hava durumu raporu yok' }
    expect(popupWeatherView(state([]), 'LTBQ', NOW, 'tr', w, t)).toEqual(none)
    expect(popupWeatherView(state([station('LTBQ', null)]), 'LTBQ', NOW, 'tr', w, t)).toEqual(none)
    const old = metar('LTCW 010050Z 36004KT 9999 FEW050 M05/M09 Q1024', minutesAgo(13 * 60))
    expect(popupWeatherView(state([station('LTCW', old)]), 'LTCW', NOW, 'tr', w, t)).toEqual(none)
  })

  it('yağmur, kar, gök gürültüsü ve sis her zaman yazılır; hamle ve kuvvetli rüzgâr', () => {
    const m = metar(
      'LTFM 011250Z 03018G32KT 9999 -SHRA FEW025CB BKN035 09/05 Q1009 TEMPO 4000 SHRA',
      minutesAgo(10),
    )
    const view = report(popupWeatherView(state([station('LTFM', m)]), 'LTFM', NOW, 'tr', w, t))
    expect(view.ageClass).toBe('fresh')
    expect(view.note).toBeNull()
    expect(view.headline).toBe('Hafif sağanak yağmur · 9 °C')
    expect(view.rows.map((row) => row.key)).toEqual([
      'wind',
      'rain',
      'snow',
      'thunder',
      'fog',
      'visibility',
    ])
    expect(value(view, 'wind')).toBe('Kuzeydoğudan 33 km/sa · hamle 59 km/sa')
    expect(view.rows[0]?.strong).toBe('Kuvvetli rüzgâr')
    expect(value(view, 'rain')).toBe('Hafif sağanak yağmur')
    expect(value(view, 'snow')).toBe('Yok')
    expect(value(view, 'thunder')).toBe('Yok (kümülonimbüs bulutu var)')
    expect(value(view, 'fog')).toBe('Yok')
    expect(value(view, 'visibility')).toBe('10 km ve üzeri')
    expect(view.observed).toBe('Gözlem 15:50 · 10 dakika önce')
  })

  it('kar, sis ve dolu satırları; sakin rüzgârda kuvvetli işareti yok (EN)', () => {
    const snow = metar(
      'LTAC 011250Z 32012KT 1500 SN BR BKN008 OVC015 M01/M02 Q1018',
      minutesAgo(20),
    )
    const fog = metar('LTCG 011250Z 00000KT 0200 R11/0350N FG VV001 08/08 Q1015', minutesAgo(20))
    const hail = metar(
      'SPECI LTBS 011242Z 25015G27KT 2000 +TSRAGR SCT012CB BKN025 12/10 Q1007',
      minutesAgo(20),
    )
    const data = state([station('LTAC', snow), station('LTCG', fog), station('LTBS', hail)])
    const s = report(popupWeatherView(data, 'LTAC', NOW, 'en', en.weather, en.map.airportPopup))
    expect(value(s, 'snow')).toBe('Snow')
    expect(value(s, 'fog')).toBe('Mist')
    expect(s.headline).toBe('Snow · −1 °C')
    const f = report(popupWeatherView(data, 'LTCG', NOW, 'tr', w, t))
    expect(value(f, 'fog')).toBe('Sis')
    expect(value(f, 'wind')).toBe('Sakin')
    expect(f.rows[0]?.strong).toBeNull()
    expect(value(f, 'visibility')).toBe('200 m')
    const h = report(popupWeatherView(data, 'LTBS', NOW, 'tr', w, t))
    // Sözcük seçimi havalimanı sayfasıyla ortaktır (summarizeMetar); "fırtına" denmez.
    expect(value(h, 'thunder')).toMatch(/^Dolulu, .*gök gürültülü sağanak$/)
    expect(value(h, 'thunder')).not.toMatch(/fırtına/i)
    expect(h.rows.some((row) => row.key === 'hail')).toBe(true)
  })

  it('90 dakika–3 saat: gecikmiş gözlem notu, değerler gösterilir', () => {
    const m = metar('LTAJ 011120Z 09005KT 9999 SCT030 11/02 Q1016 NOSIG', minutesAgo(130))
    const view = report(popupWeatherView(state([station('LTAJ', m)]), 'LTAJ', NOW, 'tr', w, t))
    expect(view.ageClass).toBe('delayed')
    expect(view.note).toContain('Gecikmiş gözlem')
    expect(view.rows.length).toBeGreaterThan(0)
    expect(view.observed).toBe('Son gözlem 13:50 · 2 saat 10 dakika önce')
  })

  it('3–12 saat: eski gözlemin değerleri güncel gibi gösterilmez', () => {
    const m = metar('LTCW 010450Z 36004KT 9999 FEW050 M05/M09 Q1024', minutesAgo(8 * 60 + 10))
    const view = report(popupWeatherView(state([station('LTCW', m)]), 'LTCW', NOW, 'tr', w, t))
    expect(view.ageClass).toBe('stale')
    expect(view.headline).toBeNull()
    expect(view.rows).toEqual([])
    expect(view.note).toBe(w.age.stale)
    expect(view.observed).toBe('Son gözlem 07:50 · 8 saat önce')
  })

  it('son istek başarısız olsa da eldeki veri gösterilir', () => {
    const m = metar('LTBA 011250Z 04008KT CAVOK 10/03 Q1010 NOSIG', minutesAgo(5))
    const view = report(
      popupWeatherView(state([station('LTBA', m)], true), 'LTBA', NOW, 'tr', w, t),
    )
    expect(value(view, 'visibility')).toBe('10 km ve üzeri')
  })

  it('metin kurulamazsa harita düşmez: "alınamıyor"', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const m = metar('LTBA 011250Z 04008KT CAVOK 10/03 Q1010 NOSIG', minutesAgo(5))
    const broken = { ...m, weather: null } as unknown as AirportMetar
    expect(popupWeatherView(state([station('LTBA', broken)]), 'LTBA', NOW, 'tr', w, t)).toEqual({
      kind: 'unavailable',
      text: t.unavailable,
    })
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })
})

describe('Escape ve ekran okuyucu bildirimi', () => {
  const escape = { key: 'Escape', defaultPrevented: false }

  it('Escape yalnızca odak pencerede, haritada ya da hiçbir yerdeyken kapatır', () => {
    expect(escapeClosesPopup(escape, 'popup')).toBe(true)
    expect(escapeClosesPopup(escape, 'map')).toBe(true)
    expect(escapeClosesPopup(escape, 'page')).toBe(true)
    // Arama kutusu, etiket ayarları ya da havalimanı listesinde odak: o denetimin Escape'i.
    expect(escapeClosesPopup(escape, 'other')).toBe(false)
  })

  it('kapanışta odak pencereyi açan denetime döner; açan öğe kalktıysa önceki öğe kalır, body değil', () => {
    const map = { name: 'harita tuvali' }
    const listButton = { name: 'Havalimanları düğmesi' }
    const body = { name: 'body' }
    // Haritadan açılış: tuval saklanır.
    expect(returnFocusTarget(null, map, 'map')).toBe(map)
    // Listeden açılış: odak açan düğmede (liste öğesi DOM'dan kalkmadan önce oraya alınır).
    expect(returnFocusTarget(null, listButton, 'other')).toBe(listButton)
    // Haritadan açıkken listeden başka havalimanı: yeni açan denetim saklanır.
    expect(returnFocusTarget(map, listButton, 'other')).toBe(listButton)
    // Odak sayfaya düşmüşse (açan öğe DOM'dan kalktı) body saklanmaz: önceki öğe ya da hiç
    // (kapanışta harita tuvali).
    expect(returnFocusTarget(null, body, 'page')).toBeNull()
    expect(returnFocusTarget(map, body, 'page')).toBe(map)
    // Odak pencerenin içindeyse önceki öğe kalır.
    expect(returnFocusTarget(listButton, { name: 'Kapat' }, 'popup')).toBe(listButton)
  })

  it('başka bir katmanın tükettiği Escape ve başka tuşlar kapatmaz', () => {
    expect(escapeClosesPopup({ key: 'Escape', defaultPrevented: true }, 'popup')).toBe(false)
    expect(escapeClosesPopup({ key: 'Enter', defaultPrevented: false }, 'popup')).toBe(false)
  })

  it('bildirim: yükleniyor, alınamıyor, rapor yok ya da raporun başlığı', () => {
    const t = tr.map.airportPopup
    const w = tr.weather
    const loading = popupWeatherView({ data: null, failed: false }, 'LTFM', NOW, 'tr', w, t)
    expect(popupStatusText(loading)).toBe(t.loading)
    const failed = popupWeatherView({ data: null, failed: true }, 'LTFM', NOW, 'tr', w, t)
    expect(popupStatusText(failed)).toBe(t.unavailable)
    const none = popupWeatherView(state([station('LTFM', null)]), 'LTFM', NOW, 'tr', w, t)
    expect(popupStatusText(none)).toBe(t.noReport)
    const loaded = popupWeatherView(
      state([
        station(
          'LTFM',
          metar('LTFM 011250Z 03018G32KT 9999 -SHRA FEW025CB 09/05 Q1009', minutesAgo(10)),
        ),
      ]),
      'LTFM',
      NOW,
      'tr',
      w,
      t,
    )
    expect(popupStatusText(loaded)).toBe('Hafif sağanak yağmur · 9 °C')
  })
})
