import { logoIconSvg, logoSvg } from '../brand/logo-svg'
import { LOGO_COLORS, THEME_COLORS } from './brand'

/**
 * Paylaşım görselleri ve uygulama simgeleri için ortak görünüm (`next/og`, Satori). Yalnızca
 * flexbox, düz renk ve logo için satır içi SVG kullanılır. Renkler sitenin "Açık turkuaz" temasındandır (brand.ts, D-081):
 * açık zemin, koyu yazı, üstte başlık renginde şerit. Görsellerdeki en küçük yazı 34 px'tir (büyük
 * yazı, AA 3:1); marka rengi zemine karşı 4,17:1, ikincil yazı 5,52:1'dir. Logo işareti sitenin
 * başlığındaki işaretin açık zemin renkleridir (D-086). Havalimanı paylaşım görseli de bu parçaları
 * kullanır.
 */
export const OG_COLORS = {
  background: THEME_COLORS.page,
  panel: THEME_COLORS.panel,
  line: THEME_COLORS.line,
  ink: THEME_COLORS.ink,
  muted: THEME_COLORS.muted,
  accent: THEME_COLORS.header,
} as const

/** Open Graph görsel boyutu (1,91:1). */
export const OG_SIZE = { width: 1200, height: 630 } as const

/** Görselde tek işaret vardır; maskenin kimliği sabit olabilir. */
const OG_MASK_ID = 'logo-cut'

/**
 * Logo işareti (D-086), `size` px kenarlı kare. Açık zeminde turkuaz halka ve koyu uçak; çizim
 * sitenin başlığındakiyle aynı SVG'dir (`lib/brand/logo-svg.tsx`).
 */
export function BrandMark({ size }: { size: number }) {
  return logoSvg({ variant: 'full', colors: LOGO_COLORS.light, maskId: OG_MASK_ID, size })
}

/**
 * Uygulama simgesi (D-086): turkuaz zemin ve içeride beyaz tam işaret. `rounded` köşeleri kenarın
 * %24'üyle yuvarlatır (saydam köşe); `false` tam karedir (iOS ve maskelenebilir Android simgesi,
 * platform kendi maskesini uygular). İşaret maskelenebilir simgenin güvenli alanı içindedir.
 */
export function BrandIcon({ size, rounded }: { size: number; rounded: boolean }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      {logoIconSvg({ size, rounded, maskId: OG_MASK_ID })}
    </div>
  )
}
