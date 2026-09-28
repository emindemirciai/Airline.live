import { cruiseScenario } from './cruise'
import type { Scenario } from './types'

/**
 * Deterministik sentetik trafik senaryoları (yalnızca geliştirme ve test; D-073). Replay alıcısı
 * bunları readsb `aircraft.json` olarak sunar, worker `localReceiver` yoluyla okur.
 */

export type { ReadsbAircraft, ReadsbFrame, Scenario } from './types'
export {
  APPROACH_NUMBER,
  APPROACH_PROFILE,
  CRUISE_ALTITUDE_FT,
  CRUISE_ROUTES,
  CRUISE_SCENARIO_NAME,
  cruiseFleet,
  cruiseScenario,
  DEFAULT_CRUISE_COUNT,
  GEOM_OFFSET_FT,
  MAX_CRUISE_COUNT,
  SEEN_POS_S,
  SEEN_S,
  syntheticIdentity,
  TAXI_LOOP,
  TAXI_NUMBER,
  TAXI_SPEED_KT,
  type CruiseFlight,
  type SyntheticIdentity,
} from './cruise'
export { AIRPORTS, LTFM_35L, type AirportCode, type ScenarioAirport } from './airports'

export const SCENARIO_NAMES = ['cruise'] as const
export type ScenarioName = (typeof SCENARIO_NAMES)[number]

export function isScenarioName(value: string): value is ScenarioName {
  return (SCENARIO_NAMES as readonly string[]).includes(value)
}

export interface ScenarioOptions {
  /** Seyir uçağı sayısı (cruise). */
  count?: number
}

export function createScenario(name: ScenarioName, opts: ScenarioOptions = {}): Scenario {
  switch (name) {
    case 'cruise':
      return cruiseScenario(opts)
  }
}
