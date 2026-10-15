import { format, formatSinceYear } from '@havayolu/i18n'
import { civilFlightClosure, type Locale } from '@havayolu/shared'

/** Kapanış notunun iki şablonu: kesin ve belirsiz kayıt (D-110 → "Not türü"). */
export interface CivilClosureTemplates {
  /** "Savaş nedeniyle sivil uçuşlara kapalı ({since} beri)" */
  confirmed: string
  /** "Savaş nedeniyle sivil uçuşlara kapalı olabilir ({since} beri)" */
  possible: string
}

/**
 * Savaş nedeniyle sivil uçuşlara kapalı havalimanının notu (D-110; ilk not D-090): kesin kayıtta
 * "Savaş nedeniyle sivil uçuşlara kapalı (2022’den beri)" / "Closed to civil flights because of the
 * war (since 2022)", belirsiz kayıtta "… kapalı olabilir (…)" / "May be closed …". Küratörlü tablo
 * `@havayolu/shared` → `civilFlightClosure`'dadır; havalimanı tabloda değilse null. Şablonu
 * kaydın `certainty` alanı seçer. Havalimanı sayfası, harita penceresi, havalimanı listesi, arama
 * sonucu açıklaması ve llms.txt aynı işlevi kullanır; şablonlar dilin metinleridir
 * (`airport.civilClosure`, `airport.civilClosurePossible`; pencerede `map.airportPopup.*`). İstemci
 * paketine girer: `getMessages` çağırmaz.
 */
export function civilClosureNote(
  icao: string,
  locale: Locale,
  templates: CivilClosureTemplates,
): string | null {
  const closure = civilFlightClosure(icao)
  if (closure === undefined) return null
  const year = Number(closure.since.slice(0, 4))
  const template = closure.certainty === 'confirmed' ? templates.confirmed : templates.possible
  return format(template, { since: formatSinceYear(year, locale) })
}

/** Dilin mesajlarından iki şablon (`airport.civilClosure`, `airport.civilClosurePossible`). */
export function civilClosureTemplates(messages: {
  civilClosure: string
  civilClosurePossible: string
}): CivilClosureTemplates {
  return { confirmed: messages.civilClosure, possible: messages.civilClosurePossible }
}
