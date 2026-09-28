import type { LiveSourceId, PositionSource } from './aircraft'

/**
 * `track_points.source` smallint kodu (D-073): `sağlayıcı sırası × 16 + PositionSource sırası`.
 * Kodlar veritabanında kalıcıdır: iki listenin sırası değiştirilmez, yeni değer yalnızca sona
 * eklenir. Konum kaynağı 16 değeri aşamaz (her sağlayıcının 16'lık bir bloğu vardır).
 */

export const LIVE_SOURCE_IDS: readonly LiveSourceId[] = ['adsbLol', 'localReceiver']

/** `PositionSource` birleşimindeki sırayla (aircraft.ts). */
const POSITION_ORDER = [
  'adsb_icao',
  'adsb_icao_nt',
  'adsr_icao',
  'tisb_icao',
  'adsc',
  'mlat',
  'other',
  'mode_s',
  'adsb_other',
  'adsr_other',
  'tisb_other',
  'tisb_trackfile',
  'unknown',
] as const satisfies readonly PositionSource[]

// Derleme zamanı denetimi: birleşime eklenen her konum kaynağı listede de olmalıdır.
type MissingPositionSource = Exclude<PositionSource, (typeof POSITION_ORDER)[number]>
const _allPositionSourcesListed: [MissingPositionSource] extends [never] ? true : never = true

export const POSITION_SOURCES: readonly PositionSource[] = POSITION_ORDER

/** Sağlayıcı başına ayrılan kod bloğu. */
export const POSITION_SLOTS_PER_SOURCE = 16

export function trackSourceCode(source: LiveSourceId, position: PositionSource): number {
  const sourceIndex = LIVE_SOURCE_IDS.indexOf(source)
  const positionIndex = POSITION_SOURCES.indexOf(position)
  if (sourceIndex < 0 || positionIndex < 0) {
    throw new RangeError(`Bilinmeyen iz kaynağı: ${String(source)} / ${String(position)}`)
  }
  return sourceIndex * POSITION_SLOTS_PER_SOURCE + positionIndex
}

/** Kodu çözer; tanımsız kod (negatif, tam sayı değil, boş blok ya da boş sıra) null döner. */
export function decodeTrackSource(
  code: number,
): { source: LiveSourceId; positionSource: PositionSource } | null {
  if (!Number.isSafeInteger(code) || code < 0) return null
  const source = LIVE_SOURCE_IDS[Math.floor(code / POSITION_SLOTS_PER_SOURCE)]
  const positionSource = POSITION_SOURCES[code % POSITION_SLOTS_PER_SOURCE]
  if (source === undefined || positionSource === undefined) return null
  return { source, positionSource }
}
