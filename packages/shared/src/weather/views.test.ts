import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { decodeMetar } from './metar'
import {
  AirportMetarSchema,
  AirportTafSchema,
  RawAirportWeatherSchema,
  type AirportTaf,
  type RawAirportWeather,
} from './schema'
import { inForceTafs } from './summary'
import { decodeTaf } from './taf'
import {
  toAirportMetar,
  toAirportTaf,
  toAirportWeather,
  toRawMetar,
  toRawTaf,
  weatherFlightCategory,
  type MetarRecordInput,
  type TafRecordInput,
} from './views'

// Elle yazılmış, sentetik fixture (tools/fixtures/weather; canlı istek yok).
const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(new URL(`../../../../tools/fixtures/weather/${name}`, import.meta.url), 'utf8'),
  ) as T

interface AwcMetar {
  icaoId: string
  obsTime: number
  rawOb: string
  metarType?: string | null
  fltCat?: string | null
}
interface AwcTaf {
  icaoId: string
  issueTime: string | number
  validTimeFrom: number
  validTimeTo: number
  rawTAF: string
}

const awcTime = (value: string | number) =>
  new Date(typeof value === 'number' ? value * 1000 : Date.parse(value.replace(' ', 'T')))

/** Veritabanı satırı biçiminde (Date) fixture raporları. */
const METARS: (MetarRecordInput & { station: string; observedAt: Date })[] = fixture<AwcMetar[]>(
  'metar.json',
).map((m) => ({
  station: m.icaoId,
  raw: m.rawOb,
  type: m.metarType === 'SPECI' ? 'SPECI' : 'METAR',
  observedAt: awcTime(m.obsTime),
  flightCategory: m.fltCat ?? null,
}))
const TAFS: (TafRecordInput & {
  station: string
  issuedAt: Date
  validFrom: Date
  validTo: Date
})[] = fixture<AwcTaf[]>('taf.json').map((t) => ({
  station: t.icaoId,
  raw: t.rawTAF,
  issuedAt: awcTime(t.issueTime),
  validFrom: awcTime(t.validTimeFrom),
  validTo: awcTime(t.validTimeTo),
}))
const NOW = '2026-01-15T13:00:00.000Z'

/** M6c'den beri API'nin `makeDecoders` içinde yaptığı (görünümler paylaşıma taşınmadan önce). */
function legacyMetarView(row: (typeof METARS)[number]) {
  return AirportMetarSchema.parse({
    ...decodeMetar(row.raw, { observedAt: row.observedAt }),
    type: row.type,
    observedAt: row.observedAt.toISOString(),
    raw: row.raw,
    flightCategory: weatherFlightCategory(row.flightCategory),
  })
}
function legacyTafView(row: (typeof TAFS)[number]) {
  return AirportTafSchema.parse({
    ...decodeTaf(row.raw, {
      issuedAt: row.issuedAt,
      validFrom: row.validFrom,
      validTo: row.validTo,
    }),
    issuedAt: row.issuedAt.toISOString(),
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo.toISOString(),
    raw: row.raw,
  })
}

describe('görünümler (D-101)', () => {
  it("fixture'daki her METAR ve TAF: API'nin önceki çözümüyle aynı, Date ya da ISO metniyle", () => {
    expect(METARS.length).toBeGreaterThan(100)
    expect(TAFS.length).toBeGreaterThan(20)
    for (const row of METARS) {
      const expected = legacyMetarView(row)
      expect(toAirportMetar(row), row.raw).toEqual(expected)
      expect(toAirportMetar({ ...row, observedAt: row.observedAt.toISOString() })).toEqual(expected)
      expect(JSON.stringify(toAirportMetar(row))).toBe(JSON.stringify(expected))
    }
    for (const row of TAFS) {
      const expected = legacyTafView(row)
      expect(toAirportTaf(row), row.raw).toEqual(expected)
      const raw = toRawTaf(row)
      expect(raw).not.toBeNull()
      if (raw) expect(toAirportTaf(raw)).toEqual(expected)
    }
  })

  it('bozuk kayıt: onError çağrılır, null döner (atmaz)', () => {
    const onError = vi.fn()
    const [metar] = METARS
    const [taf] = TAFS
    if (!metar || !taf) throw new Error('fixture boş')
    expect(toAirportMetar({ ...metar, observedAt: new Date(Number.NaN) }, onError)).toBeNull()
    expect(toAirportMetar({ ...metar, observedAt: 'dün' }, onError)).toBeNull()
    expect(toAirportTaf({ ...taf, validFrom: new Date(Number.NaN) }, onError)).toBeNull()
    expect(onError).toHaveBeenCalledTimes(3)
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(RangeError)
    // onError verilmezse de null.
    expect(toAirportTaf({ ...taf, issuedAt: 'dün' })).toBeNull()
  })

  it('uçuş kategorisi: yalnız VFR, MVFR, IFR, LIFR', () => {
    expect(
      ['VFR', 'MVFR', 'IFR', 'LIFR', 'UNKN', '', null, undefined].map(weatherFlightCategory),
    ).toEqual(['VFR', 'MVFR', 'IFR', 'LIFR', null, null, null, null])
  })

  it('ham kayıtlar çözümlenmez; zamanı geçersiz kayıt null', () => {
    const [metar] = METARS
    const [taf] = TAFS
    if (!metar || !taf) throw new Error('fixture boş')
    expect(toRawMetar({ ...metar, flightCategory: 'UNKN' })).toEqual({
      raw: metar.raw,
      type: metar.type,
      observedAt: metar.observedAt.toISOString(),
      flightCategory: null,
    })
    expect(toRawMetar({ ...metar, observedAt: new Date(Number.NaN) })).toBeNull()
    expect(toRawTaf(taf)).toEqual({
      raw: taf.raw,
      issuedAt: taf.issuedAt.toISOString(),
      validFrom: taf.validFrom.toISOString(),
      validTo: taf.validTo.toISOString(),
    })
    expect(toRawTaf({ ...taf, validTo: new Date(Number.NaN) })).toBeNull()
  })
})

describe('toAirportWeather: ham biçimden tam biçim', () => {
  const rawStation = (icao: string): RawAirportWeather => {
    const metar = METARS.filter(
      (m) => m.station === icao && m.observedAt.toISOString() <= NOW,
    ).sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())[0]
    const tafs = TAFS.filter((t) => t.station === icao)
      .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())
      .map(toRawTaf)
      .filter((t) => t !== null)
    return RawAirportWeatherSchema.parse({
      icao,
      metar: metar === undefined ? null : toRawMetar(metar),
      tafs,
    })
  }

  it("süresi dolan TAF düşer, yürürlükteki TAF'lar kalır (sıra korunur); METAR çözümlenir", () => {
    const stations = [...new Set(METARS.map((m) => m.station))]
    let withOldTafs = 0
    for (const icao of stations) {
      const station = rawStation(icao)
      const weather = toAirportWeather(station, NOW)
      expect(weather.icao).toBe(icao)
      expect(weather.generatedAt).toBe(NOW)
      expect(weather.metar).toEqual(station.metar === null ? null : toAirportMetar(station.metar))
      const live = station.tafs
        .filter((t) => Date.parse(t.validTo) > Date.parse(NOW))
        .map((t) => toAirportTaf(t))
        .filter((t): t is AirportTaf => t !== null)
      expect(weather.tafs).toEqual(inForceTafs(live, NOW))
      if (weather.tafs.length < station.tafs.length) withOldTafs += 1
    }
    // Fixture'da süresi dolmuş ya da yerini yenisine bırakmış TAF'ı olan istasyonlar var.
    expect(withOldTafs).toBeGreaterThan(0)
  })

  it('raporsuz istasyon; bozuk rapor onError ile atlanır', () => {
    expect(toAirportWeather({ icao: 'LTCW', metar: null, tafs: [] }, NOW)).toEqual({
      icao: 'LTCW',
      generatedAt: NOW,
      metar: null,
      tafs: [],
    })
    const onError = vi.fn()
    const station = rawStation('LTFM')
    const live = station.tafs.findIndex((t) => Date.parse(t.validTo) > Date.parse(NOW))
    expect(live).toBeGreaterThanOrEqual(0)
    const broken = {
      ...station,
      metar: station.metar && { ...station.metar, observedAt: 'dün' },
      tafs: station.tafs.map((t, i) => (i === live ? { ...t, validFrom: 'dün' } : t)),
    }
    const weather = toAirportWeather(broken, NOW, onError)
    expect(weather.metar).toBeNull()
    expect(weather.tafs.map((t) => t.raw)).not.toContain(station.tafs[live]?.raw)
    expect(onError).toHaveBeenCalledTimes(2)
  })
})
