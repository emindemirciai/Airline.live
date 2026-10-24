/**
 * Uçakların ekrandaki konumu ve harita kaynaklarının GeoJSON'u (D-075 §5–6). React ve MapLibre'den
 * bağımsızdır; çizim döngüsü (map-controller.ts) her ~66 ms'de bir `MotionTracker.update` çağırır.
 *
 * Konum, örneğin alındığı anın istemci saatindeki tahmininden (`sampledAt`) bu yana yer hızı ve
 * yönle ileri taşınır (örnekten en fazla 10 sn; seyrek veride havadaki uçak 180 sn, D-122;
 * alçaktaki tırmanmayan uçak yine 10 sn, interpolate.ts `airborneHorizonMs`). Yeni örnek gelince
 * simge sıçramaz: gösterilen konumdan yeni tahmine 1 sn'de geçer. Çok uzağa düşen
 * örnekte (uzun kesintiden sonra) geçiş yapılmaz, simge doğrudan yeni yerine konur. Seyrek veride son
 * örneği eskiyen simge budanana kadar adım adım soluklaşır (`staleOpacity`).
 *
 * Kaynağa yükleme (`setData`) ekranda görünür bir hareket olunca yapılır: son yüklemeden bu yana en
 * çok kayan simge `MIN_UPLOAD_SHIFT_PX`'e ulaşmadıkça (düşük yakınlaştırmada saniyeler sürer) yükleme
 * atlanır (`largestShiftPx`, `commit`).
 */
import type { LatLon } from '@havayolu/geo'
import {
  aircraftCategory,
  aircraftIconId,
  aircraftSortKey,
  aircraftVariant,
  type AircraftFeatureProperties,
  type AirportFeatureProperties,
  type Airport,
  type TrailFeatureProperties,
} from '@havayolu/shared'
import {
  airborneHorizonMs,
  BLEND_MS,
  blend,
  NORMAL_MOTION_POLICY,
  predictPosition,
  staleOpacity,
  type MotionPolicy,
} from '../../lib/live/interpolate'
import type { TrackedAircraft, TrailPoint } from '../../lib/live/store'

/** Bu kadar dereceden uzağa düşen yeni örnekte geçiş yapılmaz (~50 km). */
const JUMP_DEG = 0.5

/** Kaynak, en az bir simge bu kadar kaymadıkça yeniden yüklenmez (CSS px). */
export const MIN_UPLOAD_SHIFT_PX = 0.5

/** MapLibre dünya karosunun kenarı, CSS px (yakınlaştırma 0). */
const WORLD_TILE_PX = 512

const DEG = Math.PI / 180

/** Web Mercator'da ekvatorda bir boylam derecesinin ekrandaki uzunluğu, CSS px. */
export function pixelsPerDegree(zoom: number): number {
  return (WORLD_TILE_PX * 2 ** zoom) / 360
}

/**
 * İki yakın nokta arasındaki ekran uzaklığı, CSS px. Mercator'da enlem ölçeği 1/cos(enlem) kadar
 * büyür; kısa mesafede doğrusal yaklaşım yeterlidir.
 */
export function screenShiftPx(a: LatLon, b: LatLon, pxPerDegree: number): number {
  const cos = Math.max(0.01, Math.cos(((a.lat + b.lat) / 2) * DEG))
  return pxPerDegree * Math.hypot(b.lon - a.lon, (b.lat - a.lat) / cos)
}

type Props<T> = { [K in keyof T]: T[K] }

export interface PointFeature<P> {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: Props<P>
}

export interface LineFeature<P> {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  properties: Props<P>
}

export interface FeatureCollection<F> {
  type: 'FeatureCollection'
  features: F[]
}

export type AircraftCollection = FeatureCollection<PointFeature<AircraftFeatureProperties>>
export type TrailCollection = FeatureCollection<LineFeature<TrailFeatureProperties>>
export type AirportCollection = FeatureCollection<PointFeature<AirportFeatureProperties>>

export const EMPTY_COLLECTION: FeatureCollection<never> = Object.freeze({
  type: 'FeatureCollection',
  features: Object.freeze([]) as never[],
}) as FeatureCollection<never>

interface MotionState {
  receivedAt: number
  sampledAt: number
  t: number
  from: LatLon
  blendStart: number
  current: LatLon
  /** Simgenin saydamlığı (`staleOpacity` adımı). */
  opacity: number
  /** Son yüklemedeki (`commit`) konum; yoksa henüz yüklenmedi. */
  committed: LatLon | null
}

export class MotionTracker {
  private readonly states = new Map<string, MotionState>()

  /**
   * `now` anındaki gösterim konumları ve saydamlıkları; tahmin ufku ve soluklaşma `policy`'den
   * (interpolate.ts `motionPolicy`). Listede olmayan uçakların durumu atılır. Dönen değer: küme ya da
   * çizim değişti mi (uçak eklendi, düştü ya da bir simgenin saydamlık adımı değişti). Konum kaymaları
   * `largestShiftPx` ile ölçülür.
   */
  update(
    aircraft: readonly TrackedAircraft[],
    now: number,
    policy: Readonly<MotionPolicy> = NORMAL_MOTION_POLICY,
  ): boolean {
    let changed = false
    const seen = new Set<string>()
    for (const ac of aircraft) {
      seen.add(ac.hex)
      const horizon = ac.gnd ? policy.groundHorizonMs : airborneHorizonMs(ac, policy)
      const target = predictPosition(ac, ac.sampledAt, now, horizon)
      const opacity = staleOpacity(now - ac.sampledAt, policy)
      let state = this.states.get(ac.hex)
      if (!state) {
        state = {
          receivedAt: ac.receivedAt,
          sampledAt: ac.sampledAt,
          t: ac.t,
          from: target,
          blendStart: -Infinity,
          current: target,
          opacity,
          committed: null,
        }
        this.states.set(ac.hex, state)
        changed = true
        continue
      }
      if (state.opacity !== opacity) {
        state.opacity = opacity
        changed = true
      }
      if (
        state.receivedAt !== ac.receivedAt ||
        state.sampledAt !== ac.sampledAt ||
        state.t !== ac.t
      ) {
        state.receivedAt = ac.receivedAt
        state.sampledAt = ac.sampledAt
        state.t = ac.t
        const far =
          Math.abs(target.lat - state.current.lat) > JUMP_DEG ||
          Math.abs(target.lon - state.current.lon) > JUMP_DEG
        state.from = state.current
        state.blendStart = far ? -Infinity : now
      }
      state.current = blend(state.from, target, (now - state.blendStart) / BLEND_MS)
    }
    for (const hex of this.states.keys()) {
      if (!seen.has(hex)) {
        this.states.delete(hex)
        changed = true
      }
    }
    return changed
  }

  /**
   * Son `commit`'ten bu yana en çok kayan simgenin ekrandaki kayması, CSS px; hiç yüklenmemiş simge
   * varsa sonsuz. `stopAt`'e ulaşınca aramayı bırakır.
   */
  largestShiftPx(pxPerDegree: number, stopAt: number = Infinity): number {
    let largest = 0
    for (const state of this.states.values()) {
      if (!state.committed) return Infinity
      const shift = screenShiftPx(state.committed, state.current, pxPerDegree)
      if (shift > largest) {
        largest = shift
        if (largest >= stopAt) break
      }
    }
    return largest
  }

  /** Şu anki konumlar kaynağa yüklendi. */
  commit(): void {
    for (const state of this.states.values()) state.committed = state.current
  }

  /** Son `update`'teki gösterim konumu. */
  position(hex: string): LatLon | undefined {
    return this.states.get(hex)?.current
  }

  /** Son `update`'teki saydamlık (0,35–1). */
  opacity(hex: string): number | undefined {
    return this.states.get(hex)?.opacity
  }
}

/** İz yönü [0, 360); bilinmiyorsa 0 (kuzey). */
function heading(trk: number | null): number {
  if (trk === null || !Number.isFinite(trk)) return 0
  return ((trk % 360) + 360) % 360
}

/** Uçak kaynağının verisi: her uçak bir Point, özellikleri katman sözleşmesindeki gibi (layers.ts). */
export function aircraftCollection(
  aircraft: readonly TrackedAircraft[],
  motion: MotionTracker,
  selectedHex: string | null,
): AircraftCollection {
  const features: PointFeature<AircraftFeatureProperties>[] = []
  for (const ac of aircraft) {
    const position = motion.position(ac.hex) ?? ac
    const variant = aircraftVariant(ac, ac.hex === selectedHex)
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [position.lon, position.lat] },
      properties: {
        hex: ac.hex,
        icon: aircraftIconId(aircraftCategory(ac.cat, ac.type), variant),
        trk: heading(ac.trk),
        sort: aircraftSortKey(variant),
        opacity: motion.opacity(ac.hex) ?? 1,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

/**
 * Seçili uçağın izi: sayfa açıldığından beri alınan konumlar ve en sonda simgenin şu anki yeri.
 * Hava ve yer bölümleri ayrı LineString'lerdir (havada kehribar, yerde camgöbeği); bölümler
 * ortak noktayla birleşir, çizgide boşluk kalmaz. Bölüm, bitiş noktasının durumunu alır
 * (teker koyma iki örnek arasında olduysa o parça yer rengindedir).
 */
export function trailCollection(
  trail: readonly TrailPoint[],
  current: { lat: number; lon: number; gnd: boolean } | null,
): TrailCollection {
  const points: { lat: number; lon: number; gnd: boolean }[] = [...trail]
  if (current) {
    const last = points.at(-1)
    if (!last || last.lat !== current.lat || last.lon !== current.lon) points.push(current)
  }
  const features: LineFeature<TrailFeatureProperties>[] = []
  let segment: [number, number][] = []
  let segmentGnd: boolean | null = null
  let previous: { lat: number; lon: number } | null = null
  const flush = () => {
    if (segment.length >= 2 && segmentGnd !== null) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: segment },
        properties: { gnd: segmentGnd },
      })
    }
  }
  for (const point of points) {
    if (segmentGnd !== null && point.gnd !== segmentGnd) {
      flush()
      segment = previous ? [[previous.lon, previous.lat]] : []
    }
    segmentGnd = point.gnd
    segment.push([point.lon, point.lat])
    previous = point
  }
  flush()
  return { type: 'FeatureCollection', features }
}

/** Havalimanı kaynağının verisi (IATA kodları etiket tuvalinde yazılır). */
export function airportCollection(airports: readonly Airport[]): AirportCollection {
  return {
    type: 'FeatureCollection',
    features: airports.map((airport) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [airport.lon, airport.lat] },
      properties: { icao: airport.icao, iata: airport.iata, name: airport.name },
    })),
  }
}
