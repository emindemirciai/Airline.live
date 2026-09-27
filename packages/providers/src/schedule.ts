import type { ProviderLicense } from './license'

/**
 * Tarife sağlayıcısı arayüzü (yalnızca tip; uygulaması Parça 5'te, ticari sağlayıcıyla).
 * v1'de tarife verisi yoktur: sefer no → çağrı kodu dönüşümü VRS havayolu tablosuyla, istasyon
 * panosu canlı veriyle yapılır (CLAUDE.md → Veri kaynakları).
 */

export interface ScheduledFlight {
  /** Pazarlama sefer numarası (ör. TK1985). */
  flightNumber: string
  /** ICAO çağrı kodu (ör. THY1985); sağlayıcı bilmiyorsa null. */
  callsign: string | null
  originIcao: string | null
  destinationIcao: string | null
  /** Tarifeli kalkış ve varış, UTC epoch ms. */
  scheduledDeparture: number | null
  scheduledArrival: number | null
  /** Tahmini ya da gerçekleşen zamanlar (sağlayıcı veriyorsa). */
  estimatedDeparture: number | null
  estimatedArrival: number | null
  status: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown'
}

export interface BoardWindow {
  /** UTC epoch ms aralığı. */
  from: number
  to: number
  direction: 'arrivals' | 'departures'
}

export interface ScheduleProvider {
  readonly license: ProviderLicense
  /** Sefer numarasını belirli bir günün (UTC, YYYY-MM-DD) tarifeli uçuşlarına çevirir. */
  resolveFlightNumber(flightNumber: string, date: string): Promise<ScheduledFlight[]>
  /** İstasyonun varış ya da kalkış panosu. */
  getStationBoard(stationIcao: string, window: BoardWindow): Promise<ScheduledFlight[]>
}
