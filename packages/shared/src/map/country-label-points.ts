/**
 * Ülke adı noktaları (D-095, D-100): üretilen yerleşim tablosundan (`COUNTRY_LABEL_PLACEMENTS`,
 * `COUNTRY_LABEL_AREAS_KM2`) haritanın kaynak verisi. Paketin ana girişinde değildir; web haritası
 * bu modülü `@havayolu/shared/country-label-points` alt yolundan dinamik importla yükler (tablo
 * hiçbir sayfanın ilk paketine girmez; MapLibre ile paralel iner).
 */
import type { Locale } from '../locale'
import { countryLabelTier } from '../reference/country-label-set'
import { COUNTRY_LABEL_AREAS_KM2, COUNTRY_LABEL_PLACEMENTS } from './country-label-placements'
import { countryLabelLines, type CountryLabelPoint } from './country-labels'

let ranked: readonly { code: string; areaKm2: number }[] | null = null

/** Ülkeler sırayla: Türkiye, sonra büyükten küçüğe (eşitlikte kod). İlk çağrıda kurulur. */
function rankedCountries(): readonly { code: string; areaKm2: number }[] {
  ranked ??= Object.entries(COUNTRY_LABEL_AREAS_KM2)
    .map(([code, areaKm2]) => ({ code, areaKm2 }))
    .sort((a, b) => {
      if (a.code === 'TR' || b.code === 'TR') return a.code === 'TR' ? -1 : 1
      return b.areaKm2 - a.areaKm2 || (a.code < b.code ? -1 : 1)
    })
  return ranked
}

/**
 * Ülke adı noktaları, sırayla (rank 0'dan): yer ve ilk yakınlaştırma `COUNTRY_LABEL_PLACEMENTS`'tan,
 * sayfanın dilinde ve haritanın genişliğine göre. Hiç sığmayan ad yoktur.
 */
export function countryLabelPoints(locale: Locale, compact: boolean): CountryLabelPoint[] {
  const placements = COUNTRY_LABEL_PLACEMENTS[locale]
  const points: CountryLabelPoint[] = []
  for (const [rank, country] of rankedCountries().entries()) {
    const row = Object.hasOwn(placements, country.code) ? placements[country.code] : undefined
    const placement = row?.[compact ? 'compact' : 'regular']
    if (!row || !placement) continue
    const [lon, lat, fitZoom] = placement
    points.push({
      lat,
      lon,
      properties: {
        code: country.code,
        name: row.name,
        label: countryLabelLines(row.name, locale).join('\n'),
        tier: countryLabelTier(country),
        fitZoom,
        rank,
      },
    })
  }
  return points
}
