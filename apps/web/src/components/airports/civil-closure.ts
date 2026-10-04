import { format, formatSinceYear } from '@havayolu/i18n'
import { civilFlightClosure, type Locale } from '@havayolu/shared'

/**
 * Sivil uçuşlara kapalı olabilecek havalimanının notu (kullanıcı kararı 2026-10-04, D-090): "Sivil
 * uçuşlara kapalı olabilir (2022’den beri)" / "May be closed to civil flights (since 2022)". Küratörlü
 * liste `@havayolu/shared` → `civilFlightClosure`'dadır; havalimanı listede değilse null. Havalimanı
 * sayfası ve harita penceresi aynı işlevi kullanır; şablon dilin metnidir (`airport.civilClosure`,
 * `map.airportPopup.civilClosure`). İstemci paketine girer: `getMessages` çağırmaz.
 */
export function civilClosureNote(icao: string, locale: Locale, template: string): string | null {
  const closure = civilFlightClosure(icao)
  if (closure === undefined) return null
  const year = Number(closure.since.slice(0, 4))
  return format(template, { since: formatSinceYear(year, locale) })
}
