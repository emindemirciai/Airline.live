/**
 * adsb.lol hız kovası (D-073, data-sources.md §1 "Hız kontrolü"):
 * - tek jetonlu kova, patlama yok: iki istek arası en az 1000/hız ms
 * - AIMD: 429/420'de hız yarıya iner (alt sınır), her temiz 10 dk'da %10 artar (üst sınır)
 * - 429/420 beklemesi: Retry-After varsa o, yoksa tam jitter'lı üstel merdiven
 * - 5xx, ağ hatası ve bozuk yanıt: ayrı jitter'lı merdiven; 5 kez üst üste gelirse devre 60 sn
 *   açılır, yarı açık tek deneme başarısızsa süre ikiye katlanır (en fazla 10 dk)
 * - 401/403 (`config`): devre kalıcı açılır; süreç yeniden başlayana kadar istek atılmaz
 *
 * Saf modüldür: saat (`now`) ve rastgelelik (`random`) dışarıdan verilir, IO yapmaz.
 */

export const ADSBLOL_RATE = {
  floorRps: 0.05,
  ceilingRps: 0.2,
  startRps: 0.1,
  increaseFactor: 1.1,
  cleanWindowMs: 600_000,
  backoffLadderMs: [15_000, 30_000, 60_000, 120_000, 240_000, 300_000],
  breakerThreshold: 5,
  breakerOpenMs: 60_000,
  breakerMaxOpenMs: 600_000,
} as const

/** Bir isteğin sonucu; hata türleri `AdsbLolErrorKind` ile aynıdır (D-071). */
export type OutcomeKind =
  'success' | 'rate_limit' | 'server' | 'network' | 'response' | 'request' | 'config'

export type CircuitState = 'closed' | 'open' | 'half_open' | 'config'

export interface RateControllerOptions {
  startRps: number
  floorRps?: number
  ceilingRps?: number
  now: () => number
  random: () => number
}

export interface RateState {
  rps: number
  circuit: CircuitState
  /** 429 ya da hata beklemesinin veya açık devrenin bittiği an (ms); bekleme yoksa null. */
  backoffUntil: number | null
  /** Devre kesiciyi besleyen (5xx, ağ, bozuk yanıt) üst üste hata sayısı. */
  consecutiveFailures: number
  /** Geçerli temiz pencerenin başlangıcı (ms). */
  cleanSince: number
}

/** Devre kesiciyi besleyen sonuçlar: sunucu ya da yol kaynaklı hatalar. */
export function isBreakerFailure(outcome: OutcomeKind): boolean {
  return outcome === 'server' || outcome === 'network' || outcome === 'response'
}

function ladderStepMs(attempt: number): number {
  const ladder: readonly number[] = ADSBLOL_RATE.backoffLadderMs
  return ladder[Math.min(attempt, ladder.length - 1)] ?? 0
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 1)
}

export class AdaptiveRateController {
  private readonly now: () => number
  private readonly random: () => number
  private readonly floorRps: number
  private readonly ceilingRps: number
  private currentRps: number
  private circuit: CircuitState = 'closed'
  private lastAcquireAt: number | null = null
  /** 429/420 beklemesinin sonu. */
  private rateLimitUntil: number | null = null
  /** Devre kapalıyken 5xx/ağ/bozuk yanıt beklemesinin sonu. */
  private failureUntil: number | null = null
  private rateLimitAttempts = 0
  private failureAttempts = 0
  private consecutiveFailures = 0
  private openMs: number = ADSBLOL_RATE.breakerOpenMs
  private openUntil: number | null = null
  /** Yarı açık devrede tek deneme isteği yolda mı. */
  private probeInFlight = false
  private cleanSince: number

  constructor(opts: RateControllerOptions) {
    const floorRps = opts.floorRps ?? ADSBLOL_RATE.floorRps
    const ceilingRps = opts.ceilingRps ?? ADSBLOL_RATE.ceilingRps
    if (!Number.isFinite(floorRps) || !Number.isFinite(ceilingRps) || floorRps <= 0) {
      throw new RangeError(`Hız sınırları geçersiz: alt ${floorRps}, üst ${ceilingRps} istek/sn`)
    }
    if (ceilingRps < floorRps) {
      throw new RangeError(`Hız üst sınırı (${ceilingRps}) alt sınırdan (${floorRps}) küçük`)
    }
    if (!Number.isFinite(opts.startRps) || opts.startRps < floorRps || opts.startRps > ceilingRps) {
      throw new RangeError(
        `Başlangıç hızı ${opts.startRps} istek/sn izinli aralığın dışında (${floorRps}–${ceilingRps})`,
      )
    }
    this.now = opts.now
    this.random = opts.random
    this.floorRps = floorRps
    this.ceilingRps = ceilingRps
    this.currentRps = opts.startRps
    this.cleanSince = opts.now()
  }

  rps(): number {
    return this.currentRps
  }

  /**
   * Sonraki isteğin başlayabileceği en erken an (ms). İzin varsa şimdiki zamandır; hiçbir zaman
   * şimdiden küçük değildir. Devre `config` iken ya da yarı açık devrenin deneme isteği yoldayken
   * Infinity döner: ilkinde süreç yeniden başlayana, ikincisinde denemenin sonucu `record` ile
   * bildirilene kadar istek atılmaz.
   */
  nextAllowedAt(): number {
    return this.allowedAt(this.now())
  }

  /** Şimdi izin varsa jetonu harcar (yarı açık devrede deneme isteğini başlatır); yoksa false. */
  tryAcquire(): boolean {
    const now = this.now()
    if (this.allowedAt(now) > now) return false
    this.lastAcquireAt = now
    if (this.circuit === 'half_open') this.probeInFlight = true
    return true
  }

  record(outcome: OutcomeKind, info?: { retryAfterSec?: number | null }): void {
    const now = this.now()
    this.advance(now)
    if (this.circuit === 'config') return
    switch (outcome) {
      case 'success':
        this.onSuccess(now)
        return
      case 'rate_limit':
        this.onRateLimit(now, info?.retryAfterSec ?? null)
        return
      case 'server':
      case 'network':
      case 'response':
        this.onFailure(now)
        return
      case 'request':
        // Kendi hatalı isteğimiz: sağlayıcının durumu hakkında bilgi vermez, hız değişmez.
        this.probeInFlight = false
        return
      case 'config':
        this.circuit = 'config'
        this.openUntil = null
        this.probeInFlight = false
        return
    }
  }

  state(): RateState {
    const now = this.now()
    this.advance(now)
    return {
      rps: this.currentRps,
      circuit: this.circuit,
      backoffUntil: this.waitUntil(),
      consecutiveFailures: this.consecutiveFailures,
      cleanSince: this.cleanSince,
    }
  }

  /** Süresi dolan beklemeleri temizler; açık devre süresi dolunca yarı açığa geçer. */
  private advance(now: number): void {
    if (this.circuit === 'open' && this.openUntil !== null && now >= this.openUntil) {
      this.circuit = 'half_open'
      this.openUntil = null
      this.probeInFlight = false
    }
    if (this.rateLimitUntil !== null && now >= this.rateLimitUntil) this.rateLimitUntil = null
    if (this.failureUntil !== null && now >= this.failureUntil) this.failureUntil = null
  }

  private allowedAt(now: number): number {
    this.advance(now)
    if (this.circuit === 'config') return Infinity
    if (this.circuit === 'half_open' && this.probeInFlight) return Infinity
    let at = now
    if (this.lastAcquireAt !== null) at = Math.max(at, this.lastAcquireAt + 1000 / this.currentRps)
    const wait = this.waitUntil()
    if (wait !== null) at = Math.max(at, wait)
    return at
  }

  private waitUntil(): number | null {
    if (this.circuit === 'config') return null
    let until: number | null = null
    for (const t of [this.rateLimitUntil, this.failureUntil, this.openUntil]) {
      if (t !== null && (until === null || t > until)) until = t
    }
    return until
  }

  private onSuccess(now: number): void {
    this.consecutiveFailures = 0
    this.failureAttempts = 0
    this.rateLimitAttempts = 0
    this.failureUntil = null
    this.probeInFlight = false
    if (this.circuit !== 'closed') {
      this.circuit = 'closed'
      this.openUntil = null
      this.openMs = ADSBLOL_RATE.breakerOpenMs
    }
    // Her tam temiz pencere bir adım; uzun boşluktan sonra da tek adım atılır (kademeli artış).
    const window = ADSBLOL_RATE.cleanWindowMs
    const elapsed = now - this.cleanSince
    if (elapsed >= window) {
      this.currentRps = Math.min(this.ceilingRps, this.currentRps * ADSBLOL_RATE.increaseFactor)
      this.cleanSince += Math.floor(elapsed / window) * window
    }
  }

  private onRateLimit(now: number, retryAfterSec: number | null): void {
    this.currentRps = Math.max(this.floorRps, this.currentRps / 2)
    const waitMs =
      retryAfterSec !== null && Number.isFinite(retryAfterSec) && retryAfterSec >= 0
        ? retryAfterSec * 1000
        : clampUnit(this.random()) * ladderStepMs(this.rateLimitAttempts)
    this.rateLimitAttempts += 1
    this.rateLimitUntil = Math.max(this.rateLimitUntil ?? now, now + waitMs)
    this.cleanSince = now
    // 429 sunucunun ayakta olduğunu gösterir ama sağlığı hakkında karar vermez: devre yarı açık
    // kalır, bekleme bitince yeni deneme yapılır.
    this.probeInFlight = false
  }

  private onFailure(now: number): void {
    this.consecutiveFailures += 1
    this.cleanSince = now
    if (this.circuit === 'half_open') {
      this.open(now, Math.min(this.openMs * 2, ADSBLOL_RATE.breakerMaxOpenMs))
      return
    }
    if (this.circuit === 'open') return
    if (this.consecutiveFailures >= ADSBLOL_RATE.breakerThreshold) {
      this.open(now, ADSBLOL_RATE.breakerOpenMs)
      return
    }
    const waitMs = clampUnit(this.random()) * ladderStepMs(this.failureAttempts)
    this.failureAttempts += 1
    this.failureUntil = Math.max(this.failureUntil ?? now, now + waitMs)
  }

  /** Açık devrenin süresi hata merdiveninin yerini alır. */
  private open(now: number, ms: number): void {
    this.circuit = 'open'
    this.openMs = ms
    this.openUntil = now + ms
    this.failureUntil = null
    this.probeInFlight = false
  }
}
