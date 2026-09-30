/**
 * Marka işaretinin geometrisi ve vurgu rengi; paylaşım görselleri, uygulama simgeleri (og.tsx) ve
 * `scripts/gen-favicon.mts` aynı değerleri kullanır. Kaynak: `globals.css` → `.brand-mark` (14 px
 * daire, 3 px vurgu halkası, 3 px zemin boşluğu, 2 px dış çizgi) ve koyu tema `--accent`. Bu modül
 * import almaz; script'ten doğrudan okunabilir.
 */
export const BRAND_ACCENT = '#7FB0FF'

/** İç içe dairelerin çapları (toplam çap 24 birim), dıştan içe. */
export const BRAND_MARK_DIAMETERS = {
  /** Dış çizgi (MAP_COLORS.lineStrong). */
  outline: 24,
  /** Zemin renginde boşluk. */
  gap: 20,
  /** Vurgu halkası. */
  ring: 14,
  /** Halkanın içi (zemin rengi). */
  hole: 8,
} as const

/** Uygulama simgesinde işaretin kenara oranı; maskelenebilir simgenin güvenli alanında kalır (%80). */
export const BRAND_ICON_MARK_RATIO = 0.62
