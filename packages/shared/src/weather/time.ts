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

/**
 * Anın verilen saat dilimindeki (varsayılan Europe/Istanbul) bileşenleri; ofset gömülmez. Dilim
 * için sunucunun fark tablosu kayıtlıysa (`registerUtcOffsetTable`, D-109) ve an tablonun
 * aralığındaysa fark tablodan gelir (UTC + fark; tarayıcının tz verisine bakılmaz), yoksa `Intl`
 * hesaplar. Çalışma zamanı dilimi tanımıyorsa ve tablo varsa tablonun en yakın kenarındaki fark
 * kullanılır (aralığın dışındaki tek yedek); tablo da yoksa `RangeError`.
 */
export function localTime(at: DateInput, timeZone: string = TURKEY_TIME_ZONE): LocalTime {
  const date = toDate(at)
  const ms = date.getTime()
  if (!Number.isFinite(ms)) throw new RangeError('localTime: geçersiz tarih')
  const table = offsetTables.get(timeZone)
  if (table !== undefined) {
    const offset = tableOffset(table, ms, !isSupportedTimeZone(timeZone))
    if (offset !== undefined) return shiftedLocalTime(ms, offset)
  }
  return intlLocalTime(date, timeZone)
}

/** UTC + fark: bileşenler kaydırılmış anın UTC alanlarıdır (`Intl` yok). */
function shiftedLocalTime(ms: number, offsetMinutes: number): LocalTime {
  const shifted = new Date(Math.floor(ms / 1000) * 1000 + offsetMinutes * 60_000)
  const year = shifted.getUTCFullYear()
  const month = shifted.getUTCMonth() + 1
  const day = shifted.getUTCDate()
  const hour = shifted.getUTCHours()
  const minute = shifted.getUTCMinutes()
  return {
    year,
    month,
    day,
    hour,
    minute,
    second: shifted.getUTCSeconds(),
    hhmm: `${pad2(hour)}:${pad2(minute)}`,
    dateKey: `${year}-${pad2(month)}-${pad2(day)}`,
    utcOffsetMinutes: offsetMinutes,
  }
}

/** `Intl`'in hesapladığı bileşenler (kayıtlı tabloya bakmaz; tabloyu da bu kurar). */
function intlLocalTime(date: Date, timeZone: string): LocalTime {
  const ms = date.getTime()
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

const supportedZones = new Map<string, boolean>()

/**
 * Çalışma zamanı dilimi tanıyor mu (`Intl.DateTimeFormat`). Eski bir tarayıcı yeni bir dilimi
 * bilmeyebilir (`RangeError`); sonuç dilim başına bir kez hesaplanır. `@havayolu/shared`
 * reference/time-zones.ts bunu dışa verir (dilim tabloları bu modülü yüklemez).
 */
export function isSupportedTimeZone(timeZone: string): boolean {
  let known = supportedZones.get(timeZone)
  if (known === undefined) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format(0)
      known = true
    } catch {
      known = false
    }
    supportedZones.set(timeZone, known)
  }
  return known
}

/** Fark tablosunun bir parçası: `fromMs`'ten sonraki parçaya (ya da tablonun sonuna) kadar geçerli. */
export interface UtcOffsetSegment {
  fromMs: number
  offsetMinutes: number
}

/**
 * Sunucunun hesapladığı UTC farkı tablosu (D-109): bir dilimin, çizim anının ±48 saati içindeki
 * farkı ve aradaki geçişler (yaz saati, kural değişikliği). Havalimanı sayfasının adası saatleri bu
 * tablodan yazar (UTC + fark): tarayıcının tz verisi eski olsa da (Britanya Kolumbiyası 2026'dan
 * beri bütün yıl UTC−7, tzdata 2026b; Kazakistan 2024'ten beri tek dilim, 2024a; Paraguay,
 * Grönland; eski tarayıcının tanımadığı America/Ciudad_Juarez) sunucu çizimi ve ilk istemci çizimi
 * aynıdır, hidrasyon farkı olmaz. Tablonun dışındaki anlarda tarayıcının `Intl`'i kullanılır.
 */
export interface UtcOffsetTable {
  timeZone: string
  /** Kapsanan aralık, epoch ms (iki uç dahil). */
  fromMs: number
  toMs: number
  /** Artan `fromMs`'le; ilki `fromMs`'te başlar. */
  segments: UtcOffsetSegment[]
}

/** Tablonun çizim anının iki yanındaki genişliği, saat (D-109). */
export const UTC_OFFSET_TABLE_HOURS = 48

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

const intlOffset = (ms: number, timeZone: string) =>
  intlLocalTime(new Date(ms), timeZone).utcOffsetMinutes

/**
 * Dilimin `at` çevresindeki fark tablosu (D-109; sunucuda çağrılır). Aralık `at`'in saat başından
 * `hours` saat önce ve sonradır; saat başı taranır (48 saatte 97 `Intl` çağrısı), farkın değiştiği
 * saat içinde geçiş dakikası ikili aramayla bulunur. Kayıtlı tabloya bakılmaz.
 */
export function utcOffsetTable(
  timeZone: string,
  at: DateInput,
  hours: number = UTC_OFFSET_TABLE_HOURS,
): UtcOffsetTable {
  const ms = toDate(at).getTime()
  if (!Number.isFinite(ms)) throw new RangeError('utcOffsetTable: geçersiz tarih')
  const center = Math.floor(ms / HOUR_MS) * HOUR_MS
  const fromMs = center - hours * HOUR_MS
  const toMs = center + hours * HOUR_MS
  let previous = intlOffset(fromMs, timeZone)
  const segments: UtcOffsetSegment[] = [{ fromMs, offsetMinutes: previous }]
  for (let hourMs = fromMs + HOUR_MS; hourMs <= toMs; hourMs += HOUR_MS) {
    const offset = intlOffset(hourMs, timeZone)
    if (offset === previous) continue
    // Geçiş (hourMs − 1 saat, hourMs] aralığında: farkın değiştiği ilk dakika.
    let low = hourMs - HOUR_MS
    let high = hourMs
    while (high - low > MINUTE_MS) {
      const middle = low + Math.floor((high - low) / (2 * MINUTE_MS)) * MINUTE_MS
      if (intlOffset(middle, timeZone) === previous) low = middle
      else high = middle
    }
    segments.push({ fromMs: high, offsetMinutes: offset })
    previous = offset
  }
  return { timeZone, fromMs, toMs, segments }
}

/**
 * Tablodaki fark; an aralığın dışındaysa `extrapolate` iken en yakın kenarın farkı, değilse
 * undefined.
 */
function tableOffset(table: UtcOffsetTable, ms: number, extrapolate: boolean): number | undefined {
  if ((ms < table.fromMs || ms > table.toMs) && !extrapolate) return undefined
  let offset = table.segments[0]?.offsetMinutes
  for (const segment of table.segments) {
    if (segment.fromMs <= ms) offset = segment.offsetMinutes
    else break
  }
  return offset
}

/** Dilim başına son kayıtlı tablo (`registerUtcOffsetTable`). */
const offsetTables = new Map<string, UtcOffsetTable>()

/**
 * Sunucunun fark tablosunu kaydeder (D-109): bu dilimin aralıktaki bütün yerel saatleri
 * (`localTime` ve onu kullanan biçimlendiriciler, `utcOffsetFromTable`) tablodan gelir. Havalimanı
 * sayfasının adası çizimde çağırır; aynı dilimin yeni tablosu eskisinin yerini alır. Tablolar
 * aynı sunucunun `Intl`'inden geldiği için sunucuda aynı dilime ait iki istek birbirini bozmaz.
 */
export function registerUtcOffsetTable(table: UtcOffsetTable): void {
  offsetTables.set(table.timeZone, table)
}

/** Dilimin kayıtlı tablosu var mı (çalışma zamanının tanımadığı dilim de tabloyla yazılabilir). */
export function hasUtcOffsetTable(timeZone: string): boolean {
  return offsetTables.has(timeZone)
}

/**
 * Kayıtlı tablodaki fark, dakika (`localTime`'ın kuralı: aralıkta tablo; aralık dışında yalnız
 * çalışma zamanı dilimi tanımıyorsa en yakın kenar). Tablo kullanılmayacaksa undefined:
 * biçimlendirici `Intl`'e dilimle sorar.
 */
export function utcOffsetFromTable(timeZone: string, at: DateInput): number | undefined {
  const table = offsetTables.get(timeZone)
  const ms = toDate(at).getTime()
  if (table === undefined || !Number.isFinite(ms)) return undefined
  return tableOffset(table, ms, !isSupportedTimeZone(timeZone))
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
