import {
  ADSBLOL_BUDGET_FLOOR_PERCENT,
  ADSBLOL_BUDGET_RAISE_EVERY_MS,
  ADSBLOL_BUDGET_RAISE_PERCENT,
  ADSBLOL_BUDGET_RAISE_QUIET_MS,
  ADSBLOL_BUDGET_SHRINK_PERCENT,
  ADSBLOL_BUDGET_WINDOW_MS,
  effectiveAdsbLolCap,
  type AdsbLolBudgetView,
  type BudgetReservation,
} from '@havayolu/db'
import type { BudgetStore } from '../budget'

/**
 * Bellek içi bütçe deposu (yalnız test). `@havayolu/db` `reserveAdsbLolRequest` Lua betiğinin
 * birebir karşılığıdır; `budget.int.test.ts` aynı işlem dizisini gerçek redis-queue'ya karşı
 * koşturup iki deponun aynı kararları verdiğini denetler.
 */
export class MemoryBudgetStore implements BudgetStore {
  readonly configured: number
  requests: number[] = []
  seq = 0
  state: {
    cap: number | null
    serverDaily: number | null
    blockedUntil: number
    lastRateLimitAt: number
    lastCapChangeAt: number
  } = { cap: null, serverDaily: null, blockedUntil: 0, lastRateLimitAt: 0, lastCapChangeAt: 0 }
  /** `reserve` çağrısı sayısı (izin verilsin verilmesin). */
  calls = 0
  /** true: depoya erişilemiyor (Redis kesintisi). */
  failing = false

  constructor(configured: number) {
    this.configured = configured
  }

  private check(): void {
    if (this.failing) throw new Error('connection refused')
  }

  async reserve(now: number): Promise<BudgetReservation> {
    this.check()
    this.calls += 1
    const window = ADSBLOL_BUDGET_WINDOW_MS
    this.requests = this.requests.filter((t) => t > now - window).sort((a, b) => a - b)
    const st = this.state
    if (
      st.cap !== null &&
      st.cap < this.configured &&
      now - st.lastRateLimitAt >= ADSBLOL_BUDGET_RAISE_QUIET_MS &&
      now - st.lastCapChangeAt >= ADSBLOL_BUDGET_RAISE_EVERY_MS
    ) {
      st.cap = Math.min(
        this.configured,
        st.cap + Math.ceil((this.configured * ADSBLOL_BUDGET_RAISE_PERCENT) / 100),
      )
      st.lastCapChangeAt = now
    }
    // Sert sınır daraltmasızdır; 429 daraltması yalnız aralığı genişletir (betikle aynı).
    const hardCap = effectiveAdsbLolCap(this.configured, null, st.serverDaily)
    const cap = effectiveAdsbLolCap(this.configured, st.cap, st.serverDaily)
    const count = this.requests.length
    const blocked = st.blockedUntil > now ? st.blockedUntil : null
    const deny = (retryAt: number, decision: BudgetReservation['decision']) => ({
      granted: false,
      retryAt,
      used: count,
      cap,
      seq: this.seq,
      decision,
      blockedUntil: blocked,
    })
    if (cap < 1) return deny(now + 3_600_000, 'no_cap')
    if (st.blockedUntil > now) return deny(st.blockedUntil, 'blocked')
    if (count >= hardCap) {
      return deny((this.requests[count - hardCap] as number) + window, 'cap')
    }
    const spacing = Math.floor(window / cap)
    const newest = this.requests.at(-1)
    if (newest !== undefined && now < newest + spacing) return deny(newest + spacing, 'spacing')
    this.requests.push(now)
    this.seq += 1
    return {
      granted: true,
      retryAt: now + spacing,
      used: count + 1,
      cap,
      seq: this.seq,
      decision: 'granted',
      blockedUntil: blocked,
    }
  }

  async rateLimited(now: number, waitMs: number): Promise<{ cap: number; blockedUntil: number }> {
    this.check()
    const current = Math.min(this.state.cap ?? this.configured, this.configured)
    const floor = Math.max(1, Math.floor((this.configured * ADSBLOL_BUDGET_FLOOR_PERCENT) / 100))
    const cap = Math.max(floor, Math.floor((current * ADSBLOL_BUDGET_SHRINK_PERCENT) / 100))
    const blockedUntil = Math.max(this.state.blockedUntil, now + Math.ceil(waitMs))
    this.state = { ...this.state, cap, blockedUntil, lastRateLimitAt: now, lastCapChangeAt: now }
    return { cap, blockedUntil }
  }

  async serverLimit(_now: number, dailyQuota: number): Promise<void> {
    this.check()
    this.state.serverDaily = dailyQuota
  }

  async read(now: number): Promise<AdsbLolBudgetView> {
    this.check()
    return {
      used: this.requests.filter((t) => t > now - ADSBLOL_BUDGET_WINDOW_MS).length,
      cap: effectiveAdsbLolCap(this.configured, this.state.cap, this.state.serverDaily),
      blockedUntil: this.state.blockedUntil > now ? this.state.blockedUntil : null,
      serverDaily: this.state.serverDaily,
    }
  }
}
