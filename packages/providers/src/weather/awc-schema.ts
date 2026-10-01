import { z } from 'zod'

/**
 * aviationweather.gov Data API JSON yanıtlarının (data-sources.md §5) toleranslı ayrıştırılması.
 * - Her alan opsiyoneldir; tipi uymayan alan yok sayılır (`.catch(undefined)`), bilinmeyen anahtar
 *   atılır. Kaydın kullanılabilir olup olmadığına aşağıdaki doğrulama karar verir.
 * - Asıl veri ham metindir (`rawOb`, `rawTAF`); kod çözme `@havayolu/shared` weather modülündedir.
 *   Bu modül yalnızca kimliği, zamanları ve ham metni alır. AWC'nin çözülmüş alanları (`visib`,
 *   `clouds`, `temp` …) kayıplıdır (ör. `9999` → `"6+"` mil) ve yalnızca testte çapraz denetim
 *   için okunur.
 * - Zamanlar: `obsTime`, `validTimeFrom`/`To` epoch saniyedir; `issueTime`, `reportTime`
 *   gibi alanlar metindir (`2026-01-15 10:40:00.000Z` ya da ISO 8601; ikisi de okunur).
 */

const num = z.number().finite().nullish().catch(undefined)
const str = z.string().nullish().catch(undefined)
/** Sayı ya da metin (`wdir: "VRB"`, `visib: "6+"`). */
const numOrStr = z.union([z.number().finite(), z.string()]).nullish().catch(undefined)

const AwcCloud = z.object({ cover: str, base: num, top: num })
const clouds = z.array(AwcCloud.catch({})).nullish().catch(undefined)

export const AwcMetarSchema = z.object({
  icaoId: str,
  obsTime: num,
  reportTime: str,
  receiptTime: str,
  metarType: str,
  rawOb: str,
  temp: num,
  dewp: num,
  wdir: numOrStr,
  wspd: num,
  wgst: num,
  visib: numOrStr,
  altim: num,
  wxString: str,
  vertVis: num,
  clouds,
  fltCat: str,
})
export type AwcMetar = z.infer<typeof AwcMetarSchema>

const AwcTafForecast = z.object({
  timeFrom: num,
  timeTo: num,
  timeBec: num,
  // PROB30 TEMPO gibi gruplar için `PROB30` de gelebilir; metin olarak tutulur.
  fcstChange: str,
  probability: num,
  wdir: numOrStr,
  wspd: num,
  wgst: num,
  visib: numOrStr,
  wxString: str,
  vertVis: num,
  clouds,
})

export const AwcTafSchema = z.object({
  icaoId: str,
  issueTime: str,
  bulletinTime: str,
  dbPopTime: str,
  validTimeFrom: num,
  validTimeTo: num,
  rawTAF: str,
  mostRecent: num,
  fcsts: z.array(AwcTafForecast.catch({})).nullish().catch(undefined),
})
export type AwcTaf = z.infer<typeof AwcTafSchema>

/** Bir istasyon kodu: ICAO, dört büyük harf ya da rakam. */
export const STATION_ID = /^[A-Z0-9]{4}$/
/** Ham rapor üst sınırları (karakter); Türk METAR'ları ~100, TAF'ları ~300 karakterdir. */
export const MAX_METAR_RAW_LENGTH = 1_000
export const MAX_TAF_RAW_LENGTH = 4_000
/** Gözlem ya da yayın zamanı bizim saatimizden bu kadar ileride olamaz. */
export const MAX_FUTURE_MS = 60 * 60_000
/** Bundan eski zaman bozuk kayıttır (epoch 0, yanlış birim). */
const MIN_TIME_MS = Date.UTC(2000, 0, 1)

/** Ham metinde yalnızca yazdırılabilir ASCII ve boşluk olabilir (METAR/TAF alfabesi). */
const PRINTABLE = /^[\x20-\x7e]+$/

export type MetarReportType = 'METAR' | 'SPECI'

/** Doğrulanmış METAR/SPECI kaydı. */
export interface MetarReport {
  station: string
  type: MetarReportType
  observedAt: Date
  /** Boşlukları tekleştirilmiş ham metin (AWC'den geldiği gibi; `METAR`/`SPECI` öneki olabilir). */
  raw: string
  /** AWC uçuş kategorisi (`VFR`, `MVFR`, `IFR`, `LIFR`); ABD sınıflandırması, yalnızca uzman görünüm. */
  flightCategory: string | null
}

/** Doğrulanmış TAF kaydı. */
export interface TafReport {
  station: string
  issuedAt: Date
  validFrom: Date
  validTo: Date
  raw: string
  /** AWC `mostRecent` bayrağı; yoksa null. */
  mostRecent: boolean | null
}

export type SkipReason =
  | 'malformed'
  | 'station'
  | 'unlisted_station'
  | 'raw_missing'
  | 'raw_invalid'
  | 'raw_station_mismatch'
  | 'time'

export interface SkippedEntry {
  station: string | null
  reason: SkipReason
}

export interface ParsedReports<T> {
  items: T[]
  skipped: SkippedEntry[]
}

export interface AwcParseOptions {
  /** Yalnızca bu istasyonlar kabul edilir; verilmezse her geçerli istasyon. */
  stations?: ReadonlySet<string> | null
  /** Gelecek zaman denetimi için saat (ms); testte sabitlenir. */
  now?: number
}

export class AwcFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AwcFormatError'
  }
}

/**
 * AWC zaman metni: `2026-01-15 10:40:00.000Z` ya da ISO 8601 (`2026-01-15T10:40:00Z`). Saat dilimi
 * olmayan metin UTC sayılır (AWC yalnızca UTC verir). Geçersizse null.
 */
export function parseAwcTime(value: string | null | undefined): Date | null {
  const text = value?.trim()
  if (!text) return null
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(
      text,
    )
  if (!match) return null
  const [, y, mo, d, h, mi, s = '0', frac = '0', zone = 'Z'] = match
  const ms = Number(frac.padEnd(3, '0').slice(0, 3))
  let time = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), ms)
  if (zone !== 'Z') {
    const sign = zone.startsWith('-') ? -1 : 1
    const digits = zone.slice(1).replace(':', '')
    time -= sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) * 60_000
  }
  const date = new Date(time)
  // Taşan değerler (ör. 2026-02-30) Date.UTC'de sessizce kayar; geri çevrilince tutmazsa geçersiz.
  if (
    Number.isNaN(date.getTime()) ||
    Number(mo) < 1 ||
    Number(mo) > 12 ||
    Number(d) < 1 ||
    Number(d) > 31 ||
    Number(h) > 23 ||
    Number(mi) > 59 ||
    Number(s) > 59
  ) {
    return null
  }
  return date
}

/** Epoch saniye → Date; sonlu ve makul değilse null. */
function fromEpochSeconds(value: number | null | undefined): Date | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const ms = Math.round(value * 1000)
  return ms >= MIN_TIME_MS ? new Date(ms) : null
}

/** Ham metni tekleştirir; boş, yazdırılamaz ya da çok uzunsa hata nedeni döner. */
function cleanRaw(
  value: string | null | undefined,
  maxLength: number,
): { raw: string } | { reason: SkipReason } {
  if (typeof value !== 'string' || value.trim() === '') return { reason: 'raw_missing' }
  const raw = value.replace(/\s+/g, ' ').trim()
  if (raw.length > maxLength || !PRINTABLE.test(raw)) return { reason: 'raw_invalid' }
  return { raw }
}

/** Ham metnin baştaki birkaç sözcüğünden biri istasyon kodu olmalı (`METAR COR LTFM …`). */
function rawNamesStation(raw: string, station: string, words: number): boolean {
  return raw.split(' ').slice(0, words).includes(station)
}

function stationOf(
  value: string | null | undefined,
  options: AwcParseOptions,
): { station: string } | { reason: SkipReason; station: string | null } {
  const station = value?.trim().toUpperCase() ?? ''
  if (!STATION_ID.test(station)) return { reason: 'station', station: station || null }
  if (options.stations && !options.stations.has(station)) {
    return { reason: 'unlisted_station', station }
  }
  return { station }
}

function plausible(date: Date | null, now: number): date is Date {
  return date !== null && date.getTime() <= now + MAX_FUTURE_MS
}

function asArray(body: unknown, product: string): unknown[] {
  if (!Array.isArray(body)) throw new AwcFormatError(`${product} yanıtı dizi değil`)
  return body
}

/**
 * `/api/data/metar?format=json` yanıtı. Rapor türü ham metnin önekinden (`SPECI …`), yoksa
 * `metarType`'tan gelir; SYNOP gibi METAR dışı türler atlanır.
 */
export function parseMetarResponse(
  body: unknown,
  options: AwcParseOptions = {},
): ParsedReports<MetarReport> {
  const now = options.now ?? Date.now()
  const items: MetarReport[] = []
  const skipped: SkippedEntry[] = []
  for (const entry of asArray(body, 'METAR')) {
    const parsed = AwcMetarSchema.safeParse(entry)
    if (!parsed.success) {
      skipped.push({ station: null, reason: 'malformed' })
      continue
    }
    const m = parsed.data
    const id = stationOf(m.icaoId, options)
    if ('reason' in id) {
      skipped.push({ station: id.station, reason: id.reason })
      continue
    }
    const { station } = id
    const cleaned = cleanRaw(m.rawOb, MAX_METAR_RAW_LENGTH)
    if ('reason' in cleaned) {
      skipped.push({ station, reason: cleaned.reason })
      continue
    }
    const { raw } = cleaned
    const prefix = raw.split(' ', 1)[0]
    const declared = m.metarType?.trim().toUpperCase() ?? ''
    if (declared !== '' && declared !== 'METAR' && declared !== 'SPECI') {
      skipped.push({ station, reason: 'malformed' })
      continue
    }
    const type: MetarReportType =
      prefix === 'SPECI' || (prefix !== 'METAR' && declared === 'SPECI') ? 'SPECI' : 'METAR'
    if (!rawNamesStation(raw, station, 3)) {
      skipped.push({ station, reason: 'raw_station_mismatch' })
      continue
    }
    const observedAt = fromEpochSeconds(m.obsTime)
    if (!plausible(observedAt, now)) {
      skipped.push({ station, reason: 'time' })
      continue
    }
    const category = m.fltCat?.trim().toUpperCase() ?? ''
    items.push({
      station,
      type,
      observedAt,
      raw,
      flightCategory: /^[A-Z]{3,4}$/.test(category) ? category : null,
    })
  }
  return { items, skipped }
}

/**
 * `/api/data/taf?format=json` yanıtı. Yayın zamanı `issueTime`, yoksa `bulletinTime`'dır;
 * geçerlilik epoch saniyedir ve bitiş başlangıçtan sonra olmalıdır.
 */
export function parseTafResponse(
  body: unknown,
  options: AwcParseOptions = {},
): ParsedReports<TafReport> {
  const now = options.now ?? Date.now()
  const items: TafReport[] = []
  const skipped: SkippedEntry[] = []
  for (const entry of asArray(body, 'TAF')) {
    const parsed = AwcTafSchema.safeParse(entry)
    if (!parsed.success) {
      skipped.push({ station: null, reason: 'malformed' })
      continue
    }
    const t = parsed.data
    const id = stationOf(t.icaoId, options)
    if ('reason' in id) {
      skipped.push({ station: id.station, reason: id.reason })
      continue
    }
    const { station } = id
    const cleaned = cleanRaw(t.rawTAF, MAX_TAF_RAW_LENGTH)
    if ('reason' in cleaned) {
      skipped.push({ station, reason: cleaned.reason })
      continue
    }
    const { raw } = cleaned
    // `TAF AMD LTAI …`, `TAF COR LTFM …` ya da öneksiz `LTFM …`.
    if (!rawNamesStation(raw, station, 4)) {
      skipped.push({ station, reason: 'raw_station_mismatch' })
      continue
    }
    const issuedAt = parseAwcTime(t.issueTime) ?? parseAwcTime(t.bulletinTime)
    const validFrom = fromEpochSeconds(t.validTimeFrom)
    const validTo = fromEpochSeconds(t.validTimeTo)
    if (
      !plausible(issuedAt, now) ||
      issuedAt.getTime() < MIN_TIME_MS ||
      validFrom === null ||
      validTo === null ||
      validTo.getTime() <= validFrom.getTime()
    ) {
      skipped.push({ station, reason: 'time' })
      continue
    }
    items.push({
      station,
      issuedAt,
      validFrom,
      validTo,
      raw,
      mostRecent: t.mostRecent === 1 ? true : t.mostRecent === 0 ? false : null,
    })
  }
  return { items, skipped }
}
