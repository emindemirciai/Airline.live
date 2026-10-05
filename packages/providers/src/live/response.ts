import { z } from 'zod'
import { positionSource, type AircraftState, type LiveSourceId } from '../aircraft'

/**
 * readsb `jv2` / ADSBx v2 uyumlu yanıtların ayrıştırılması (data-sources.md §1 → Yanıt biçimi).
 * - adsb.lol zarfı `{ ac, msg, now, total, ctime, ptime }`, `now` epoch **ms**.
 * - readsb `aircraft.json` (yerel alıcı) zarfı `{ now, messages, aircraft }`, `now` epoch **saniye**.
 * - Veri yoksa anahtar hiç gelmez: şemada her alan opsiyoneldir, tip uyuşmayan alan yok sayılır.
 * - `lastPosition` ve `rr_lat`/`rr_lon` hiç kullanılmaz; konumu yalnızca `lat`/`lon` verir.
 * - Konum kaynağı `type`'tan gelir; readsb'nin `mlat`/`tisb` listeleri konumun MLAT ya da TIS-B'den
 *   türediğini söylüyorsa (`type` adsb_icao iken bile, ör. GPS karıştırmada) o kaynak kullanılır.
 * - `dbFlags`: adsb.lol'de alan yoksa 0; yerel alıcıda (veritabanısız readsb) bilinmiyor = null.
 *   Alan var ama geçersizse kayıt reddedilir (gizlilik kapalı varsayımla, D-071).
 * - `seen_pos` ham hâliyle `seenPosS`'e geçer (yoksa null; `seen` yerine konmaz, D-097).
 */

const num = z.number().finite().optional().catch(undefined)
const str = z.string().optional().catch(undefined)

const RawAircraft = z.object({
  hex: z.string(),
  type: str,
  flight: str,
  r: str,
  t: str,
  category: str,
  dbFlags: z.unknown().optional(),
  mlat: z.array(z.string()).optional().catch(undefined),
  tisb: z.array(z.string()).optional().catch(undefined),
  lat: num,
  lon: num,
  alt_baro: z
    .union([z.number().finite(), z.literal('ground')])
    .optional()
    .catch(undefined),
  alt_geom: num,
  nav_qnh: num,
  gs: num,
  track: num,
  true_heading: num,
  baro_rate: num,
  geom_rate: num,
  ias: num,
  tas: num,
  mach: num,
  wd: num,
  ws: num,
  oat: num,
  nav_altitude_mcp: num,
  nav_modes: z.array(z.string()).optional().catch(undefined),
  squawk: str,
  emergency: str,
  seen_pos: num,
  seen: num,
})
type RawAircraft = z.infer<typeof RawAircraft>

const Envelope = z.object({
  now: z.number().finite(),
  ac: z.array(z.unknown()).optional(),
  aircraft: z.array(z.unknown()).optional(),
  total: z.number().optional(),
})

export class ResponseFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResponseFormatError'
  }
}

/** `now` epoch ms mi saniye mi? (data-sources.md: `now > 1e12` ise ms). */
export function epochMs(now: number): number {
  return now > 1e12 ? Math.round(now) : Math.round(now * 1000)
}

export type RejectReason =
  | 'malformed'
  | 'invalid_db_flags'
  | 'no_position'
  | 'invalid_position'
  | 'stale'
  | 'impossible_speed'
  | 'impossible_vertical_rate'

export interface Rejected {
  hex: string | null
  reason: RejectReason
}

export interface ParsedResponse {
  /** Temizlikten geçen uçaklar. */
  aircraft: AircraftState[]
  rejected: Rejected[]
  /** Yanıtın ölçüm anı, epoch ms. */
  now: number
  /** Zarftaki toplam (adsb.lol); yoksa alınan kayıt sayısı. */
  total: number
}

/** Temizlik eşikleri (parça-1 M3). */
export const CLEANING = {
  maxSampleAgeMs: 60_000,
  /** Yanıtın saati (`now`) bizim saatimizden bu kadar saparsa yanıt bütünüyle reddedilir. */
  maxClockSkewMs: 60_000,
  maxGroundSpeedKt: 800,
  maxVerticalRateFpm: 10_000,
} as const

const orNull = <T>(value: T | undefined): T | null => (value === undefined ? null : value)

/** Konum MLAT ya da TIS-B'den mi türedi? (readsb: `mlat`/`tisb` = o kaynaktan gelen alanlar). */
function derivedSource(raw: RawAircraft) {
  const fromList = (list: string[] | undefined) =>
    list?.includes('lat') === true || list?.includes('lon') === true
  if (fromList(raw.mlat)) return 'mlat' as const
  if (fromList(raw.tisb)) return 'tisb_other' as const
  return positionSource(raw.type)
}

function dbFlagsOf(value: unknown, source: LiveSourceId): number | null | 'invalid' {
  if (value === undefined) return source === 'adsbLol' ? 0 : null
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 'invalid'
}

function toState(raw: RawAircraft, nowMs: number, source: LiveSourceId): AircraftState | Rejected {
  const hex = raw.hex.trim().toLowerCase()
  const dbFlags = dbFlagsOf(raw.dbFlags, source)
  if (dbFlags === 'invalid') return { hex, reason: 'invalid_db_flags' }
  if (raw.lat === undefined || raw.lon === undefined) return { hex, reason: 'no_position' }
  if (Math.abs(raw.lat) > 90 || Math.abs(raw.lon) > 180) return { hex, reason: 'invalid_position' }
  // Konumun yaşı: seen_pos (sn). Yoksa son mesajın yaşı (seen); ikisi de yoksa ölçüm anı. Negatif
  // yaş (bozuk değer) gelecekte bir örnek üretmesin diye 0'a çekilir.
  const ageSec = Math.max(0, raw.seen_pos ?? raw.seen ?? 0)
  if (ageSec * 1000 > CLEANING.maxSampleAgeMs) return { hex, reason: 'stale' }
  if (raw.gs !== undefined && raw.gs > CLEANING.maxGroundSpeedKt) {
    return { hex, reason: 'impossible_speed' }
  }
  const rates = [raw.baro_rate, raw.geom_rate].filter((r): r is number => r !== undefined)
  if (rates.some((r) => Math.abs(r) > CLEANING.maxVerticalRateFpm)) {
    return { hex, reason: 'impossible_vertical_rate' }
  }
  const onGround = raw.alt_baro === 'ground'
  const callsign = raw.flight?.trim() || null
  const emergency = raw.emergency && raw.emergency !== 'none' ? raw.emergency : null
  return {
    hex,
    nonIcao: hex.startsWith('~'),
    callsign,
    registration: raw.r?.trim() || null,
    typeCode: raw.t?.trim() || null,
    category: raw.category?.trim() || null,
    dbFlags,
    positionSource: derivedSource(raw),
    lat: raw.lat,
    lon: raw.lon,
    altBaroFt: typeof raw.alt_baro === 'number' ? raw.alt_baro : null,
    onGround,
    altGeomFt: orNull(raw.alt_geom),
    navQnhHpa: orNull(raw.nav_qnh),
    gsKt: orNull(raw.gs),
    trackDeg: orNull(raw.track),
    trueHeadingDeg: orNull(raw.true_heading),
    baroRateFpm: orNull(raw.baro_rate),
    geomRateFpm: orNull(raw.geom_rate),
    iasKt: orNull(raw.ias),
    tasKt: orNull(raw.tas),
    mach: orNull(raw.mach),
    windDirDeg: orNull(raw.wd),
    windSpeedKt: orNull(raw.ws),
    oatC: orNull(raw.oat),
    selAltFt: orNull(raw.nav_altitude_mcp),
    navModes: raw.nav_modes ?? [],
    squawk: raw.squawk?.trim() || null,
    emergency,
    sampleTime: nowMs - Math.round(ageSec * 1000),
    seenPosS: orNull(raw.seen_pos),
    source,
  }
}

export interface ParseOptions {
  /**
   * Yanıtın alındığı an (bizim saatimiz, epoch ms). Verilirse yanıtın saati bundan 60 sn'den fazla
   * saparsa (donmuş aircraft.json, saati kaymış alıcı, bayat önbellek) yanıt reddedilir: örneklerin
   * yaşı yanıtın kendi saatine göre ölçüldüğü için aksi hâlde temizlikten geçerlerdi.
   */
  receivedAt?: number
}

/**
 * Zarfı ve uçakları ayrıştırır, temizlik kurallarını uygular: konumu olmayan ya da geçersiz,
 * 60 sn'den eski, hızı > 800 kt ya da |dikey hızı| > 10.000 fpm olan örnekler atılır (nedeniyle).
 */
export function parseLiveResponse(
  body: unknown,
  source: LiveSourceId,
  { receivedAt }: ParseOptions = {},
): ParsedResponse {
  const envelope = Envelope.safeParse(body)
  if (!envelope.success) {
    throw new ResponseFormatError('yanıt beklenen zarf biçiminde değil (now alanı yok ya da bozuk)')
  }
  const nowMs = epochMs(envelope.data.now)
  if (receivedAt !== undefined && Math.abs(receivedAt - nowMs) > CLEANING.maxClockSkewMs) {
    throw new ResponseFormatError(
      `yanıtın saati ${Math.round((nowMs - receivedAt) / 1000)} sn kaymış (donmuş ya da saati yanlış kaynak)`,
    )
  }
  const items = envelope.data.ac ?? envelope.data.aircraft ?? []
  const aircraft: AircraftState[] = []
  const rejected: Rejected[] = []
  for (const item of items) {
    const raw = RawAircraft.safeParse(item)
    if (!raw.success) {
      const hex = (item as { hex?: unknown } | null)?.hex
      rejected.push({ hex: typeof hex === 'string' ? hex : null, reason: 'malformed' })
      continue
    }
    const result = toState(raw.data, nowMs, source)
    if ('reason' in result) rejected.push(result)
    else aircraft.push(result)
  }
  return { aircraft, rejected, now: nowMs, total: envelope.data.total ?? items.length }
}
