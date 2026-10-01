import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseAwcTime, parseMetarResponse, parseTafResponse } from '@havayolu/providers'
import type { WeatherSource } from './weather'

/**
 * Hava durumu fixture'ları (tools/fixtures/weather; elle yazılmış, sentetik, D-078). Yalnızca
 * `EXTERNAL_PROVIDERS_DISABLED=true` iken ve `APP_ENV` development ya da test iken okunur; üretim
 * imajında dosyalar yoktur.
 *
 * Simülasyon: bütün zamanlar tam saat kaydırılır, `fixtureNow` içinde bulunulan UTC saatinin
 * başına denk gelir. Epoch alanları ve ham metindeki zaman grupları birlikte kaydırılır
 * (METAR `DDHHMMZ` ve eğilimdeki `FM/TL/ATHHMM`; TAF `DDHHMMZ`, `DDHH/DDHH`, `FMDDHHMM`,
 * `TX/TN../DDHHZ`), ay geçişleri dahil. Dakikalar korunur: güncel raporlar 10–70 dk eski kalır.
 */

export const WEATHER_FIXTURE_DIR = 'weather'
const FIXTURE_FILES = { index: 'index.json', metar: 'metar.json', taf: 'taf.json' } as const
const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

/** Fixture yalnızca bu ortamlarda kullanılabilir (CLAUDE.md: simülasyon yalnızca dev/test). */
export const FIXTURE_APP_ENVS = ['development', 'test'] as const

export class WeatherFixtureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WeatherFixtureError'
  }
}

export interface WeatherFixtures {
  fixtureNow: Date
  metars: unknown[]
  tafs: unknown[]
}

/** `tools/fixtures/weather` klasörü varsa yolu; yoksa null. */
export function weatherFixturesDir(fixturesDir: string | null): string | null {
  if (!fixturesDir) return null
  const dir = join(fixturesDir, WEATHER_FIXTURE_DIR)
  return Object.values(FIXTURE_FILES).every((file) => existsSync(join(dir, file))) ? dir : null
}

export function loadWeatherFixtures(dir: string): WeatherFixtures {
  const read = (file: string): unknown => JSON.parse(readFileSync(join(dir, file), 'utf8'))
  const index = read(FIXTURE_FILES.index) as { fixtureNow?: unknown }
  const fixtureNow =
    typeof index.fixtureNow === 'string' ? new Date(Date.parse(index.fixtureNow)) : null
  if (!fixtureNow || Number.isNaN(fixtureNow.getTime()) || fixtureNow.getTime() % HOUR_MS !== 0) {
    throw new WeatherFixtureError('index.json: fixtureNow tam saat bir ISO zamanı olmalı')
  }
  const metars = read(FIXTURE_FILES.metar)
  const tafs = read(FIXTURE_FILES.taf)
  if (!Array.isArray(metars) || !Array.isArray(tafs)) {
    throw new WeatherFixtureError('metar.json ve taf.json dizi olmalı')
  }
  return { fixtureNow, metars, tafs }
}

/** `fixtureNow`'ı içinde bulunulan UTC saatinin başına taşıyan kaydırma (tam saat, ms). */
export function fixtureShiftMs(fixtureNow: Date, now: Date): number {
  return Math.floor(now.getTime() / HOUR_MS) * HOUR_MS - fixtureNow.getTime()
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Gün ve saat grubunu (`DD`, `HH`, `MM`) `anchor`'a en yakın tarihe çözer: aynı, önceki ya da
 * sonraki ay. `HH = 24` günün sonudur. Gün o ayda yoksa (ör. 31 Şubat) o aday atlanır.
 */
export function resolveDayTime(
  day: number,
  hour: number,
  minute: number,
  anchor: Date,
): Date | null {
  if (day < 1 || day > 31 || hour > 24 || minute > 59) return null
  let best: Date | null = null
  for (const offset of [-1, 0, 1]) {
    const year = anchor.getUTCFullYear()
    const month = anchor.getUTCMonth() + offset
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    if (day > daysInMonth) continue
    const candidate = new Date(Date.UTC(year, month, day, hour, minute))
    if (
      !best ||
      Math.abs(candidate.getTime() - anchor.getTime()) < Math.abs(best.getTime() - anchor.getTime())
    ) {
      best = candidate
    }
  }
  return best
}

/** Kaydırılmış `DDHH`; asıl saat 24 ise ve sonuç gece yarısına düşüyorsa yine `..24` yazılır. */
function formatDayHour(date: Date, endOfDay: boolean): string {
  if (endOfDay && date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
    const previous = new Date(date.getTime() - DAY_MS)
    return `${pad(previous.getUTCDate())}24`
  }
  return `${pad(date.getUTCDate())}${pad(date.getUTCHours())}`
}

/** `DDHH` grubunu kaydırır; çözülemezse olduğu gibi bırakır. */
function shiftDayHour(group: string, anchor: Date, shiftMs: number): string {
  const day = Number(group.slice(0, 2))
  const hour = Number(group.slice(2, 4))
  const resolved = resolveDayTime(day, hour, 0, anchor)
  if (!resolved) return group
  return formatDayHour(new Date(resolved.getTime() + shiftMs), hour === 24)
}

/** `DDHHMM` grubunu kaydırır; çözülemezse olduğu gibi bırakır. */
function shiftDayHourMinute(group: string, anchor: Date, shiftMs: number): string {
  const resolved = resolveDayTime(
    Number(group.slice(0, 2)),
    Number(group.slice(2, 4)),
    Number(group.slice(4, 6)),
    anchor,
  )
  if (!resolved) return group
  const shifted = new Date(resolved.getTime() + shiftMs)
  return `${pad(shifted.getUTCDate())}${pad(shifted.getUTCHours())}${pad(shifted.getUTCMinutes())}`
}

/** METAR eğilimindeki `HHMM` (gün yok): saat 24'e göre döner. */
function shiftHourMinute(group: string, shiftMs: number): string {
  const hours = Math.round(shiftMs / HOUR_MS)
  const hour = (((Number(group.slice(0, 2)) + hours) % 24) + 24) % 24
  return `${pad(hour)}${group.slice(2, 4)}`
}

/** METAR/SPECI ham metnindeki zamanları kaydırır (`RMK`'dan sonrasına dokunmaz). */
export function rebaseMetarRaw(raw: string, anchor: Date, shiftMs: number): string {
  let remarks = false
  let timeDone = false
  return raw
    .split(' ')
    .map((word) => {
      if (remarks || word === 'RMK') {
        remarks = true
        return word
      }
      const time = /^(\d{6})Z$/.exec(word)
      if (time?.[1] && !timeDone) {
        timeDone = true
        return `${shiftDayHourMinute(time[1], anchor, shiftMs)}Z`
      }
      const trend = /^(FM|TL|AT)(\d{4})$/.exec(word)
      if (trend?.[1] && trend[2]) return `${trend[1]}${shiftHourMinute(trend[2], shiftMs)}`
      return word
    })
    .join(' ')
}

/** TAF ham metnindeki zamanları kaydırır; `anchor` geçerlilik başlangıcıdır. */
export function rebaseTafRaw(raw: string, anchor: Date, shiftMs: number): string {
  return raw
    .split(' ')
    .map((word) => {
      let m = /^(\d{6})Z$/.exec(word)
      if (m?.[1]) return `${shiftDayHourMinute(m[1], anchor, shiftMs)}Z`
      m = /^(\d{4})\/(\d{4})$/.exec(word)
      if (m?.[1] && m[2]) {
        return `${shiftDayHour(m[1], anchor, shiftMs)}/${shiftDayHour(m[2], anchor, shiftMs)}`
      }
      m = /^FM(\d{6})$/.exec(word)
      if (m?.[1]) return `FM${shiftDayHourMinute(m[1], anchor, shiftMs)}`
      const extreme = /^(TX|TN)(M?\d{2})\/(\d{4})Z$/.exec(word)
      if (extreme?.[1] && extreme[2] && extreme[3]) {
        return `${extreme[1]}${extreme[2]}/${shiftDayHour(extreme[3], anchor, shiftMs)}Z`
      }
      return word
    })
    .join(' ')
}

type Entry = Record<string, unknown>
const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Epoch saniye alanı. */
function shiftEpoch(value: unknown, shiftMs: number): unknown {
  return typeof value === 'number' && Number.isFinite(value) ? value + shiftMs / 1000 : value
}

/** AWC zaman metni; aynı biçimde (`YYYY-MM-DD hh:mm:ss.sssZ`) yazılır. */
function shiftAwcTime(value: unknown, shiftMs: number): unknown {
  if (typeof value !== 'string') return value
  const parsed = parseAwcTime(value)
  if (!parsed) return value
  return new Date(parsed.getTime() + shiftMs).toISOString().replace('T', ' ')
}

export function rebaseMetarEntry(entry: unknown, shiftMs: number): unknown {
  if (!isEntry(entry)) return entry
  const anchor = typeof entry.obsTime === 'number' ? new Date(entry.obsTime * 1000) : null
  return {
    ...entry,
    obsTime: shiftEpoch(entry.obsTime, shiftMs),
    reportTime: shiftAwcTime(entry.reportTime, shiftMs),
    receiptTime: shiftAwcTime(entry.receiptTime, shiftMs),
    rawOb:
      typeof entry.rawOb === 'string' && anchor
        ? rebaseMetarRaw(entry.rawOb, anchor, shiftMs)
        : entry.rawOb,
  }
}

export function rebaseTafEntry(entry: unknown, shiftMs: number): unknown {
  if (!isEntry(entry)) return entry
  const anchor =
    typeof entry.validTimeFrom === 'number' ? new Date(entry.validTimeFrom * 1000) : null
  const fcsts = Array.isArray(entry.fcsts)
    ? entry.fcsts.map((f: unknown) =>
        isEntry(f)
          ? {
              ...f,
              timeFrom: shiftEpoch(f.timeFrom, shiftMs),
              timeTo: shiftEpoch(f.timeTo, shiftMs),
              timeBec: shiftEpoch(f.timeBec, shiftMs),
            }
          : f,
      )
    : entry.fcsts
  return {
    ...entry,
    issueTime: shiftAwcTime(entry.issueTime, shiftMs),
    bulletinTime: shiftAwcTime(entry.bulletinTime, shiftMs),
    dbPopTime: shiftAwcTime(entry.dbPopTime, shiftMs),
    validTimeFrom: shiftEpoch(entry.validTimeFrom, shiftMs),
    validTimeTo: shiftEpoch(entry.validTimeTo, shiftMs),
    rawTAF:
      typeof entry.rawTAF === 'string' && anchor
        ? rebaseTafRaw(entry.rawTAF, anchor, shiftMs)
        : entry.rawTAF,
    fcsts,
  }
}

/** Kaydırılmış fixture'lar (`now` içinde bulunulan saate göre). */
export function rebaseWeatherFixtures(fixtures: WeatherFixtures, now: Date): WeatherFixtures {
  const shiftMs = fixtureShiftMs(fixtures.fixtureNow, now)
  return {
    fixtureNow: new Date(fixtures.fixtureNow.getTime() + shiftMs),
    metars: fixtures.metars.map((entry) => rebaseMetarEntry(entry, shiftMs)),
    tafs: fixtures.tafs.map((entry) => rebaseTafEntry(entry, shiftMs)),
  }
}

/**
 * Fixture'dan beslenen kaynak: AWC yanıtı gibi istenen istasyonların kayıtlarını verir ve aynı
 * ayrıştırıcıdan geçirir. METAR'da `hours` penceresi uygulanmaz: LTFM'nin 3 günlük geçmişi ilk
 * çalışmada yazılır (geçmiş listesi boş kalmasın). Dosyalar her çağrıda okunur.
 */
export function fixtureWeatherSource(options: {
  dir: string
  appEnv: string
  now?: () => Date
}): WeatherSource {
  if (!(FIXTURE_APP_ENVS as readonly string[]).includes(options.appEnv)) {
    throw new WeatherFixtureError(
      `hava durumu fixture'ları yalnızca APP_ENV development ya da test iken kullanılır (${options.appEnv})`,
    )
  }
  const clock = options.now ?? (() => new Date())
  const load = (ids: readonly string[]) => {
    const now = clock()
    const fixtures = rebaseWeatherFixtures(loadWeatherFixtures(options.dir), now)
    const stations = new Set(ids.map((id) => id.trim().toUpperCase()))
    const wanted = (entry: unknown) =>
      isEntry(entry) && typeof entry.icaoId === 'string' && stations.has(entry.icaoId)
    return { fixtures, stations, wanted, now: now.getTime() }
  }
  return {
    async metars(ids) {
      const { fixtures, stations, wanted, now } = load(ids)
      const entries = fixtures.metars.filter(wanted)
      return {
        status: entries.length > 0 ? 200 : 204,
        ...parseMetarResponse(entries, { stations, now }),
      }
    },
    async tafs(ids) {
      const { fixtures, stations, wanted, now } = load(ids)
      const entries = fixtures.tafs.filter(wanted)
      return {
        status: entries.length > 0 ? 200 : 204,
        ...parseTafResponse(entries, { stations, now }),
      }
    },
  }
}
