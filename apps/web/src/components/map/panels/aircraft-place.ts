import { format, formatDistance, type Messages, type UnitSystem } from '@havayolu/i18n'
import { compassKey8, type Locale } from '@havayolu/shared'
import type { TrackedAircraft } from '../../../lib/live/store'
import {
  displayPhase,
  GROUND_RADIUS_KM,
  OVERHEAD_KM,
  type FlightPhase,
  type PhaseInfo,
} from '../../../lib/map/flight-phase'
import { formatPosition } from './panel-format'

/**
 * Uçak listesinin "Konum ve durum" hücresi (D-085; domain.md → Haritadaki uçak listesi): tahmini
 * durumun rozeti ve listelenen havalimanına göre konum. Saf fonksiyon; durum `FlightPhaseTracker`
 * (lib/map/flight-phase.ts) ile depo değiştikçe hesaplanır, burada yalnızca okunur ve yazılır.
 */
export interface AircraftPlaceView {
  /** Gösterim durumu (`data-phase`). */
  phase: FlightPhase
  /** Rozet ("Yaklaşmada", "İnişte", "Yerde", "Alçakta sinyal kaybı"); yoldaki uçakta null. */
  badge: string | null
  /** Konum ("IST, 18 km", "IST, pist 35L", "IST üzerinde", "IST, 45 km kuzeyinde"). */
  text: string
  /** Konumun havalimanı, ICAO (`data-airport`); havalimanı yüklenmemişse null. */
  airport: string | null
}

type TableMessages = Messages['map']['table']

/**
 * Hücrenin metinleri. `info` izleyicinin durumudur (`FlightPhaseTracker.get`); uçak henüz
 * izlenmediyse ya da havalimanı yüklenmediyse konum koordinattır. `now` depodaki zamanlarla aynı
 * saattir (`useNow`); son örneği `lowAltLostAfterMs`'ten (varsayılan 30 sn) eskiyen alçaktaki uçak
 * "Alçakta sinyal kaybı" olur. Seyrek veride (D-122) çağıran `Infinity` verir.
 */
export function aircraftPlace(
  ac: Pick<TrackedAircraft, 'lat' | 'lon' | 'gnd' | 'sampledAt'>,
  info: PhaseInfo | undefined,
  now: number,
  messages: TableMessages,
  opts: { locale: Locale; units: UnitSystem; lowAltLostAfterMs?: number },
): AircraftPlaceView {
  const phase: FlightPhase = info
    ? displayPhase(info, ac.sampledAt, now, opts.lowAltLostAfterMs)
    : ac.gnd
      ? 'onGround'
      : 'enRoute'
  const badge = phase === 'enRoute' ? null : messages.phase[phase]
  if (
    info === undefined ||
    info.airport === null ||
    info.distanceKm === null ||
    info.bearingDeg === null
  ) {
    return { phase, badge, text: formatPosition(ac.lat, ac.lon), airport: null }
  }
  const located: Located = {
    airport: info.airport.iata.trim() === '' ? info.airport.icao : info.airport.iata,
    distanceKm: info.distanceKm,
    distance: formatDistance(info.distanceKm, { ...opts, nowrap: true }),
    bearingDeg: info.bearingDeg,
    runway: info.runway,
  }
  return { phase, badge, text: placeText(phase, located, messages), airport: info.airport.icao }
}

interface Located {
  /** IATA kodu (yoksa ICAO). */
  airport: string
  distanceKm: number
  /** Biçimlenmiş uzaklık ("18 km", "4,2 km", "9,7 NM"). */
  distance: string
  /** Havalimanı merkezinden uçağa yön, derece. */
  bearingDeg: number
  runway: string | null
}

/**
 * Durumuna göre konum: yaklaşmada ve inişte hizalı pist ya da uzaklık; alçakta sinyal kaybında son
 * bilinen uzaklık; havalimanında yerde yalnız kod; yolda (ve havalimanından uzakta yerde) 3 km
 * içinde "üzerinde", ötesinde uzaklık ve 8 yönden biri.
 */
function placeText(phase: FlightPhase, at: Located, messages: TableMessages): string {
  const { airport, distance } = at
  switch (phase) {
    case 'approaching':
    case 'landing':
      return at.runway === null
        ? format(messages.placeDistance, { airport, distance })
        : format(messages.placeRunway, { airport, runway: at.runway })
    case 'lowAltLost':
      return format(messages.placeDistance, { airport, distance })
    case 'onGround':
      return at.distanceKm <= GROUND_RADIUS_KM ? airport : bearingText(at, messages)
    case 'enRoute':
      return bearingText(at, messages)
  }
}

function bearingText(at: Located, messages: TableMessages): string {
  if (at.distanceKm < OVERHEAD_KM) return format(messages.placeOver, { airport: at.airport })
  const direction = messages.direction[compassKey8(at.bearingDeg) ?? 'N']
  return format(messages.placeBearing, { airport: at.airport, distance: at.distance, direction })
}
