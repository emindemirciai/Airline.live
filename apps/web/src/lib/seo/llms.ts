import { format, getMessages, type Messages } from '@havayolu/i18n'
import {
  airportDisplayName,
  PROJECT,
  provinceName,
  type AirportDetail,
  type Locale,
} from '@havayolu/shared'
import { isIndexable, isMonitoredStation } from '../airports'
import { localePath } from '../locale-routing'
import { DATA_ATTRIBUTION } from '../map-config'
import { TERMS_LINKS } from '../terms'
import { airportPath } from './paths'

/**
 * `/llms.txt` (öneri: https://llmstxt.org/, 2024-09-03). Dil modellerine sitenin kısa özetini ve
 * önemli sayfalarını verir. Metinler sayfalarla aynı kaynaktan gelir (`packages/i18n`: seo, about,
 * nav) ve havalimanı satırları sayfalarla aynı veriden kurulur; ikisi birbirinden ayrışamaz.
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

/** Sitenin ne gösterip ne göstermediği, gizlilik kuralları ve veri kaynakları (bir dilde). */
function facts(t: Messages): string[] {
  const { shows, limits, privacy, sources } = t.about
  return [
    `- ${shows.map}`,
    `- ${shows.airports}`,
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

export function buildLlmsTxt(input: LlmsInput): string {
  const tr = getMessages('tr')
  const en = getMessages('en')
  const url = (locale: Locale, path: string) =>
    new URL(localePath(locale, path), input.base).toString()
  /** Aynı sayfanın iki dildeki bağlantısı: `[TR](…) · [EN](…/en…)`. */
  const pair = (path: string, label: (t: Messages) => string) =>
    `${link(label(tr), url('tr', path))} · ${link(label(en), url('en', path))}`

  const airportLines = input.airports
    .filter(isIndexable)
    .toSorted(byProvinceThenName)
    .map((airport) => {
      const path = airportPath(airport.icao)
      const name = `${airportDisplayName(airport, 'tr')} (${airport.iata}/${airport.icao.toUpperCase()})`
      const notes = [
        provinceName(airport.isoRegion, 'tr'),
        format(tr.seo.airport.runwaysCount, { count: airport.runways.length }),
        isMonitoredStation(airport) ? tr.airports.columns.station.toLocaleLowerCase('tr') : null,
      ].filter((note): note is string => Boolean(note))
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
    ...facts(tr),
    '',
    format(en.about.intro, { app: input.appName, owner: PROJECT.owner }),
    ...facts(en),
    '',
    `## ${tr.nav.map} / ${en.nav.map}`,
    '',
    `- ${pair('/', (t) => t.seo.home.title)}`,
    '',
    `## ${tr.nav.airports} / ${en.nav.airports}`,
    '',
    `- ${pair('/havalimanlari', (t) => t.seo.airports.title)}`,
    ...airportLines,
    '',
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
