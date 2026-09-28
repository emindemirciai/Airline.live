import {
  destinationPoint,
  distanceKm,
  initialBearing,
  KM_PER_NM,
  mToFt,
  normalizeBearing,
  type LatLon,
} from '@havayolu/geo'

/**
 * Senaryoların saf hareket modelleri: her biri zamanın (epoch ms) fonksiyonudur, rastgelelik ve
 * saat okuması yoktur. Konumlar büyük daire üzerinde @havayolu/geo ile hesaplanır.
 */

/** Anlık hareket: konum, gerçek iz (track, derece) ve yer hızı (kt). */
export interface Motion {
  position: LatLon
  trackDeg: number
  gsKt: number
}

/** kt → km/ms */
export const ktToKmPerMs = (kt: number) => (kt * KM_PER_NM) / 3_600_000

/** value mod period, her zaman [0, period) aralığında (negatif zamanda da). */
export function positiveMod(value: number, period: number): number {
  const rest = value % period
  // `+ 0`: -0 sonucu 0'a çevrilir.
  const result = (rest < 0 ? rest + period : rest) + 0
  return result >= period ? 0 : result
}

/** Varışa bu kadar kalınca iz, varış noktasına bakan yön yerine bacağın son yönüdür (tanımsız kalmasın). */
const ARRIVAL_EPSILON_KM = 0.01

interface GreatCircleLeg {
  lengthKm: number
  at(travelledKm: number): { position: LatLon; trackDeg: number }
}

/** from → to büyük daire bacağı: kat edilen mesafedeki konum ve o noktadaki iz. */
function greatCircleLeg(from: LatLon, to: LatLon): GreatCircleLeg {
  const lengthKm = distanceKm(from, to)
  const startBearing = initialBearing(from, to)
  const finalTrack = normalizeBearing(initialBearing(to, from) + 180)
  return {
    lengthKm,
    at(travelledKm) {
      const s = Math.min(Math.max(travelledKm, 0), lengthKm)
      const position = destinationPoint(from, startBearing, s)
      const trackDeg = lengthKm - s > ARRIVAL_EPSILON_KM ? initialBearing(position, to) : finalTrack
      return { position, trackDeg }
    },
  }
}

function assertPositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} pozitif olmalı`)
}

/**
 * a ile b arasında sabit hızla büyük daire üzerinde gidip gelen uçak. Bir tur a→b ve b→a'dır;
 * `phase` [0, 1) turun hangi noktasından başlandığını söyler (uçaklar aynı anda aynı yerde olmasın).
 */
export function shuttleMotion(
  a: LatLon,
  b: LatLon,
  gsKt: number,
  phase = 0,
): (tMs: number) => Motion {
  assertPositive(gsKt, 'hız')
  const outbound = greatCircleLeg(a, b)
  const inbound = greatCircleLeg(b, a)
  assertPositive(outbound.lengthKm, 'bacak uzunluğu')
  const speed = ktToKmPerMs(gsKt)
  const legMs = outbound.lengthKm / speed
  const cycleMs = 2 * legMs
  return (tMs) => {
    const x = positiveMod(tMs + phase * cycleMs, cycleMs)
    const { position, trackDeg } =
      x < legMs ? outbound.at(x * speed) : inbound.at((x - legMs) * speed)
    return { position, trackDeg, gsKt }
  }
}

export interface ApproachProfile {
  threshold: LatLon
  /** Pistin gerçek yönü (eşikten karşı uca). */
  runwayBearingDeg: number
  thresholdElevationFt: number
  /** Son yaklaşmanın başladığı uzaklık, NM. */
  startNm: number
  /** Başlangıçtaki ve eşikteki yer hızı, kt (aradaki yavaşlama zamanla doğrusaldır). */
  startKt: number
  thresholdKt: number
  glideSlopeDeg: number
  /** Eşik geçiş yüksekliği (TCH), ft. */
  crossingHeightFt: number
}

export interface ApproachMotion extends Motion {
  /** Barometrik irtifa (QNH ile deniz seviyesine göre), ft. */
  altitudeFt: number
  /** Dikey hız, ft/dk (inişte negatif). */
  verticalRateFpm: number
  /** Eşiğe kalan uzaklık, km. */
  remainingKm: number
}

/**
 * Uzatılmış pist ekseninde süzülüş açısıyla alçalan ve eşiğe varınca başa dönen uçak. Eşik geçişi
 * TCH'dedir; hız zamanla doğrusal azalır, dikey hız yer hızı × süzülüş eğimidir.
 */
export function approachMotion(profile: ApproachProfile): (tMs: number) => ApproachMotion {
  assertPositive(profile.startNm, 'yaklaşma uzaklığı')
  assertPositive(profile.startKt, 'başlangıç hızı')
  assertPositive(profile.thresholdKt, 'eşik hızı')
  const start = destinationPoint(
    profile.threshold,
    normalizeBearing(profile.runwayBearingDeg + 180),
    profile.startNm * KM_PER_NM,
  )
  const final = greatCircleLeg(start, profile.threshold)
  const v0 = ktToKmPerMs(profile.startKt)
  const v1 = ktToKmPerMs(profile.thresholdKt)
  const durationMs = (2 * final.lengthKm) / (v0 + v1)
  const glide = Math.tan((profile.glideSlopeDeg * Math.PI) / 180)
  const ftPerMinPerKt = mToFt(KM_PER_NM * 1000) / 60
  return (tMs) => {
    const x = positiveMod(tMs, durationMs)
    const travelled = v0 * x - ((v0 - v1) * x * x) / (2 * durationMs)
    const gsKt = profile.startKt - ((profile.startKt - profile.thresholdKt) * x) / durationMs
    const { position, trackDeg } = final.at(travelled)
    const remainingKm = Math.max(0, final.lengthKm - travelled)
    return {
      position,
      trackDeg,
      gsKt,
      altitudeFt:
        profile.thresholdElevationFt + profile.crossingHeightFt + mToFt(remainingKm * 1000) * glide,
      verticalRateFpm: -gsKt * ftPerMinPerKt * glide,
      remainingKm,
    }
  }
}

/** Kapalı bir çokgen üzerinde sabit hızla dönen uçak (ör. yerde taksi turu). */
export function loopMotion(points: readonly LatLon[], gsKt: number): (tMs: number) => Motion {
  assertPositive(gsKt, 'hız')
  if (points.length < 2) throw new RangeError('tur için en az iki nokta gerekir')
  const legs = points.map((from, i) => greatCircleLeg(from, points[(i + 1) % points.length]!))
  const perimeterKm = legs.reduce((sum, leg) => sum + leg.lengthKm, 0)
  assertPositive(perimeterKm, 'tur uzunluğu')
  const speed = ktToKmPerMs(gsKt)
  return (tMs) => {
    let travelled = positiveMod(tMs * speed, perimeterKm)
    for (const leg of legs) {
      if (travelled < leg.lengthKm) return { ...leg.at(travelled), gsKt }
      travelled -= leg.lengthKm
    }
    // Kayan nokta birikimi çevreyi aşarsa tur başı (ilk bacağın başı) kullanılır.
    return { ...legs[0]!.at(0), gsKt }
  }
}
