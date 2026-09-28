/** Admin "Servisler" panelinde gösterilen servis durumları (API ↔ web ortak sözleşme). */

export type ServiceState = 'ok' | 'degraded' | 'down' | 'not_configured'

export type ServiceKind =
  'web' | 'api' | 'worker' | 'postgres' | 'redis' | 'analytics' | 'data' | 'provider'

export interface ServiceStatus {
  /**
   * Kararlı kimlik: web, api, worker:worker-rt, postgres, redis-queue, redis-live, analytics,
   * reference-data, track-partitions, provider:adsbLol, provider:localReceiver (canlı veri
   * sağlayıcıları; worker'ın provider_health kaydından).
   */
  id: string
  kind: ServiceKind
  state: ServiceState
  version: string | null
  latencyMs: number | null
  /** Ek bilgiler (ör. bellek, heartbeat yaşı); anahtarlar i18n'de etiketlenir. */
  detail: Record<string, string | number | null>
  checkedAt: string
}

export interface ServicesReport {
  checkedAt: string
  overall: ServiceState
  services: ServiceStatus[]
}

const SEVERITY: Record<ServiceState, number> = { ok: 0, not_configured: 0, degraded: 1, down: 2 }

/** Genel durum: en kötü servis durumu (yapılandırılmamış servisler genel durumu bozmaz). */
export function overallState(services: readonly ServiceStatus[]): ServiceState {
  let worst: ServiceState = 'ok'
  for (const service of services) {
    if (SEVERITY[service.state] > SEVERITY[worst]) worst = service.state
  }
  return worst
}
