import { readFileSync } from 'node:fs'
import {
  decodeMetar,
  decodeTaf,
  FLIGHT_CATEGORIES,
  type AirportMetar,
  type AirportTaf,
  type AirportWeather,
  type FlightCategory,
  type WeatherHistoryEntry,
  type WeatherHistoryResponse,
} from '@havayolu/shared'

/**
 * Commit'li, elle yazılmış hava durumu fixture'ından (`tools/fixtures/weather/`, sentetik; canlı
 * istek yok) API'nin döndüreceği güncel hava ve 24 saatlik kayıt yanıtları. API raporları okurken
 * çözer; burada aynı çözücü aynı ham metne uygulanır. Zaman kaydırma yoktur: `FIXTURE_NOW`.
 */
const FIXTURE_DIR = new URL('../../../../../tools/fixtures/weather/', import.meta.url)

/** Fixture'ların "şimdi"si (index.json → fixtureNow). */
export const FIXTURE_NOW = Date.parse('2026-01-15T13:00:00Z')

interface AwcMetar {
  icaoId: string
  obsTime: number
  rawOb: string
  metarType?: string | null
  fltCat?: string | null
}

interface AwcTaf {
  icaoId: string
  issueTime: string
  validTimeFrom: number
  validTimeTo: number
  rawTAF: string
}

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(name, FIXTURE_DIR), 'utf8')) as T

const METARS = read<AwcMetar[]>('metar.json')
const TAFS = read<AwcTaf[]>('taf.json')

const iso = (ms: number) => new Date(ms).toISOString()
/** AWC'nin "2026-01-15 10:40:00.000Z" biçimi. */
const awcTime = (value: string) => iso(Date.parse(value.replace(' ', 'T')))

function flightCategory(value: string | null | undefined): FlightCategory | null {
  return (FLIGHT_CATEGORIES as readonly string[]).includes(value ?? '')
    ? (value as FlightCategory)
    : null
}

export function metarFromRaw(
  raw: string,
  observedAt: string,
  category: FlightCategory | null = null,
  reportType: 'METAR' | 'SPECI' | null = null,
): AirportMetar {
  const decoded = decodeMetar(raw, { observedAt })
  // API türü kayıttan alır (AWC `metarType`; ham metinde SPECI öneki olmayabilir).
  return { ...decoded, type: reportType ?? decoded.type, observedAt, flightCategory: category }
}

export function tafFromRaw(
  raw: string,
  issuedAt: string,
  validFrom: string,
  validTo: string,
): AirportTaf {
  return { ...decodeTaf(raw, { issuedAt, validFrom, validTo }), issuedAt, validFrom, validTo }
}

function toMetar(item: AwcMetar): AirportMetar {
  return metarFromRaw(
    item.rawOb,
    iso(item.obsTime * 1000),
    flightCategory(item.fltCat),
    item.metarType === 'SPECI' ? 'SPECI' : null,
  )
}

function toTaf(item: AwcTaf): AirportTaf {
  return tafFromRaw(
    item.rawTAF,
    awcTime(item.issueTime),
    iso(item.validTimeFrom * 1000),
    iso(item.validTimeTo * 1000),
  )
}

/** `GET /v1/airports/:code/weather` yanıtı: en yeni METAR ve süresi dolmamış TAF'lar. */
export function fixtureWeather(icao: string, now = FIXTURE_NOW): AirportWeather {
  const latest = METARS.filter((m) => m.icaoId === icao && m.obsTime * 1000 <= now).toSorted(
    (a, b) => b.obsTime - a.obsTime,
  )[0]
  const tafs = TAFS.filter((t) => t.icaoId === icao && t.validTimeTo * 1000 > now)
    .map(toTaf)
    .toSorted((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
  return { icao, generatedAt: iso(now), metar: latest ? toMetar(latest) : null, tafs }
}

/** `GET /v1/airports/:code/weather/history?hours=24` yanıtı, en yeni önce. */
export function fixtureHistory(
  icao: string,
  now = FIXTURE_NOW,
  hours = 24,
): WeatherHistoryResponse {
  const from = now - hours * 3_600_000
  const metars: WeatherHistoryEntry[] = METARS.filter(
    (m) => m.icaoId === icao && m.obsTime * 1000 >= from && m.obsTime * 1000 <= now,
  ).map((m) => {
    const metar = toMetar(m)
    return { kind: metar.type, time: metar.observedAt, raw: metar.raw, metar }
  })
  const tafs: WeatherHistoryEntry[] = TAFS.filter((t) => {
    const issued = Date.parse(awcTime(t.issueTime))
    return t.icaoId === icao && issued >= from && issued <= now
  }).map((t) => {
    const taf = toTaf(t)
    return {
      kind: 'TAF',
      time: taf.issuedAt,
      raw: taf.raw,
      taf: {
        validFrom: taf.validFrom,
        validTo: taf.validTo,
        amended: taf.amended,
        corrected: taf.corrected,
        cancelled: taf.cancelled,
      },
    }
  })
  return {
    icao,
    from: iso(from),
    to: iso(now),
    generatedAt: iso(now),
    entries: [...metars, ...tafs].toSorted((a, b) => Date.parse(b.time) - Date.parse(a.time)),
  }
}
