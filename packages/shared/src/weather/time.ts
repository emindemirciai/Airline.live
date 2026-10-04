/**
 * Zaman yardımcıları: METAR/TAF'taki gün-saat gruplarının (`DDHHMM`, `DDHH`) takvime oturtulması
 * ve yerel saat (Europe/Istanbul). Saat okunmaz: her işlev referans zamanı parametre olarak alır.
 */

/** Türkiye'nin saat dilimi (2016'dan beri sabit UTC+3; ofset koda gömülmez, `Intl` hesaplar). */
export const TURKEY_TIME_ZONE = 'Europe/Istanbul'

const DAY_MS = 86_400_000

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * Rapordaki gün/saat/dakikayı referansa en yakın takvim anına oturtur (önceki, aynı ve sonraki ay
 * denenir; ay sonu geçişi böyle çözülür). `hour` 24 olabilir (TAF: ertesi gün 00). Ayda olmayan
 * gün (ör. 31 Eylül) aday sayılmaz; hiçbir aday 20 günden yakın değilse null.
 */
export function resolveDayTime(
  day: number,
  hour: number,
  minute: number,
  reference: Date,
): Date | null {
  if (day < 1 || day > 31 || hour < 0 || hour > 24 || minute < 0 || minute > 59) return null
  if (hour === 24 && minute !== 0) return null
  const refMs = reference.getTime()
  if (!Number.isFinite(refMs)) return null
  const year = reference.getUTCFullYear()
  const month = reference.getUTCMonth()
  let best: number | null = null
  for (const offset of [-1, 0, 1]) {
    const y = year + Math.floor((month + offset) / 12)
    const m = (((month + offset) % 12) + 12) % 12
    if (day > daysInMonth(y, m)) continue
    const candidate = Date.UTC(y, m, day, hour, minute)
    if (best === null || Math.abs(candidate - refMs) < Math.abs(best - refMs)) best = candidate
  }
  if (best === null || Math.abs(best - refMs) > 20 * DAY_MS) return null
  return new Date(best)
}

/** `HHMM` (TREND FM/TL/AT) → gözlem zamanından sonraki ilk o saat (en fazla 24 saat ileride). */
export function resolveHourMinuteAfter(hhmm: string, after: Date): Date | null {
  const match = /^(\d{2})(\d{2})$/.exec(hhmm)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 24 || minute > 59 || (hour === 24 && minute !== 0)) return null
  const base = Date.UTC(
    after.getUTCFullYear(),
    after.getUTCMonth(),
    after.getUTCDate(),
    hour,
    minute,
  )
  // Gözlemden 1 saatten fazla önceyse ertesi güne aittir (TREND 2 saati kapsar).
  return new Date(base < after.getTime() - 3_600_000 ? base + DAY_MS : base)
}

/** Tarih girdisi: Date, epoch ms ya da ISO 8601 metni. */
export type DateInput = Date | number | string

export function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value)
}

/** Bir anın yerel takvim ve saat bileşenleri. */
export interface LocalTime {
  year: number
  /** 1–12. */
  month: number
  day: number
  hour: number
  minute: number
  second: number
  /** "15:32" (24 saat, iki dilde aynı). */
  hhmm: string
  /** "2026-10-01": yerel takvim günü (aynı gün mü karşılaştırması için). */
  dateKey: string
  /** UTC'ye göre ofset, dakika (Türkiye +180). */
  utcOffsetMinutes: number
}

const partFormatters = new Map<string, Intl.DateTimeFormat>()

function partFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    })
    partFormatters.set(timeZone, formatter)
  }
  return formatter
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Anın verilen saat dilimindeki (varsayılan Europe/Istanbul) bileşenleri; `Intl` ile, ofset gömülmez. */
export function localTime(at: DateInput, timeZone: string = TURKEY_TIME_ZONE): LocalTime {
  const date = toDate(at)
  const ms = date.getTime()
  if (!Number.isFinite(ms)) throw new RangeError('localTime: geçersiz tarih')
  const parts: Record<string, number> = {}
  for (const part of partFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  const year = parts.year ?? 0
  const month = parts.month ?? 1
  const day = parts.day ?? 1
  const hour = (parts.hour ?? 0) % 24
  const minute = parts.minute ?? 0
  const second = parts.second ?? 0
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const utcOffsetMinutes = Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000)
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    hhmm: `${pad2(hour)}:${pad2(minute)}`,
    dateKey: `${year}-${pad2(month)}-${pad2(day)}`,
    utcOffsetMinutes,
  }
}

/**
 * UTC farkının etiketi (dakikadan): "UTC+3", "UTC+3:30", "UTC−4" (eksi U+2212), fark yoksa "UTC".
 * Fark `localTime(...).utcOffsetMinutes`'tan gelir; i18n'in `formatUtcOffset`'i ve CHANGELOG.md'deki
 * yayın saati (D-091) aynı yazımı kullanır.
 */
export function utcOffsetLabel(minutes: number): string {
  if (minutes === 0) return 'UTC'
  const abs = Math.abs(minutes)
  const rest = abs % 60
  return `UTC${minutes < 0 ? '−' : '+'}${Math.floor(abs / 60)}${rest === 0 ? '' : `:${pad2(rest)}`}`
}

/** İki anın yerel takvim günü farkı (b − a); "yarın" kararı için. */
export function localDayDifference(
  a: DateInput,
  b: DateInput,
  timeZone: string = TURKEY_TIME_ZONE,
): number {
  const la = localTime(a, timeZone)
  const lb = localTime(b, timeZone)
  return Math.round(
    (Date.UTC(lb.year, lb.month - 1, lb.day) - Date.UTC(la.year, la.month - 1, la.day)) / DAY_MS,
  )
}
