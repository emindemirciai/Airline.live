/**
 * Haritanın atıf kutusuna her zaman eklenen canlı veri atfı (data-sources.md §1, bağlantılar
 * zorunlu) ve kullanım koşulları bağlantısı (E204 §3.1c.5, D-075). Altlığın atfı stilin kaynağından
 * gelir (uydu, OpenFreeMap), yalnızca o altlık görünürken çıkar. MapLibre atıf HTML'ini ayrıca
 * temizler (izinli etiket ve adres şemaları; site içi göreli adres geçer).
 */
import type { DataAttribution } from '../../lib/map-config'
import { TERMS_PATH } from '../../lib/terms'

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

/** Kullanım koşulları bağlantısı; aynı sekmede açılır (site içi sayfa). */
export function termsLinkHtml(label: string): string {
  return `<a href="${TERMS_PATH}">${escapeHtml(label)}</a>`
}

/**
 * Atıf kutusunun sabit girdisi: canlı veri atfı ve kullanım koşulları bağlantısı tek girdidir.
 * MapLibre girdileri uzunluğa göre sıralar; ayrı girdi olsa "Koşullar" atfın başına düşerdi.
 */
export function mapCustomAttributionHtml(
  attribution: DataAttribution,
  prefix: string,
  termsLabel: string,
): string {
  return `${dataAttributionHtml(attribution, prefix)} · ${termsLinkHtml(termsLabel)}`
}
