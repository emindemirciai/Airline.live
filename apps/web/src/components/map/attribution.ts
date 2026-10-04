/**
 * Haritanın atıf kutusuna her zaman eklenen canlı veri atfı (data-sources.md §1, bağlantılar
 * zorunlu) ve kullanım koşulları bağlantısı (E204 §3.1c.5, D-075). Altlığın atfı stilin kaynağından
 * gelir (uydu, OpenFreeMap), yalnızca o altlık görünürken çıkar. MapLibre atıf HTML'ini ayrıca
 * temizler (izinli etiket ve adres şemaları; site içi göreli adres geçer).
 *
 * Şeridin başında sitenin kendi künyesi ("havayolu v0.16.1", Yenilikler bağlantısı, D-089) durur.
 * Künye MapLibre girdisi değildir: MapLibre girdileri uzunluğa göre sıraladığından hiçbir girdi
 * her altlıkta ilk sırada kalmaz. Künye, girdilerin kabının önüne ayrı bir öğe olarak konur.
 */
import { format } from '@havayolu/i18n'
import type { DataAttribution } from '../../lib/map-config'

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char)
}

function link(href: string, text: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`
}

/** "ADSB.lol — ODbL 1.0", iki bağlantıyla; önüne isteğe bağlı bir ön ek ("Canlı uçuş verisi:"). */
export function dataAttributionHtml(attribution: DataAttribution, prefix?: string): string {
  const text = `${link(attribution.href, attribution.label)} — ${link(attribution.licenseHref, attribution.license)}`
  return prefix ? `${escapeHtml(prefix)} ${text}` : text
}

/**
 * Kullanım koşulları bağlantısı; aynı sekmede açılır (site içi sayfa). `href` sayfanın dilindeki
 * adrestir: `localePath(locale, TERMS_PATH)` → `/kullanim-kosullari` ya da `/en/kullanim-kosullari`.
 */
export function termsLinkHtml(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
}

/**
 * Atıf kutusunun sabit girdisi: canlı veri atfı ve kullanım koşulları bağlantısı tek girdidir.
 * MapLibre girdileri uzunluğa göre sıralar; ayrı girdi olsa "Koşullar" atfın başına düşerdi.
 */
export function mapCustomAttributionHtml(
  attribution: DataAttribution,
  prefix: string,
  termsLabel: string,
  termsHref: string,
): string {
  return `${dataAttributionHtml(attribution, prefix)} · ${termsLinkHtml(termsLabel, termsHref)}`
}

/** Sitenin adı (`APP_NAME`) ve sürümü (`currentVersion()`): site alt bilgisindekiyle aynı kaynak. */
export interface SiteVersion {
  name: string
  version: string
}

/** Atıf şeridinin başındaki site künyesi (D-089). */
export interface SiteCredit {
  /** Görünen metin: "havayolu v0.16.1". */
  text: string
  /** Yenilikler sayfasının sayfanın dilindeki adresi (`/yenilikler`, `/en/yenilikler`). */
  href: string
  /** Bağlantının erişilebilir adı; görünen metinle başlar ("havayolu v0.16.1, yenilikler"). */
  label: string
}

/** Künyenin sınıfı (globals.css); e2e ve yinelenme denetimi de bunu kullanır. */
export const SITE_CREDIT_CLASS = 'map-site-credit'

/** MapLibre'nin atıf girdileri arasına koyduğu ayraç; künyeden sonra da aynısı gelir. */
export const ATTRIBUTION_SEPARATOR = ' | '

/** MapLibre atıf şeridinde girdilerin kabı (`<details class="maplibregl-ctrl-attrib">` içinde). */
export const ATTRIBUTION_INNER_SELECTOR = '.maplibregl-ctrl-attrib .maplibregl-ctrl-attrib-inner'

/**
 * Künyenin metni ve erişilebilir adı. `labelTemplate` i18n `map.siteCreditLabel`'dır; `{credit}`
 * görünen metindir, ad onunla başlar (WCAG 2.5.3, görünen ad erişilebilir adın içinde).
 */
export function siteCredit(site: SiteVersion, href: string, labelTemplate: string): SiteCredit {
  const text = `${site.name} v${site.version}`
  return { text, href, label: format(labelTemplate, { credit: text }) }
}

/**
 * Künyenin HTML'i: aynı sekmede açılan site içi bağlantı ve ardından ayraç. Ayraç ekran okuyucudan
 * gizlidir; künye ile ilk atıf arasında görsel ayrımdır.
 */
export function siteCreditHtml(credit: SiteCredit): string {
  return (
    `<span class="${SITE_CREDIT_CLASS}">` +
    `<a href="${escapeHtml(credit.href)}" aria-label="${escapeHtml(credit.label)}">${escapeHtml(credit.text)}</a>` +
    `<span aria-hidden="true">${ATTRIBUTION_SEPARATOR}</span>` +
    `</span>`
  )
}

/**
 * Künyeyi MapLibre atıf şeridinin başına, girdilerin kabının önüne koyar. MapLibre girdileri
 * yalnızca bu kabın içinde yeniden yazar (altlık değişince); kabın dışındaki künye her altlıkta
 * yerinde ve ilk sırada kalır. Künye zaten varsa ikinci kez eklenmez. Şerit bulunamazsa false.
 */
export function prependSiteCredit(mapContainer: ParentNode, html: string): boolean {
  const inner = mapContainer.querySelector(ATTRIBUTION_INNER_SELECTOR)
  if (!inner) return false
  if (inner.parentElement?.querySelector(`:scope > .${SITE_CREDIT_CLASS}`)) return true
  inner.insertAdjacentHTML('beforebegin', html)
  return true
}
