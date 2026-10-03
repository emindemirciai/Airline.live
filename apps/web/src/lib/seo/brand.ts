/**
 * Sitenin "Açık turkuaz" tema renkleri (D-081) ve logonun zemine göre renkleri (D-086). Paylaşım
 * görselleri, uygulama simgeleri (og.tsx), manifest, tarayıcı arayüz rengi (layout.tsx) ve
 * `scripts/gen-favicon.mts` aynı değerleri kullanır; `globals.css` → `:root` ile aynıdır. Logonun
 * geometrisi `lib/brand/logo-geometry.ts`'tedir. Bu modül import almaz; script'ten doğrudan okunabilir.
 */
export const THEME_COLORS = {
  /** Sayfa zemini. */
  page: '#EAF7F8',
  /**
   * Başlık şeridi ve marka rengi. Seçilen `#0B8F9B` beyaz yazıyla 3,88:1'de kalıyordu; tonu
   * koruyarak AA'yı (4,5:1) sağlayan en açık değer budur (beyazla 4,57:1).
   */
  header: '#0A828D',
  /** Başlık şeridindeki yazı ve logo. */
  headerInk: '#FFFFFF',
  /** Panel ve kart yüzeyi. */
  panel: '#FFFFFF',
  /** Panel kenarı ve ayırıcı. */
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

/** Logonun iki rengi: halka (küçük işarette daire) ve uçak. */
export interface LogoColors {
  readonly ring: string
  readonly plane: string
}

/**
 * Logonun zemine göre renkleri (D-086). Başlık şeridinde ve uygulama simgesinde işaret beyazdır;
 * sitenin başlığı rengi `currentColor`'dan (`--header-ink`) alır.
 */
export const LOGO_COLORS = {
  /** Açık zemin (sayfa, panel, paylaşım görseli): turkuaz halka, koyu uçak. */
  light: { ring: THEME_COLORS.header, plane: THEME_COLORS.ink },
  /** Turkuaz zemin (başlık şeridi, uygulama simgesi): ikisi de beyaz. */
  header: { ring: THEME_COLORS.headerInk, plane: THEME_COLORS.headerInk },
  /** Koyu zemin (`THEME_COLORS.ink`): açık turkuaz halka, beyaz uçak. */
  dark: { ring: '#5FD3DD', plane: '#FFFFFF' },
  /** Küçük işaret (32 px ve altı, favicon): turkuaz daire, beyaz uçak. */
  small: { ring: THEME_COLORS.header, plane: THEME_COLORS.headerInk },
} as const satisfies Record<string, LogoColors>
