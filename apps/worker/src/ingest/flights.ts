import type { AircraftState } from '@havayolu/providers'
import { SAMPLED_INTERVAL_MS } from './tracks'

/**
 * Uçuş kaydı ayrıştırma (domain.md "Uçuş kaydı", D-073). Aynı hex'in kesintisiz bir uçuşu bir
 * kayıttır; şu durumlar yeni kayıt başlatır:
 * - 30 dk'dan uzun veri boşluğu
 * - iki dolu çağrı kodu arasında değişim (çağrı kodunun boşalıp dolması yeni kayıt değildir;
 *   karşılaştırma son bilinen dolu çağrı koduyladır)
 * - yerde 20 dk: önceki kayıt kapanır, yeni kayıt yer beklemesinin 20. dakikasında başlar. Aynı
 *   yer beklemesi ikinci kez bölünmez; park eden uçak saatte üç kayıt üretmez.
 *
 * Yerdeyken çağrı kodu değişimiyle açılan kayıt da o yer beklemesinin bölünmesi sayılır: yer
 * beklemesi sürer ve 20 dk kuralıyla bir daha bölünmez (kalkışa hazırlanan uçağın yeni sefer
 * kaydı, beklemenin 20. dakikasında ikiye ayrılmaz).
 *
 * Saf modüldür: zaman örneklerin `sampleTime`'ından gelir, IO yapmaz.
 */

export const FLIGHT_GAP_MS = 30 * 60_000
export const GROUND_SPLIT_MS = 20 * 60_000

export interface FlightTrack {
  /** Veritabanı kimliği; kayıt oluşturulana kadar null. */
  id: number | null
  hex: string
  /** Son bilinen dolu çağrı kodu. */
  callsign: string | null
  registration: string | null
  typeCode: string | null
  firstSeen: number
  lastSeen: number
  /** Süren yer beklemesinin başladığı örnek zamanı; havadaysa null. */
  groundSince: number | null
  /** Bu yer beklemesi bölündü mü (20 dk kuralı ya da yerde çağrı kodu değişimi)? */
  groundSplitDone: boolean
}

export type FlightDecision =
  { action: 'continue' } | { action: 'new'; reason: 'first' | 'gap' | 'callsign' | 'ground' }

/** Çağrı kodu karşılaştırması: boşluklar atılır, büyük harf. */
const callsignKey = (callsign: string) => callsign.trim().toUpperCase()

export function decideFlight(prev: FlightTrack | undefined, s: AircraftState): FlightDecision {
  if (prev === undefined) return { action: 'new', reason: 'first' }
  if (s.sampleTime - prev.lastSeen > FLIGHT_GAP_MS) return { action: 'new', reason: 'gap' }
  if (
    prev.callsign !== null &&
    s.callsign !== null &&
    callsignKey(s.callsign) !== '' &&
    callsignKey(prev.callsign) !== callsignKey(s.callsign)
  ) {
    return { action: 'new', reason: 'callsign' }
  }
  if (
    s.onGround &&
    prev.groundSince !== null &&
    !prev.groundSplitDone &&
    s.sampleTime - prev.groundSince >= GROUND_SPLIT_MS
  ) {
    return { action: 'new', reason: 'ground' }
  }
  return { action: 'continue' }
}

const filled = (value: string | null) => (value !== null && value.trim() !== '' ? value : null)

/**
 * Örnekten yeni kayıt durumu (id kayıt oluşturulana kadar null). Tescil ve tip uçağa aittir:
 * örnekte yoksa önceki kayıttan taşınır. Yer beklemesi sürerken açılan kayıt (`ground`,
 * `callsign`) beklemenin başlangıcını korur ve beklemeyi bölünmüş sayar; ilk kayıt ve boşluk
 * sonrası kayıt yeni bir bekleme başlatır (boşlukta uçağın ne yaptığı bilinmez).
 */
export function startFlight(
  s: AircraftState,
  prev?: FlightTrack,
  reason?: FlightDecision,
): FlightTrack {
  const why = reason?.action === 'new' ? reason.reason : 'first'
  const sameAircraft = prev !== undefined && prev.hex === s.hex
  const staysOnGround = s.onGround && sameAircraft && (why === 'ground' || why === 'callsign')
  return {
    id: null,
    hex: s.hex,
    callsign: filled(s.callsign),
    registration: filled(s.registration) ?? (sameAircraft ? prev.registration : null),
    typeCode: filled(s.typeCode) ?? (sameAircraft ? prev.typeCode : null),
    firstSeen: s.sampleTime,
    lastSeen: s.sampleTime,
    groundSince: s.onGround
      ? staysOnGround
        ? (prev.groundSince ?? s.sampleTime)
        : s.sampleTime
      : null,
    groundSplitDone: staysOnGround,
  }
}

/**
 * Açılışta yüklenen kaydın yer bekleme durumu (durum bellekte tutulur; yeniden başlatma onu
 * silmemelidir, yoksa park eden uçağın beklemesi her yayından sonra bir kez daha bölünür).
 * `trailingGroundStart`: kaydın `track_points_sampled` satırlarında en yeni satır yerdeyse sondaki
 * yer dizisinin ilk satırının zamanı, değilse null (`loadTrailingGroundStart`).
 *
 * Bekleme bölünmüş sayılır:
 * - dizi kaydın ilk satırıyla başlıyorsa: kayıt yer beklemesi sırasında açılmıştır. İlk satır
 *   `firstSeen`'de yazılır; önünde havada bir satır olsaydı yer dizisi en erken 30 sn sonra
 *   başlardı. Bu kayıt 20 dk ya da yerde çağrı kodu bölünmesinin ürünüdür; ilk görülmesi yerde
 *   olan (ilk ya da boşluk sonrası) kayıt kendi satırlarından bundan ayırt edilemez ve o da
 *   bölünmüş sayılır: yeniden başlatma bir beklemeyi iki kez bölmez, en fazla bir bölünmeyi atlar.
 * - dizi 20 dk'dan uzun sürmüşse: bölünmemiş olsaydı kayıt çoktan kapanmış olurdu.
 */
export function restoredGroundState(
  firstSeen: number,
  lastSeen: number,
  trailingGroundStart: number | null,
): Pick<FlightTrack, 'groundSince' | 'groundSplitDone'> {
  if (trailingGroundStart === null) return { groundSince: null, groundSplitDone: false }
  const beganOnGround = trailingGroundStart - firstSeen < SAMPLED_INTERVAL_MS
  const outlasted = lastSeen - trailingGroundStart >= GROUND_SPLIT_MS
  return { groundSince: trailingGroundStart, groundSplitDone: beganOnGround || outlasted }
}

/**
 * Kayda devam: lastSeen ileri gider; dolu çağrı kodu, tescil ve tip güncellenir; yerde bekleme
 * başlar ya da sürer, havalanınca sıfırlanır.
 */
export function continueFlight(t: FlightTrack, s: AircraftState): FlightTrack {
  return {
    ...t,
    callsign: filled(s.callsign) ?? t.callsign,
    registration: filled(s.registration) ?? t.registration,
    typeCode: filled(s.typeCode) ?? t.typeCode,
    lastSeen: Math.max(t.lastSeen, s.sampleTime),
    groundSince: s.onGround ? (t.groundSince ?? s.sampleTime) : null,
    groundSplitDone: s.onGround ? t.groundSplitDone : false,
  }
}
