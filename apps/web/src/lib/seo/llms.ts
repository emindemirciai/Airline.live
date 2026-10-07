import { format, formatDistance, getMessages, type Messages } from '@havayolu/i18n'
import {
  airportDisplayName,
  PROJECT,
  provinceName,
  type AirportDetail,
  type Locale,
} from '@havayolu/shared'
// Göreli yollar: vitest `@/` takma adını çözmez.
import {
  airportCountry,
  listedRadiusKm,
  sortByCountry,
} from '../../components/airports/airport-text'
import { AVIATION_WEATHER_URL } from '../../components/airports/weather-links'
import { isIndexable, splitByCountry } from '../airports'
import { localePath } from '../locale-routing'
import { DATA_ATTRIBUTION } from '../map-config'
import { TERMS_LINKS } from '../terms'
import { airportPath } from './paths'

/**
 * `/llms.txt` (öneri: https://llmstxt.org/, 2024-09-03). Dil modellerine sitenin kısa özetini ve
 * önemli sayfalarını verir. Metinler sayfalarla aynı kaynaktan gelir (`packages/i18n`: seo, about,
 * nav) ve havalimanı satırları sayfalarla aynı veriden kurulur; ikisi birbirinden ayrışamaz. Türkiye'deki
 * havalimanları kendi başlığı altında, diğer ülkelerdeki havalimanları (D-080, D-106) ayrı bir bölümde,
 * `/havalimanlari`'daki gibi ülkeye göre sıralıdır; Türkiye'ye uzaklık yazılmaz (D-106). Canlı veri
 * alanı (Hakkında → Yöntem'in kapsama cümlesi) ayrı satırdır.
 * Google Search bu dosyayı kullanmaz; ucuz ve zararsız olduğu için sunulur (M6b brief §d).
 * `llms-full.txt` ve sayfaların `.md` kopyaları yoktur. E-posta ya da kişisel veri yazılmaz.
 */
export interface LlmsInput {
  /** Sitenin kök adresi (`siteUrl()`). */
  base: URL
  appName: string
  /** Tüm havalimanları; yalnızca dizine eklenenler listelenir. */
  airports: readonly AirportDetail[]
}

/**
 * llms.txt biçiminde "Optional" başlığı özel anlam taşır (kısa bağlamda atlanabilecek bağlantılar);
 * biçimin anahtar kelimesidir, arayüz metni değildir.
 */
const OPTIONAL_SECTION = 'Optional'

function link(label: string, url: string): string {
  return `[${label.replaceAll('[', '(').replaceAll(']', ')')}](${url})`
}

/** Hangi havalimanlarının listelendiği ve diğer ülkelerdekilerin çoğunun canlı veri alanı dışında olduğu. */
function abroad(t: Messages, locale: Locale): string {
  const { method } = t.about
  const km = listedRadiusKm()
  const scope =
    km === null ? method.abroadAll : format(method.abroad, { km: formatDistance(km, { locale }) })
  return `${scope} ${method.abroadCoverage}`
}

/** Sitenin ne gösterip ne göstermediği, gizlilik kuralları ve veri kaynakları (bir dilde). */
function facts(t: Messages, locale: Locale): string[] {
  const { shows, limits, privacy, sources } = t.about
  return [
    `- ${shows.map}`,
    `- ${t.about.method.coverage}`,
    `- ${shows.airports} ${abroad(t, locale)}`,
    `- ${shows.weather} ${format(sources.weather, { source: link('aviationweather.gov', AVIATION_WEATHER_URL) })}`,
    `- ${limits.intro} ${[limits.times, limits.delays, limits.board].join('; ')}.`,
    `- ${privacy.military} ${privacy.registration}`,
    `- ${format(sources.live, {
      source: link(DATA_ATTRIBUTION.label, DATA_ATTRIBUTION.href),
      license: link(DATA_ATTRIBUTION.license, DATA_ATTRIBUTION.licenseHref),
    })} ${format(sources.reference, { source: link('OurAirports', TERMS_LINKS.ourAirports) })}`,
  ]
}

/** İl sırası `/havalimanlari` tablosundakiyle aynıdır (Türkçe alfabe), sonra ad. */
function byProvinceThenName(a: AirportDetail, b: AirportDetail): number {
  const province = (x: AirportDetail) => provinceName(x.isoRegion, 'tr') ?? x.isoRegion
  return (
    province(a).localeCompare(province(b), 'tr') ||
    airportDisplayName(a, 'tr').localeCompare(airportDisplayName(b, 'tr'), 'tr')
  )
}

/**
 * Pist sayısı notu; görünür pisti olmayan havalimanında not yazılmaz ("0 pist" yanlış olurdu: veri
 * yalnız kullanılabilir pist satırı olmadığını söyler). Sayfa açıklaması da aynı kuralla yazar
 * (`airportDescription`, D-101).
 */
function runwayNote(airport: AirportDetail, messages: Messages): string | null {
  return airport.runways.length > 0
    ? format(messages.seo.airport.runwaysCount, { count: airport.runways.length })
    : null
}

export function buildLlmsTxt(input: LlmsInput): string {
  const tr = getMessages('tr')
  const en = getMessages('en')
  const url = (locale: Locale, path: string) =>
    new URL(localePath(locale, path), input.base).toString()
  /** Aynı sayfanın iki dildeki bağlantısı: `[TR](…) · [EN](…/en…)`. */
  const pair = (path: string, label: (t: Messages) => string) =>
    `${link(label(tr), url('tr', path))} · ${link(label(en), url('en', path))}`

  const { turkey, foreign } = splitByCountry(input.airports.filter(isIndexable))
  const airportLines = turkey.toSorted(byProvinceThenName).map((airport) => {
    const path = airportPath(airport.icao)
    const name = `${airportDisplayName(airport, 'tr')} (${airport.iata}/${airport.icao.toUpperCase()})`
    const notes = [provinceName(airport.isoRegion, 'tr'), runwayNote(airport, tr)].filter(
      (note): note is string => Boolean(note),
    )
    const english = `${tr.nav.switchTo}: ${link(airportDisplayName(airport, 'en'), url('en', path))}`
    return `- ${link(name, url('tr', path))}: ${[...notes, english].join('; ')}`
  })

  const foreignLines = sortByCountry(foreign, 'tr').map((airport) => {
    const path = airportPath(airport.icao)
    const name = `${airportDisplayName(airport, 'tr')} (${airport.iata}/${airport.icao.toUpperCase()})`
    const notes = [airportCountry(airport, 'tr'), runwayNote(airport, tr)].filter(
      (note): note is string => Boolean(note),
    )
    const english = `${tr.nav.switchTo}: ${link(airportDisplayName(airport, 'en'), url('en', path))}`
    return `- ${link(name, url('tr', path))}: ${[...notes, english].join('; ')}`
  })

  return [
    `# ${input.appName}`,
    '',
    `> ${tr.seo.home.description}`,
    `> ${en.seo.home.description}`,
    '',
    format(tr.about.intro, { app: input.appName, owner: PROJECT.owner }),
    ...facts(tr, 'tr'),
    '',
    format(en.about.intro, { app: input.appName, owner: PROJECT.owner }),
    ...facts(en, 'en'),
    '',
    `## ${tr.nav.map} / ${en.nav.map}`,
    '',
    `- ${pair('/', (t) => t.seo.home.title)}`,
    '',
    `## ${tr.nav.airports} / ${en.nav.airports}`,
    '',
    `- ${pair('/havalimanlari', (t) => t.seo.airports.title)}`,
    ...(airportLines.length > 0
      ? ['', `## ${tr.airports.turkeyHeading} / ${en.airports.turkeyHeading}`, '', ...airportLines]
      : []),
    '',
    ...(foreignLines.length > 0
      ? [
          `## ${tr.airports.foreign.heading} / ${en.airports.foreign.heading}`,
          '',
          ...foreignLines,
          '',
        ]
      : []),
    `## ${tr.nav.about} / ${en.nav.about}`,
    '',
    `- ${pair('/hakkinda', (t) => t.seo.about.title)}`,
    '',
    `## ${OPTIONAL_SECTION}`,
    '',
    `- ${pair('/yenilikler', (t) => t.changelog.title)}`,
    `- ${pair('/kullanim-kosullari', (t) => t.terms.title)}`,
    '',
  ].join('\n')
}
