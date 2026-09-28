import {
  destinationPoint,
  distanceKm,
  initialBearing,
  kmToNm,
  nmToKm,
  type LatLon,
} from '@havayolu/geo'

/**
 * Kapsama planı ve istek zamanlayıcı (data-sources.md §1 "Kapsama planı ve öncelikler", D-073).
 *
 * Plan:
 * - P0 istasyon çemberlerinden (ARP merkezli, `fetchRadiusNm`) en az birini içeriyorsa batı çemberi
 * - batıya sığmayan istasyonlar için ayrı çember; iki istasyon ≤ 250 NM'lik tek çembere sığıyorsa
 *   birleştirilir
 * - birincil istasyon için ARP merkezli 40 NM çember
 * - her zaman Doğu çemberi
 *
 * Zamanlayıcı: her slotta tek istek atılır. İşler birincil istasyon, takip listesi, diğer
 * istasyonlar (istasyon başına) ve Doğu'dur. Bu slotta çekilmezse hedefini kaçıracak iş
 * "zorunlu"dur. Zorunlular arasından en önemlisi (birincil = takip listesi > istasyonlar > Doğu;
 * eşitlikte erken son tarih), zorunlu yoksa son tarihi en erken olan seçilir. Daha az önemli bir
 * işe slot vermek daha önemli bir işin hedefini kaçırtacaksa (kısa ufuklu benzetimle bakılır),
 * slot o önemli işe verilir; böylece bütçe yetmezse önce Doğu, sonra istasyonlar düşer.
 *
 * Takip listesi işinin son tarihi çağırandan gelir: çemberlerin karşılamadığı uçağın örnek zamanı
 * + 30 sn. Son `/v2/hex` isteğinden türetilmez; yoksa takip ihtiyacı yeni doğduğunda iş sonsuz
 * gecikmiş sayılır ve sırası gelmiş birincil çekimin slotunu alır. Eşit önemdeki zorunlu işlerde
 * son tarihini hâlâ tutturabilecek iş, zaten kaçırmış olandan önce gelir.
 *
 * Saf modüldür: zaman dışarıdan verilir, IO yapmaz.
 */

export interface CoverageCircle {
  center: LatLon
  radiusNm: number
}

/** P2 birleşik batı çemberi; tohum istasyonların P0 çemberlerini kapsar. */
export const WEST_CIRCLE: Readonly<CoverageCircle> = {
  center: { lat: 39.5, lon: 29.5 },
  radiusNm: 250,
}
/** P2 Doğu Türkiye çemberi; her planda bulunur. */
export const EAST_CIRCLE: Readonly<CoverageCircle> = {
  center: { lat: 39.2, lon: 38.8 },
  radiusNm: 250,
}
export const PRIMARY_EXTRA_RADIUS_NM = 40
/** adsb.lol `/v2/point` yarıçap sınırı (tamsayı NM). */
export const MAX_CIRCLE_NM = 250

/** İçerme hesabındaki kayan nokta payı, NM. */
const EPSILON_NM = 1e-9
/** Birleşik çember merkezi, istemcinin istek adresindeki gibi 4 ondalığa yuvarlanır (~11 m). */
const CENTER_DECIMALS = 4

export interface StationInput {
  icao: string
  lat: number
  lon: number
  fetchRadiusNm: number
  isPrimary: boolean
}

export type CircleKind = 'west' | 'station' | 'primary' | 'east'

export interface PlannedCircle {
  id: string
  kind: CircleKind
  center: { lat: number; lon: number }
  /** Tamsayı NM, 1..250. */
  radiusNm: number
  /** P0 çemberi bu çemberin tamamen içinde kalan istasyonlar (ICAO, alfabetik). */
  covers: string[]
  /** Yalnızca `primary` çemberinde: merkezdeki birincil istasyon (zamanlayıcı bununla tanır). */
  primaryIcao?: string
}

const distanceNm = (a: LatLon, b: LatLon) => kmToNm(distanceKm(a, b))

function containsCircle(outer: CoverageCircle, inner: CoverageCircle): boolean {
  return distanceNm(outer.center, inner.center) + inner.radiusNm <= outer.radiusNm + EPSILON_NM
}

/** P0 çemberi: ARP merkezli, `fetchRadiusNm` yarıçaplı; API sınırı nedeniyle en fazla 250 NM. */
function p0Circle(s: StationInput): CoverageCircle {
  const radius = Number.isFinite(s.fetchRadiusNm) ? s.fetchRadiusNm : 0
  return {
    center: { lat: s.lat, lon: s.lon },
    radiusNm: Math.min(MAX_CIRCLE_NM, Math.max(0, radius)),
  }
}

/** İstek yarıçapı: yukarı yuvarlanmış tamsayı, 1..250. */
const requestRadius = (nm: number) =>
  Math.min(MAX_CIRCLE_NM, Math.max(1, Math.ceil(nm - EPSILON_NM)))

const roundCoordinate = (value: number) => {
  const factor = 10 ** CENTER_DECIMALS
  return Math.round(value * factor) / factor
}

/**
 * İki çemberi içeren en küçük çember (büyük daire üzerinde). Merkez 4 ondalığa yuvarlanır ve
 * yarıçap yuvarlanmış merkeze göre yeniden hesaplanıp yukarı tamsayıya çekilir; iki çember de
 * kesinlikle içeride kalır. 250 NM sınırı çağıranda denetlenir.
 */
function enclosingCircle(a: CoverageCircle, b: CoverageCircle): CoverageCircle {
  const d = distanceNm(a.center, b.center)
  let center: LatLon
  if (d + b.radiusNm <= a.radiusNm) center = a.center
  else if (d + a.radiusNm <= b.radiusNm) center = b.center
  else {
    const radius = (d + a.radiusNm + b.radiusNm) / 2
    const bearing = initialBearing(a.center, b.center)
    center = destinationPoint(a.center, bearing, nmToKm(radius - a.radiusNm))
  }
  const rounded = { lat: roundCoordinate(center.lat), lon: roundCoordinate(center.lon) }
  const needed = Math.max(
    distanceNm(rounded, a.center) + a.radiusNm,
    distanceNm(rounded, b.center) + b.radiusNm,
  )
  return { center: rounded, radiusNm: Math.max(1, Math.ceil(needed - EPSILON_NM)) }
}

function planned(
  id: string,
  kind: CircleKind,
  circle: Readonly<CoverageCircle>,
  covers: string[],
): PlannedCircle {
  return {
    id,
    kind,
    center: { lat: circle.center.lat, lon: circle.center.lon },
    radiusNm: circle.radiusNm,
    covers,
  }
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Kapsama planı. Aynı ICAO iki kez gelirse ilki kullanılır; birden çok birincil varsa listedeki
 * ilki birincildir. Sıra deterministiktir: batı, istasyon çemberleri (ICAO sırasıyla), birincil,
 * Doğu. Aynı istasyon kümesi hangi sırada gelirse gelsin aynı plan çıkar.
 */
export function coveragePlan(stations: readonly StationInput[]): PlannedCircle[] {
  const seen = new Set<string>()
  const entries: { station: StationInput; p0: CoverageCircle }[] = []
  for (const station of stations) {
    if (seen.has(station.icao)) continue
    seen.add(station.icao)
    entries.push({ station, p0: p0Circle(station) })
  }
  const coveredBy = (circle: Readonly<CoverageCircle>) =>
    entries
      .filter((e) => containsCircle(circle, e.p0))
      .map((e) => e.station.icao)
      .sort(compareText)

  const plan: PlannedCircle[] = []
  const westCovers = coveredBy(WEST_CIRCLE)
  if (westCovers.length > 0) plan.push(planned('west', 'west', WEST_CIRCLE, westCovers))

  // Batıya sığmayanlar: her biri için ≤ 250 NM'de birleşebileceği en yakın ortak aranır (açgözlü).
  const outside = entries
    .filter((e) => !westCovers.includes(e.station.icao))
    .sort((a, b) => compareText(a.station.icao, b.station.icao))
  const assigned = new Set<string>()
  for (const entry of outside) {
    if (assigned.has(entry.station.icao)) continue
    let best: { circle: CoverageCircle; partner: string } | null = null
    for (const other of outside) {
      if (other === entry || assigned.has(other.station.icao)) continue
      const merged = enclosingCircle(entry.p0, other.p0)
      if (merged.radiusNm > MAX_CIRCLE_NM) continue
      if (best === null || merged.radiusNm < best.circle.radiusNm) {
        best = { circle: merged, partner: other.station.icao }
      }
    }
    const members = best
      ? [entry.station.icao, best.partner].sort(compareText)
      : [entry.station.icao]
    const circle: CoverageCircle = best
      ? best.circle
      : { center: entry.p0.center, radiusNm: requestRadius(entry.p0.radiusNm) }
    // Çemberin kendi istasyonları, P0'ı (250 NM'ye kırpıldığı için) taşsa bile kapsanmış sayılır.
    const covers = [...new Set([...members, ...coveredBy(circle)])].sort(compareText)
    for (const icao of covers) assigned.add(icao)
    plan.push(planned(`station-${members.join('-')}`, 'station', circle, covers))
  }

  const primary = entries.find((e) => e.station.isPrimary)
  if (primary) {
    const circle = { center: primary.p0.center, radiusNm: PRIMARY_EXTRA_RADIUS_NM }
    plan.push({
      ...planned('primary', 'primary', circle, coveredBy(circle)),
      primaryIcao: primary.station.icao,
    })
  }
  plan.push(planned('east', 'east', EAST_CIRCLE, coveredBy(EAST_CIRCLE)))
  return plan
}

/** Tazelik hedefleri (ms): data-sources.md §1 ve D-073. */
export const FRESHNESS_TARGETS_MS = {
  primary: 20_000,
  watch: 30_000,
  stations: 30_000,
  east: 90_000,
} as const

export type FreshnessTargets = Record<keyof typeof FRESHNESS_TARGETS_MS, number>

export type PlannedRequest = { kind: 'circle'; circle: PlannedCircle } | { kind: 'watch' }

/** Çember ve son başarılı çekiminin işlendiği an (ms); hiç çekilmediyse null. */
export interface CircleFetch {
  circle: PlannedCircle
  fetchedAt: number | null
}

type JobKind = 'primary' | 'watch' | 'station' | 'east'

interface Job {
  readonly id: string
  readonly kind: JobKind
  /** Önem: küçük olan önce gelir. */
  readonly rank: number
  readonly targetMs: number
  readonly order: number
}

/** data-sources.md "Bütçe yetmezse": önce Doğu, sonra istasyonlar düşer; birincil ve P1 en son. */
const RANK: Record<JobKind, number> = { primary: 0, watch: 0, station: 1, east: 2 }
const PRIMARY_JOB = 'primary'
const WATCH_JOB = 'watch'
const EAST_JOB = 'east'
const stationJob = (icao: string) => `station:${icao}`
/** Benzetim ufkunun üst sınırı (slot sayısı). */
const MAX_HORIZON_SLOTS = 64

type LastServed = Map<string, number>

export class RequestScheduler {
  private readonly plan: readonly PlannedCircle[]
  private readonly jobs: readonly Job[]
  private readonly stationJobs: readonly Job[]
  /** Çember id → karşıladığı işler. */
  private readonly serves = new Map<string, readonly string[]>()
  /** İş id → onu karşılayan çemberler (plan sırasıyla). */
  private readonly servedBy = new Map<string, readonly PlannedCircle[]>()
  private readonly last: LastServed = new Map()
  private readonly circleLast = new Map<string, number>()
  private readonly watchTargetMs: number
  /** Hedefi takip hedefinden uzun olmayan bir işi karşılayan çemberler (plan sırasıyla). */
  private readonly watchPlan: readonly PlannedCircle[]

  constructor(plan: readonly PlannedCircle[], opts: { targets?: Partial<FreshnessTargets> } = {}) {
    if (plan.length === 0) throw new Error('coverage plan is empty')
    if (new Set(plan.map((c) => c.id)).size !== plan.length) {
      throw new Error('coverage plan has duplicate circle ids')
    }
    const targets: FreshnessTargets = {
      primary: opts.targets?.primary ?? FRESHNESS_TARGETS_MS.primary,
      watch: opts.targets?.watch ?? FRESHNESS_TARGETS_MS.watch,
      stations: opts.targets?.stations ?? FRESHNESS_TARGETS_MS.stations,
      east: opts.targets?.east ?? FRESHNESS_TARGETS_MS.east,
    }
    for (const [name, value] of Object.entries(targets)) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`freshness target must be a positive number: ${name}`)
      }
    }
    this.plan = plan

    const primaryIcao = plan.find((c) => c.kind === 'primary')?.primaryIcao ?? null
    for (const circle of plan) {
      const jobs = new Set<string>()
      if (circle.kind === 'primary') jobs.add(PRIMARY_JOB)
      for (const icao of circle.covers) {
        jobs.add(icao === primaryIcao ? PRIMARY_JOB : stationJob(icao))
      }
      if (circle.kind === 'east') jobs.add(EAST_JOB)
      this.serves.set(circle.id, [...jobs])
      for (const job of jobs) this.servedBy.set(job, [...(this.servedBy.get(job) ?? []), circle])
    }

    const stationIcaos = [
      ...new Set(plan.flatMap((c) => c.covers).filter((icao) => icao !== primaryIcao)),
    ].sort(compareText)
    const jobs: Omit<Job, 'order'>[] = []
    if (this.servedBy.has(PRIMARY_JOB)) {
      jobs.push({ id: PRIMARY_JOB, kind: 'primary', rank: RANK.primary, targetMs: targets.primary })
    }
    jobs.push({ id: WATCH_JOB, kind: 'watch', rank: RANK.watch, targetMs: targets.watch })
    for (const icao of stationIcaos) {
      jobs.push({
        id: stationJob(icao),
        kind: 'station',
        rank: RANK.station,
        targetMs: targets.stations,
      })
    }
    if (this.servedBy.has(EAST_JOB)) {
      jobs.push({ id: EAST_JOB, kind: 'east', rank: RANK.east, targetMs: targets.east })
    }
    this.jobs = jobs.map((job, order) => ({ ...job, order }))
    this.stationJobs = this.jobs.filter((j) => j.kind === 'station')
    this.watchTargetMs = targets.watch
    const targetOf = new Map(this.jobs.map((j) => [j.id, j.targetMs]))
    this.watchPlan = plan.filter((circle) =>
      (this.serves.get(circle.id) ?? []).some(
        (id) => (targetOf.get(id) ?? Infinity) <= targets.watch,
      ),
    )
  }

  /**
   * `now` anında atılacak isteği seçer; sonraki slot `slotMs` sonra beklenir. `watchDueAt`: takip
   * listesinde `/v2/hex` ile izlenecek (çemberlerin karşılamadığı) uçak yoksa null; varsa takip
   * isteğinin son tarihi (ms), yani izlenen uçakların en eski örnek zamanı + takip hedefi.
   */
  next(now: number, slotMs: number, watchDueAt: number | null): PlannedRequest {
    const active = this.jobs.filter((j) => j.kind !== 'watch' || watchDueAt !== null)
    if (active.length === 0) return this.fallback()
    // Son tarih `son karşılanma + hedef` diye hesaplandığından takip işi için eşdeğer an yazılır.
    const last: LastServed = new Map(this.last)
    if (watchDueAt === null) last.delete(WATCH_JOB)
    else last.set(WATCH_JOB, watchDueAt - this.watchTargetMs)
    const job = this.choose(now, slotMs, active, last, true)
    return this.requestFor(job, now, slotMs, active, last) ?? this.fallback()
  }

  /**
   * Takip listesi için kapsama: hedefi takip hedefini (30 sn) aşmayan bir işi karşılayan
   * çemberler (batı, istasyon ve birincil çemberleri; yalnızca Doğu'yu karşılayan Doğu çemberi
   * değil) ve son çekilme anları. İçlerinden birinde görülen uçak için `/v2/hex` gerekmez.
   */
  watchCircles(): CircleFetch[] {
    return this.watchPlan.map((circle) => ({
      circle,
      fetchedAt: this.circleLast.get(circle.id) ?? null,
    }))
  }

  /** İsteğin karşılandığını işler (yalnızca başarılı yanıttan sonra çağrılır). */
  served(req: PlannedRequest, at: number): void {
    if (req.kind === 'circle' && this.serves.has(req.circle.id)) {
      const previous = this.circleLast.get(req.circle.id)
      this.circleLast.set(req.circle.id, previous === undefined ? at : Math.max(previous, at))
    }
    this.apply(req, at, this.last)
  }

  /**
   * İş başına son karşılanma zamanı (ms) ya da null: `primary`, `stations` (istasyonların en
   * eskisi; biri hiç karşılanmadıysa null), `east`, `watch` ve her istasyon çemberinin id'si.
   */
  lastServed(): Record<string, number | null> {
    const out: Record<string, number | null> = {}
    if (this.servedBy.has(PRIMARY_JOB)) out.primary = this.last.get(PRIMARY_JOB) ?? null
    if (this.stationJobs.length > 0) {
      let oldest: number | null = Infinity
      for (const job of this.stationJobs) {
        const at = this.last.get(job.id)
        if (at === undefined) {
          oldest = null
          break
        }
        oldest = Math.min(oldest, at)
      }
      out.stations = oldest
    }
    if (this.servedBy.has(EAST_JOB)) out.east = this.last.get(EAST_JOB) ?? null
    out.watch = this.last.get(WATCH_JOB) ?? null
    for (const circle of this.plan) {
      if (circle.kind === 'station') out[circle.id] = this.circleLast.get(circle.id) ?? null
    }
    return out
  }

  private deadline(job: Job, last: LastServed): number {
    const at = last.get(job.id)
    return at === undefined ? -Infinity : at + job.targetMs
  }

  /**
   * Zorunlu işlerin sırası: önem; eşit önemde önce şimdi çekilirse son tarihini tutturacak iş
   * (bir slot ertelenirse kaçıracak olan), sonra son tarihini zaten kaçırmış iş; her grupta erken
   * son tarih. Böylece yeni doğan ve zaten gecikmiş takip işi, sırası gelmiş birincil çekimin
   * slotunu almaz; bir sonraki slotta çekilir.
   */
  private byImportance(last: LastServed, now: number) {
    const missed = (job: Job) => (this.deadline(job, last) < now ? 1 : 0)
    return (a: Job, b: Job) =>
      a.rank - b.rank ||
      missed(a) - missed(b) ||
      this.deadline(a, last) - this.deadline(b, last) ||
      a.order - b.order
  }

  private byDeadline(last: LastServed) {
    return (a: Job, b: Job) =>
      this.deadline(a, last) - this.deadline(b, last) || a.rank - b.rank || a.order - b.order
  }

  /** Sıralamada ilk gelen iş; liste boş değildir. */
  private best(jobs: readonly Job[], compare: (a: Job, b: Job) => number): Job {
    let best = jobs[0] as Job
    for (const job of jobs) if (compare(job, best) < 0) best = job
    return best
  }

  private choose(
    now: number,
    slotMs: number,
    active: readonly Job[],
    last: LastServed,
    lookahead: boolean,
  ): Job {
    const must = active.filter((j) => now + slotMs > this.deadline(j, last))
    let job =
      must.length > 0
        ? this.best(must, this.byImportance(last, now))
        : this.best(active, this.byDeadline(last))
    if (!lookahead) return job
    // Daha az önemli işe slot verilecekse önemli işlerin son tarihleri korunuyor mu?
    for (;;) {
      const rank = job.rank
      const higher = active.filter((j) => j.rank < rank)
      if (higher.length === 0) return job
      const req = this.requestFor(job, now, slotMs, active, last)
      if (req && this.keepsDeadlines(now, slotMs, req, higher, last)) return job
      job = this.best(higher, this.byDeadline(last))
    }
  }

  /**
   * `req` şimdi atılırsa, sonraki slotlarda yalnızca `higher` işler (aynı kuralla, önden bakmadan)
   * karşılanarak hiçbiri son tarihini kaçırmıyor mu? Benzetimde gecikme 0 alınır (temkinli).
   */
  private keepsDeadlines(
    now: number,
    slotMs: number,
    req: PlannedRequest,
    higher: readonly Job[],
    last: LastServed,
  ): boolean {
    const sim: LastServed = new Map(last)
    this.apply(req, now, sim)
    const longest = Math.max(...higher.map((j) => j.targetMs))
    const horizon =
      Number.isFinite(slotMs) && slotMs > 0
        ? Math.min(MAX_HORIZON_SLOTS, Math.ceil(longest / slotMs) + 1)
        : 1
    for (let i = 1; i <= horizon; i += 1) {
      const t = now + i * slotMs
      if (higher.some((j) => this.deadline(j, sim) < t)) return false
      const job = this.choose(t, slotMs, higher, sim, false)
      const next = this.requestFor(job, t, slotMs, higher, sim)
      if (next) this.apply(next, t, sim)
    }
    return true
  }

  /**
   * İşi karşılayacak istek. Birden çok çember karşılıyorsa bir slot içinde sırası gelecek
   * (son tarihi ≤ now + 2 slot) başka işleri de en çok karşılayan seçilir; eşitlikte küçük çember
   * (yanıt küçük), sonra plan sırası. Birincil için bu kural şuna denk gelir: bir istasyonun sırası
   * geliyorsa batı, gelmiyorsa 40 NM birincil çemberi.
   */
  private requestFor(
    job: Job,
    now: number,
    slotMs: number,
    active: readonly Job[],
    last: LastServed,
  ): PlannedRequest | null {
    if (job.kind === 'watch') return { kind: 'watch' }
    const candidates = this.servedBy.get(job.id) ?? []
    const soonLimit = now + 2 * slotMs
    const soon = new Set(
      active.filter((j) => j !== job && this.deadline(j, last) <= soonLimit).map((j) => j.id),
    )
    let best: { circle: PlannedCircle; score: number } | null = null
    for (const circle of candidates) {
      const score = (this.serves.get(circle.id) ?? []).filter((id) => soon.has(id)).length
      if (
        best === null ||
        score > best.score ||
        (score === best.score && circle.radiusNm < best.circle.radiusNm)
      ) {
        best = { circle, score }
      }
    }
    return best ? { kind: 'circle', circle: best.circle } : null
  }

  private apply(req: PlannedRequest, at: number, last: LastServed): void {
    const jobs = req.kind === 'watch' ? [WATCH_JOB] : (this.serves.get(req.circle.id) ?? [])
    for (const id of jobs) {
      const previous = last.get(id)
      last.set(id, previous === undefined ? at : Math.max(previous, at))
    }
  }

  /** Hiçbir işi karşılamayan (elle kurulmuş) planda ilk çember çekilir. */
  private fallback(): PlannedRequest {
    const first = this.plan[0]
    if (!first) throw new Error('coverage plan is empty')
    return { kind: 'circle', circle: first }
  }
}
