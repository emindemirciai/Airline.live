import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { stations } from './schema'

/**
 * Tohum istasyonları (domain.md → Terimler). IST birincildir. Geoid ondülasyonu yalnızca
 * domain.md'de değeri verilen LTFM için yazılır; diğerleri boş kalır ve AGL hesabı sıradaki
 * yönteme düşer (D-066).
 */
export const SEED_STATIONS = [
  { icao: 'LTFM', iata: 'IST', isPrimary: true, geoidUndulationM: 37.05 },
  { icao: 'LTFJ', iata: 'SAW', isPrimary: false, geoidUndulationM: null },
  { icao: 'LTAC', iata: 'ESB', isPrimary: false, geoidUndulationM: null },
  { icao: 'LTBJ', iata: 'ADB', isPrimary: false, geoidUndulationM: null },
  { icao: 'LTAI', iata: 'AYT', isPrimary: false, geoidUndulationM: null },
] as const

/**
 * İdempotent: var olan istasyon (yöneticinin değiştirdikleri dahil) olduğu gibi kalır; başka bir
 * istasyon birincil yapılmışsa tek-birincil kısıtı çakışması da atlanır. Eklenen satır sayısını döner.
 */
export async function seedStations(db: PostgresJsDatabase): Promise<number> {
  const inserted = await db
    .insert(stations)
    .values(SEED_STATIONS.map((station) => ({ ...station })))
    .onConflictDoNothing()
    .returning({ icao: stations.icao })
  return inserted.length
}
