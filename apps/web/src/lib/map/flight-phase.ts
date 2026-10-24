/**
 * Haritadaki uçak listesinin tahmini durumu (D-085; domain.md → "Haritadaki uçak listesi: tahmini
 * durum"): Yerde, İnişte (son yaklaşma), Yaklaşmada, Alçakta sinyal kaybı ya da yalnızca konum
 * (yolda). Yalnızca gösterimdir: olay üretmez, bildirim göndermez. Motorun durum makinesi ve
 * eşikleri değişmez; Parça 2 motoru istasyon durumlarını yayımlayınca liste onlara geçer.
 *
 * Saf modüldür: IO ve saat yoktur, zaman örneğin kendi zamanıdır (`t`). Yalnızca `@havayolu/geo` ve
 * paylaşılan tipleri kullanır; mobil harita gerekince ortak pakete taşınabilir.
 *
 * Girdi istemcide olanlardır: ADS-B örneği (konum, barometrik irtifa, yerde bayrağı, iz yönü, dikey
 * hız) ve listelenen havalimanları (merkez, rakım, tarifeli sefer, pist uçları). QNH, geometrik
 * irtifa ve navModes herkese açık akışta yoktur; yerden yükseklik bu yüzden `baro_tolerant`
 * yöntemiyledir (`alt − alan_yüksekliği`, her üst sınıra +300 ft; domain.md → AGL yöntemi).
 */
import {
  alongTrackKm,
  bearingDifference,
  crossTrackKm,
  distanceKm,
  initialBearing,
  kmToNm,
  type LatLon,
} from '@havayolu/geo'
import type { PublicAircraft } from '@havayolu/shared'
import { PointGrid } from './flight-phase-grid'

// Eşikler: kaynakları domain.md'dir (Tespit eşikleri, AGL yöntemi, İniş tespiti); çıkış eşikleri ve
// onay süresi listenin kararlılığı içindir (D-085).

/** `baro_tolerant` AGL toleransı: her yerden yükseklik üst sınırına eklenir (domain.md, yöntem 3). */
export const BARO_TOLERANCE_FT = 300
/** Yerde: havalimanı merkezine en çok (domain `touchdown`: ARP ≤ 6 km). */
export const GROUND_RADIUS_KM = 6
/** Yaklaşma: havalimanı merkezine giriş ve çıkış uzaklığı (domain: navModes `approach` ve ARP ≤ 30 km). */
export const APPROACH_RADIUS_KM = 30
export const APPROACH_EXIT_RADIUS_KM = 35
/** Yaklaşma: yerden yükseklik girişte < 10.000 ft (+300), çıkışta < 11.000 ft (domain varış kuralı). */
export const APPROACH_MAX_AGL_FT = 10_000
export const APPROACH_EXIT_AGL_FT = 11_000
/** Alçalma: yumuşatılmış dikey hız ≤ −300 ft/dk; tırmanış (çıkış) > +300 ft/dk. */
export const DESCENT_FPM = -300
export const CLIMB_EXIT_FPM = 300
/** Dikey hız yumuşatması: her yeni örnekte α = 0,5 üstel ortalama. */
export const VR_SMOOTHING = 0.5
/** Dikey hız akışta yoksa irtifa değişiminden en az bu aralıkla türetilir, ms. */
export const VR_DERIVE_MIN_MS = 2_000
/**
 * Havalimanına doğru ("mesafe azalıyor"): girişte iz yönü ile havalimanı merkezinin yönü farkı en çok
 * 45° (uzaklık yer hızının en az %71'iyle azalır); gösterilen havalimanı için çıkışta 90° (havalimanı
 * uçağın arkasında kalınca yaklaşma biter). 90° girişte yan yana duran havalimanını da kabul ederdi:
 * SAW'a ya da IST'ye inen uçak yandaki Atatürk'e "yaklaşmada" görünürdü.
 */
export const TOWARDS_MAX_DEG = 45
export const TOWARDS_EXIT_MAX_DEG = 90
/** 3° süzülüş profili: 6.076 ft × tan 3° ≈ 318 ft/NM. */
export const GLIDE_FT_PER_NM = 318
/**
 * Süzülüş zarfı: yaklaşmadaki uçak 3° profilin en çok 2 katı yükseklikte olabilir, en az 3.000 ft
 * (+300). Yakın bir havalimanının üstünden yüksekte geçen uçak ona "yaklaşmada" görünmez.
 */
export const GLIDE_ENVELOPE_FACTOR = 2
export const GLIDE_ENVELOPE_FLOOR_FT = 3_000
/** Pist hizası: iz ile pist yönü farkı ≤ 15°, merkez hattından yanal sapma ≤ 1 km (domain). */
export const ALIGN_TRACK_DEG = 15
export const ALIGN_XTRACK_KM = 1
/** Pist eşiğini bu kadar geçen uçak hâlâ hizalı sayılır (eşiğin hemen üstü), km. */
export const ALIGN_PAST_THRESHOLD_KM = 0.3
/** Hizalı yaklaşma: pist eşiğine ≤ 15 km ve yerden yükseklik < 4.000 ft (+300) (domain varış kuralı). */
export const ALIGNED_APPROACH_KM = 15
export const ALIGNED_APPROACH_AGL_FT = 4_000
/** İnişte: yerden yükseklik girişte < 1.000 ft (+300), çıkışta < 1.800 ft (domain `medium`). */
export const LANDING_AGL_FT = 1_000
export const LANDING_EXIT_AGL_FT = 1_800
/** İnişte: hizalı pist eşiğine (yoksa havalimanı merkezine) girişte ≤ 8 km, çıkışta ≤ 10 km. */
export const LANDING_RADIUS_KM = 8
export const LANDING_EXIT_RADIUS_KM = 10
/** Alçakta sinyal kaybı (domain APPROACHING → LOW_ALT_LOST): 30 sn veri yok, < 3.000 ft, ≤ 20 km. */
export const LOW_ALT_LOST_AFTER_MS = 30_000
export const LOW_ALT_LOST_AGL_FT = 3_000
export const LOW_ALT_LOST_RADIUS_KM = 20
/** Yoldaki uçak havalimanı merkezine bundan yakınsa "IST üzerinde" yazılır, km. */
export const OVERHEAD_KM = 3
/** Yeni durum ya da havalimanı, örnek zamanıyla bu kadar sürünce gösterilir, ms. */
export const CONFIRM_MS = 5_000

/** Yakın havalimanı ön elemesi: enlem ve (cos ile) boylam farkı, derece (~39 km ≥ 35 km). */
const NEARBY_DEG = 0.35

/** Listede gösterilen durum. `lowAltLost` gösterim anında, son örneğin yaşından çıkar. */
export type FlightPhase = 'onGround' | 'landing' | 'approaching' | 'lowAltLost' | 'enRoute'
/** İzleyicinin tuttuğu durum (örneklerden). */
export type TrackedFlightPhase = Exclude<FlightPhase, 'lowAltLost'>

/** Pist ucu girdisi (`MapRunwayEnd` ile aynı biçim; lib/ components/'ten import etmez). */
export interface PhaseRunwayEndInput {
  ident: string
  /** Bu uçtan karşı uca gerçek yön, derece. */
  trueBearingDeg: number
  /** Pist eşiği. */
  lat: number
  lon: number
}

/** Havalimanı girdisi (`MapAirport` ile yapısal olarak uyumlu). */
export interface PhaseAirportInput {
  icao: string
  iata: string
  /** Havalimanı merkezi (ARP). */
  lat: number
  lon: number
  /** Alan yüksekliği, ft; bilinmiyorsa 0 sayılır. */
  elevationFt: number | null
  /**
   * Tarifeli seferi var mı (OurAirports `scheduled_service`). Merkeze göre kurallar (hizasız İnişte ve
   * Yaklaşmada) yalnızca tarifeli havalimanlarında uygulanır; tarifesiz havalimanında (ör. Atatürk,
   * Uşak) durum yalnızca pist hizasından çıkar.
   */
  scheduled: boolean
  /**
   * Pistler. `ends` alanı yoksa liste uçları taşımadı (haritanın listesinde 4. halkadan itibaren,
   * `include=map`, D-111): uçak evre yarıçapına girince izleyici uçları ister
   * (`setMissingEndsHandler`, `setRunwayEnds`).
   */
  runways: readonly PhaseRunwayInput[]
}

/** Pist girdisi: uçlar (alan yoksa bilinmiyor; boş dizi uçsuz pist). */
export interface PhaseRunwayInput {
  ends?: readonly PhaseRunwayEndInput[]
}

export interface PhaseAirportRef {
  icao: string
  iata: string
}

/** Bir uçağın durumu ve konumu (izleyicinin gösterdiği). */
export interface PhaseInfo {
  phase: TrackedFlightPhase
  /**
   * Durumun havalimanı; yolda (ve havalimanından uzakta yerde) en yakın listelenen havalimanı.
   * Havalimanı yüklenmemişse null.
   */
  airport: PhaseAirportRef | null
  /** Uçaktan havalimanı merkezine yatay uzaklık, km. */
  distanceKm: number | null
  /** Havalimanı merkezinden uçağa gerçek yön, derece (konum metninin yönü). */
  bearingDeg: number | null
  /** Hizalı pist (ör. 35L); yalnızca yaklaşmada ve inişte. */
  runway: string | null
  /** O havalimanına göre yerden yükseklik, ft (`baro_tolerant`, toleranssız değer); yerde null. */
  aglFt: number | null
}

/** Sınıflandırmanın bir örnekten kullandığı alanlar. */
export type PhaseSample = Pick<PublicAircraft, 'lat' | 'lon' | 'alt' | 'gnd' | 'trk'>

interface PreparedEnd {
  ident: string | null
  bearingDeg: number
  threshold: LatLon
}

interface PreparedAirport {
  ref: PhaseAirportRef
  arp: LatLon
  elevationFt: number
  scheduled: boolean
  cosLat: number
  ends: PreparedEnd[]
  /** Listenin uçları taşımadığı ve uçları henüz eklenmemiş havalimanı (D-111). */
  endsMissing: boolean
}

interface Kinematics {
  descending: boolean
  climbing: boolean
}

/** Gösterilen durum: çıkış eşikleri buna göre uygulanır. */
interface Shown {
  phase: TrackedFlightPhase
  icao: string | null
}

interface Nearby {
  airport: PreparedAirport
  distanceKm: number
}

interface AlignedEnd {
  airport: PreparedAirport
  ident: string | null
  thresholdKm: number
}

function prepareEnds(runways: readonly PhaseRunwayInput[]): PreparedEnd[] {
  const ends: PreparedEnd[] = []
  for (const runway of runways) {
    for (const end of runway.ends ?? []) {
      ends.push({
        ident: end.ident.trim() === '' ? null : end.ident.trim(),
        bearingDeg: end.trueBearingDeg,
        threshold: { lat: end.lat, lon: end.lon },
      })
    }
  }
  return ends
}

function prepareAirport(input: PhaseAirportInput): PreparedAirport {
  return {
    ref: { icao: input.icao, iata: input.iata },
    arp: { lat: input.lat, lon: input.lon },
    elevationFt: input.elevationFt ?? 0,
    scheduled: input.scheduled,
    cosLat: Math.cos((input.lat * Math.PI) / 180),
    ends: prepareEnds(input.runways),
    endsMissing: input.runways.some((runway) => runway.ends === undefined),
  }
}

/**
 * Havalimanları 1°'lik ızgarada (`flight-phase-grid.ts`, D-101): en yakın havalimanı ve ön eleme
 * her uçak örneğinde bütün listeyi taramaz; sonuç ve eşitlikte seçilen (listede önce gelen)
 * doğrusal taramayla aynıdır.
 */
type AirportGrid = PointGrid<PreparedAirport>

/** Eşdikdörtgen yaklaşık uzaklıkta en yakın havalimanı; yoksa null. */
function nearestAirport(airports: AirportGrid, p: LatLon): PreparedAirport | null {
  return airports.nearest(p)
}

/** Ön elemeden geçen (~39 km) havalimanları, liste sırasıyla ve gerçek uzaklıklarıyla. */
function nearbyAirports(airports: AirportGrid, p: LatLon): Nearby[] {
  return airports
    .within(p, NEARBY_DEG)
    .map((airport) => ({ airport, distanceKm: distanceKm(p, airport.arp) }))
}

/**
 * Pist hizası (domain): iz ile pist yönü farkı ≤ 15°, merkez hattına yanal sapma ≤ 1 km ve uçak eşikten
 * önce (en çok 15 km) ya da eşiği en çok 0,3 km geçmiş. Birden çok uç hizalıysa eşiği en yakın olan.
 */
function alignedEnd(airport: PreparedAirport, p: LatLon, trk: number): AlignedEnd | null {
  let best: AlignedEnd | null = null
  for (const end of airport.ends) {
    if (bearingDifference(trk, end.bearingDeg) > ALIGN_TRACK_DEG) continue
    if (Math.abs(crossTrackKm(p, end.threshold, end.bearingDeg)) > ALIGN_XTRACK_KM) continue
    const toGo = -alongTrackKm(p, end.threshold, end.bearingDeg)
    if (toGo < -ALIGN_PAST_THRESHOLD_KM || toGo > ALIGNED_APPROACH_KM) continue
    const thresholdKm = distanceKm(p, end.threshold)
    if (best === null || thresholdKm < best.thresholdKm) {
      best = { airport, ident: end.ident, thresholdKm }
    }
  }
  return best
}

interface ApproachCandidate {
  near: Nearby
  /** Giriş koşuluna kendi başına uyar (alçalıyor, 45° içinde havalimanına doğru). */
  own: boolean
  /** Gösterilen (yaklaşmada ya da inişte) havalimanı. */
  shown: boolean
  /** İz yönü ile havalimanı yönü farkı, derece (iz bilinmiyorsa 180). */
  offTrackDeg: number
}

/**
 * Merkeze göre yaklaşmada adaylarının sırası: kendi başına uyan, yalnızca önceki durumdan tutulandan
 * önce gelir; sonra gösterilen havalimanı (etiket iki havalimanı arasında gidip gelmez), sonra iz
 * yönüne en yakın olan, sonra en yakın havalimanı. En yakını seçmek, uçağın yanındaki ya da arkasında
 * kalan havalimanını önündekinin yerine seçerdi.
 */
function betterApproach(a: ApproachCandidate, b: ApproachCandidate): boolean {
  if (a.own !== b.own) return a.own
  if (a.shown !== b.shown) return a.shown
  if (a.offTrackDeg !== b.offTrackDeg) return a.offTrackDeg < b.offTrackDeg
  return a.near.distanceKm < b.near.distanceKm
}

/** Süzülüş zarfının üst sınırı, ft (toleranslı): `max(3.000, 2 × 318 × NM) + 300`. */
function glideCeilingFt(distanceKmValue: number): number {
  const profile = GLIDE_ENVELOPE_FACTOR * GLIDE_FT_PER_NM * kmToNm(distanceKmValue)
  return Math.max(GLIDE_ENVELOPE_FLOOR_FT, profile) + BARO_TOLERANCE_FT
}

function infoFor(
  phase: TrackedFlightPhase,
  airport: PreparedAirport | null,
  sample: PhaseSample,
  runway: string | null,
): PhaseInfo {
  if (airport === null) {
    return { phase, airport: null, distanceKm: null, bearingDeg: null, runway: null, aglFt: null }
  }
  const p = { lat: sample.lat, lon: sample.lon }
  return {
    phase,
    airport: airport.ref,
    distanceKm: distanceKm(p, airport.arp),
    bearingDeg: initialBearing(airport.arp, p),
    runway,
    aglFt: sample.gnd || sample.alt === null ? null : sample.alt - airport.elevationFt,
  }
}

/**
 * Tek örneğin sınıflandırması (saf). `shown` gösterilen durumdur; o havalimanı için çıkış eşikleri
 * (daha geniş) uygulanır. Sıra: yerde, hizalı pist (inişte / yaklaşmada; her havalimanı), merkeze
 * göre inişte, merkeze göre yaklaşmada (ikisi de yalnızca tarifeli havalimanları), yolda.
 */
function classify(
  airports: AirportGrid,
  sample: PhaseSample,
  kin: Kinematics,
  shown: Shown | null,
): PhaseInfo {
  const p = { lat: sample.lat, lon: sample.lon }
  const shownAt = (airport: PreparedAirport, ...phases: TrackedFlightPhase[]) =>
    shown !== null && shown.icao === airport.ref.icao && phases.includes(shown.phase)

  if (sample.gnd) {
    // Havalimanında yerde; değilse (ör. kapsam dışı küçük alan) en yakın havalimanına göre konum.
    let at: Nearby | null = null
    for (const near of nearbyAirports(airports, p)) {
      if (near.distanceKm <= GROUND_RADIUS_KM && (at === null || near.distanceKm < at.distanceKm)) {
        at = near
      }
    }
    return infoFor('onGround', at?.airport ?? nearestAirport(airports, p), sample, null)
  }
  const alt = sample.alt
  if (alt === null) return infoFor('enRoute', nearestAirport(airports, p), sample, null)

  const nearby = nearbyAirports(airports, p)

  // Hizalı pist: eşiğe en yakın hizalı uç.
  if (sample.trk !== null) {
    let aligned: AlignedEnd | null = null
    for (const near of nearby) {
      if (near.distanceKm > APPROACH_EXIT_RADIUS_KM) continue
      const candidate = alignedEnd(near.airport, p, sample.trk)
      if (candidate && (aligned === null || candidate.thresholdKm < aligned.thresholdKm)) {
        aligned = candidate
      }
    }
    if (aligned) {
      const { airport } = aligned
      const agl = alt - airport.elevationFt
      const wasLanding = shownAt(airport, 'landing')
      const landingAgl = wasLanding ? LANDING_EXIT_AGL_FT : LANDING_AGL_FT + BARO_TOLERANCE_FT
      const landingKm = wasLanding ? LANDING_EXIT_RADIUS_KM : LANDING_RADIUS_KM
      if (
        agl < landingAgl &&
        aligned.thresholdKm <= landingKm &&
        (kin.descending || (wasLanding && !kin.climbing))
      ) {
        return infoFor('landing', airport, sample, aligned.ident)
      }
      const wasArriving = shownAt(airport, 'approaching', 'landing')
      const approachAgl = wasArriving
        ? APPROACH_EXIT_AGL_FT
        : ALIGNED_APPROACH_AGL_FT + BARO_TOLERANCE_FT
      // Tırmanan uçak (kalkış ya da pas geçme) hizalı olsa da yaklaşmada sayılmaz.
      if (agl < approachAgl && !kin.climbing) {
        return infoFor('approaching', airport, sample, aligned.ident)
      }
    }
  }

  // Havalimanı merkezine göre inişte (domain `medium` geometrisi); yalnızca tarifeli havalimanları.
  let landing: Nearby | null = null
  for (const near of nearby) {
    if (!near.airport.scheduled) continue
    const wasLanding = shownAt(near.airport, 'landing')
    if (near.distanceKm > (wasLanding ? LANDING_EXIT_RADIUS_KM : LANDING_RADIUS_KM)) continue
    const agl = alt - near.airport.elevationFt
    if (agl >= (wasLanding ? LANDING_EXIT_AGL_FT : LANDING_AGL_FT + BARO_TOLERANCE_FT)) continue
    if (!(kin.descending || (wasLanding && !kin.climbing))) continue
    if (landing === null || near.distanceKm < landing.distanceKm) landing = near
  }
  if (landing) return infoFor('landing', landing.airport, sample, null)

  // Havalimanı merkezine göre yaklaşmada (domain varış kuralı + süzülüş zarfı); yalnızca tarifeli
  // havalimanları. Aday ya kendi başına uyar (alçalıyor ve 45° içinde havalimanına doğru) ya da
  // gösterilen havalimanıdır ve tutulur (tırmanmıyor, havalimanı arkada değil: 90° içinde).
  let approach: ApproachCandidate | null = null
  for (const near of nearby) {
    if (!near.airport.scheduled) continue
    const wasArriving = shownAt(near.airport, 'approaching', 'landing')
    if (near.distanceKm > (wasArriving ? APPROACH_EXIT_RADIUS_KM : APPROACH_RADIUS_KM)) continue
    const agl = alt - near.airport.elevationFt
    if (agl >= (wasArriving ? APPROACH_EXIT_AGL_FT : APPROACH_MAX_AGL_FT + BARO_TOLERANCE_FT)) {
      continue
    }
    if (agl > glideCeilingFt(near.distanceKm)) continue
    const offTrackDeg =
      sample.trk === null
        ? null
        : bearingDifference(sample.trk, initialBearing(p, near.airport.arp))
    const own = kin.descending && offTrackDeg !== null && offTrackDeg <= TOWARDS_MAX_DEG
    // İz yönü bilinmiyorsa gösterilen havalimanı tutulur (uzaklaştığı bilinmiyor).
    const kept =
      wasArriving && !kin.climbing && (offTrackDeg === null || offTrackDeg <= TOWARDS_EXIT_MAX_DEG)
    if (!own && !kept) continue
    const candidate = { near, own, shown: wasArriving, offTrackDeg: offTrackDeg ?? 180 }
    if (approach === null || betterApproach(candidate, approach)) approach = candidate
  }
  if (approach) return infoFor('approaching', approach.near.airport, sample, null)

  return infoFor('enRoute', nearestAirport(airports, p), sample, null)
}

/** Durum ile havalimanı ikilisi: onay bu anahtar değişince başlar. */
function keyOf(info: Pick<PhaseInfo, 'phase' | 'airport'>): string {
  return `${info.phase}:${info.airport?.icao ?? ''}`
}

interface Entry {
  /** Son işlenen örneğin zamanı. */
  t: number
  /** Yumuşatılmış dikey hız, ft/dk. */
  vrS: number | null
  /** Dikey hızı türetmek için referans irtifa ve zamanı. */
  refAlt: number | null
  refT: number
  shown: PhaseInfo
  /** Gösterilenden farklı aday ve ilk görüldüğü örnek zamanı. */
  pending: { key: string; since: number } | null
}

/**
 * Uçak başına durum izleyicisi. Depo her değiştiğinde (WebSocket tam görüntüsü ve farkı, budama)
 * `observe` ile beslenir; yalnızca örnek zamanı (`t`) değişen uçak yeniden hesaplanır. Çizim
 * döngüsünde (her kare) çalışmaz; React çizimi yalnızca `get` ile okur.
 *
 * Kararlılık: yeni durum ya da havalimanı, örnek zamanıyla 5 sn sürünce gösterilir; o süre içinde
 * gösterilen durum korunur, uzaklığı ve yerden yüksekliği yeni örnekle güncellenir. Yeni görülen
 * uçağın ilk durumu beklemeden gösterilir.
 *
 * İstek üzerine pist uçları (D-111): listesi uçları taşımayan bir havalimanının (haritanın listesinde
 * 4. halkadan itibaren) 35 km'sine (`APPROACH_EXIT_RADIUS_KM`, pist hizasının arandığı yarıçap)
 * havadaki bir uçak girince izleyici havalimanını bildirir (`setMissingEndsHandler`; uçlar gelene kadar her
 * yeni örnekte, isteği atan tekilleştirir); getirilen uçlar `setRunwayEnds` ile eklenir ve sonraki
 * örnekten itibaren pist hizası denetlenir. İzleyici IO yapmaz; isteği harita atar
 * (use-flight-phases.ts).
 */
export class FlightPhaseTracker {
  private airports: AirportGrid = new PointGrid<PreparedAirport>([])
  private byIcao = new Map<string, PreparedAirport>()
  private source: readonly PhaseAirportInput[] | null = null
  private readonly entries = new Map<string, Entry>()
  private readonly listeners = new Set<() => void>()
  private revision = 0
  /** Getirilen uçlar (liste yeniden verilirse yeniden uygulanır). */
  private readonly fetchedEnds = new Map<string, PreparedEnd[]>()
  private onMissingEnds: ((icao: string) => void) | null = null

  /**
   * Havalimanlarını değiştirir ve bütün durumları siler (sonraki `observe` uçakları baştan
   * sınıflandırır). Aynı liste yeniden verilirse etkisizdir. Abonelere bildirir.
   */
  setAirports(list: readonly PhaseAirportInput[]): void {
    if (list === this.source) return
    this.source = list
    const prepared = list.map(prepareAirport)
    for (const airport of prepared) {
      const fetched = this.fetchedEnds.get(airport.ref.icao)
      if (fetched !== undefined && airport.endsMissing) {
        airport.ends = fetched
        airport.endsMissing = false
      }
    }
    // Izgara liste başına bir kez kurulur (5. halkada 3.266 havalimanı; 4. halkada ~0,2 ms, 1.217
    // havalimanıyla ölçüldü).
    this.airports = new PointGrid(prepared)
    this.byIcao = new Map(prepared.map((airport) => [airport.ref.icao, airport]))
    this.entries.clear()
    this.revision += 1
    for (const listener of [...this.listeners]) listener()
  }

  /**
   * Uçları listede olmayan havalimanının 35 km'sine havadaki bir uçak girince havalimanının ICAO'suyla
   * çağrılacak işlev: uçlar `setRunwayEnds` ile gelene kadar o yarıçaptaki her yeni örnekte (işlev
   * isteği tekilleştirir). null: bildirim yok, yakın havalimanı da aranmaz.
   */
  setMissingEndsHandler(handler: ((icao: string) => void) | null): void {
    this.onMissingEnds = handler
  }

  /**
   * Havalimanının tek havalimanı ucundan getirilen pistleri (D-111): uçları eklenir, sonraki
   * örneklerde pist hizası denetlenir. Liste değişse de korunur. Havalimanı listede yoksa yalnız
   * saklanır.
   */
  setRunwayEnds(icao: string, runways: readonly PhaseRunwayInput[]): void {
    const ends = prepareEnds(runways)
    this.fetchedEnds.set(icao, ends)
    const airport = this.byIcao.get(icao)
    if (airport === undefined) return
    airport.ends = ends
    airport.endsMissing = false
  }

  /** Havalimanı listesi her değiştiğinde artar (React `useSyncExternalStore` için). */
  get airportsRevision(): number {
    return this.revision
  }

  /**
   * Havalimanı listesi değişince çağrılır (her `observe`ta değil); dönüş aboneliği kaldırır. Bağlı
   * fonksiyondur: `useSyncExternalStore`'a doğrudan verilebilir.
   */
  readonly subscribeAirports = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Deponun bütün uçakları: yeni örneği olanlar sınıflandırılır, listede olmayanların durumu silinir
   * (bellek deponun boyutuyla sınırlı kalır).
   */
  observe(list: readonly PublicAircraft[]): void {
    const seen = new Set<string>()
    for (const ac of list) {
      seen.add(ac.hex)
      const entry = this.entries.get(ac.hex)
      if (entry !== undefined && ac.t <= entry.t) continue
      if (this.onMissingEnds !== null && !ac.gnd) this.reportMissingEnds(ac, this.onMissingEnds)
      this.entries.set(ac.hex, this.step(entry, ac))
    }
    if (this.entries.size !== seen.size) {
      for (const hex of this.entries.keys()) if (!seen.has(hex)) this.entries.delete(hex)
    }
  }

  /** Uçağın pist hizası yarıçapındaki uçsuz havalimanlarını bildirir. */
  private reportMissingEnds(ac: PhaseSample, notify: (icao: string) => void): void {
    for (const near of nearbyAirports(this.airports, { lat: ac.lat, lon: ac.lon })) {
      if (near.airport.endsMissing && near.distanceKm <= APPROACH_EXIT_RADIUS_KM) {
        notify(near.airport.ref.icao)
      }
    }
  }

  /** Uçağın gösterilen durumu; izleyici uçağı henüz görmediyse undefined. */
  get(hex: string): PhaseInfo | undefined {
    return this.entries.get(hex)?.shown
  }

  /** İzlenen uçak sayısı. */
  get size(): number {
    return this.entries.size
  }

  private step(entry: Entry | undefined, ac: PublicAircraft): Entry {
    const motion = nextVerticalRate(entry, ac)
    const kin: Kinematics = {
      descending: motion.vrS !== null && motion.vrS <= DESCENT_FPM,
      climbing: motion.vrS !== null && motion.vrS > CLIMB_EXIT_FPM,
    }
    const shown: Shown | null = entry
      ? { phase: entry.shown.phase, icao: entry.shown.airport?.icao ?? null }
      : null
    const candidate = classify(this.airports, ac, kin, shown)
    if (entry === undefined) return { t: ac.t, ...motion, shown: candidate, pending: null }

    const key = keyOf(candidate)
    if (key === keyOf(entry.shown)) {
      // Pist eşiğini geçen inişteki uçak hizadan çıkar; pist adı korunur.
      const runway = candidate.runway ?? (candidate.phase === 'landing' ? entry.shown.runway : null)
      return { t: ac.t, ...motion, shown: { ...candidate, runway }, pending: null }
    }
    const pending = entry.pending?.key === key ? entry.pending : { key, since: ac.t }
    if (ac.t - pending.since >= CONFIRM_MS) {
      return { t: ac.t, ...motion, shown: candidate, pending: null }
    }
    return { t: ac.t, ...motion, shown: this.refresh(entry.shown, ac), pending }
  }

  /** Onay beklerken gösterilen durumun sayıları yeni örnekle, aynı havalimanına göre yenilenir. */
  private refresh(shown: PhaseInfo, ac: PublicAircraft): PhaseInfo {
    const airport = shown.airport === null ? undefined : this.byIcao.get(shown.airport.icao)
    if (airport === undefined) return shown
    let runway: string | null = null
    if (shown.phase === 'landing' || shown.phase === 'approaching') {
      const aligned =
        ac.trk === null || ac.gnd ? null : alignedEnd(airport, { lat: ac.lat, lon: ac.lon }, ac.trk)
      runway = aligned?.ident ?? (shown.phase === 'landing' ? shown.runway : null)
    }
    return infoFor(shown.phase, airport, ac, runway)
  }
}

/**
 * Yumuşatılmış dikey hız: akıştaki `vr` (barometrik, yoksa geometrik); yoksa referans irtifadan en az
 * 2 sn sonraki irtifa değişiminden türetilir, o da yoksa önceki değer korunur.
 */
function nextVerticalRate(
  entry: Entry | undefined,
  ac: Pick<PublicAircraft, 'alt' | 'vr' | 't'>,
): Pick<Entry, 'vrS' | 'refAlt' | 'refT'> {
  let vrS = entry?.vrS ?? null
  let refAlt = entry?.refAlt ?? null
  let refT = entry?.refT ?? ac.t
  const hasVr = ac.vr !== null && Number.isFinite(ac.vr)
  let measured: number | null = hasVr ? ac.vr : null
  const elapsed = ac.t - refT
  if (measured === null && ac.alt !== null && refAlt !== null && elapsed >= VR_DERIVE_MIN_MS) {
    measured = ((ac.alt - refAlt) * 60_000) / elapsed
  }
  if (measured !== null) {
    vrS = vrS === null ? measured : VR_SMOOTHING * measured + (1 - VR_SMOOTHING) * vrS
  }
  if (ac.alt === null) {
    refAlt = null
  } else if (refAlt === null || hasVr || elapsed >= VR_DERIVE_MIN_MS) {
    refAlt = ac.alt
    refT = ac.t
  }
  return { vrS, refAlt, refT }
}

/**
 * Gösterilecek durum: yaklaşmada ya da inişteki uçağın son örneği `lostAfterMs`'ten (30 sn) eskiyse,
 * yerden yüksekliği < 3.000 ft (+300) ve havalimanı merkezine ≤ 20 km ise "Alçakta sinyal kaybı"
 * (domain LOW_ALT_LOST). `sampledAt` ve `now` aynı saattedir (istemcinin geri gitmeyen saati,
 * lib/live/clock.ts). Seyrek veride (D-122) örnekler birkaç dakikada bir geldiğinden yaş sinyal
 * kaybını göstermez; çağıran `Infinity` verir ve bu durum hiç gösterilmez.
 */
export function displayPhase(
  info: PhaseInfo,
  sampledAt: number,
  now: number,
  lostAfterMs: number = LOW_ALT_LOST_AFTER_MS,
): FlightPhase {
  if (
    (info.phase === 'approaching' || info.phase === 'landing') &&
    now - sampledAt > lostAfterMs &&
    info.aglFt !== null &&
    info.aglFt < LOW_ALT_LOST_AGL_FT + BARO_TOLERANCE_FT &&
    info.distanceKm !== null &&
    info.distanceKm <= LOW_ALT_LOST_RADIUS_KM
  ) {
    return 'lowAltLost'
  }
  return info.phase
}
