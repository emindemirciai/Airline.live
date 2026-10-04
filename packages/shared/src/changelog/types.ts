import type { LocalizedText } from '../locale'

/** Yenilikler sayfasında "Dene →" olarak gösterilen, o sürümde test edilebilecek bir sayfa. */
export interface ChangelogLink {
  path: string
  label: LocalizedText
}

export interface ChangelogEntry {
  /** Semver, "v" öneki olmadan (ör. "0.2.0"). */
  version: string
  /** YYYY-MM-DD: yayın günü, Türkiye takvimiyle (Europe/Istanbul). `releasedAt` varsa onun günüdür. */
  date: string
  /**
   * Yayın anı, ISO 8601 UTC, saniyeye kadar ("2026-10-04T17:27:12Z"): sürümün GitHub Release'inin
   * yayımlanma anı (CI release'i üretim yayını doğrulandıktan sonra oluşturur, D-067). Yeni sürümde
   * yoktur (yayın anı birleştirmeden sonra belli olur); bir sonraki sürümün yayın adımında doldurulur
   * (D-091). Yoksa Yenilikler sayfası çalışan sürüm için web sunucusunun açılış anını, diğerleri için
   * yalnızca günü gösterir.
   */
  releasedAt?: string
  title: LocalizedText
  items: readonly LocalizedText[]
  tryLinks?: readonly ChangelogLink[]
}
