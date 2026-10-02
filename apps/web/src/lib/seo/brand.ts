/**
 * Sitenin "Açık turkuaz" tema renkleri (D-081) ve marka işaretinin geometrisi. Paylaşım görselleri,
 * uygulama simgeleri (og.tsx), manifest, tarayıcı arayüz rengi (layout.tsx) ve
 * `scripts/gen-favicon.mts` aynı değerleri kullanır; `globals.css` → `:root` ile aynıdır. Bu modül
 * import almaz; script'ten doğrudan okunabilir.
 */
export const THEME_COLORS = {
  /** Sayfa zemini. */
  page: '#EAF7F8',
  /**
   * Başlık şeridi ve marka rengi. Seçilen `#0B8F9B` beyaz yazıyla 3,88:1'de kalıyordu; tonu
   * koruyarak AA'yı (4,5:1) sağlayan en açık değer budur (beyazla 4,57:1).
   */
  header: '#0A828D',
  /** Başlık şeridindeki yazı ve marka halkası. */
  headerInk: '#FFFFFF',
  /** Panel ve kart yüzeyi. */
  panel: '#FFFFFF',
  /** Panel kenarı, ayırıcı ve marka işaretinin dış çizgisi. */
  line: '#B9E2E6',
  /** Ana metin. */
  ink: '#0B2A33',
  /** İkincil metin. */
  muted: '#4B6770',
  /** Düğme zemini ve hava durumunun sıcaklık kutucuğu (beyaz yazıyla 4,75:1). */
  accent: '#0B7F8A',
  /** Bağlantı ve odak halkası. */
  link: '#0A6E78',
} as const

/**
 * İç içe dairelerin çapları (toplam çap 24 birim), dıştan içe: `globals.css` → `.brand-mark` (14 px
 * daire, 3 px halka, 3 px zemin boşluğu, 2 px dış çizgi).
 */
export const BRAND_MARK_DIAMETERS = {
  /** Dış çizgi (`THEME_COLORS.line`). */
  outline: 24,
  /** Zemin renginde boşluk. */
  gap: 20,
  /** Halka. */
  ring: 14,
  /** Halkanın içi (zemin rengi). */
  hole: 8,
} as const

/** Uygulama simgesinde işaretin kenara oranı; maskelenebilir simgenin güvenli alanında kalır (%80). */
export const BRAND_ICON_MARK_RATIO = 0.62
