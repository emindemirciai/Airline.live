import { useId } from 'react'
// Göreli yollar: vitest `@/` takma adını çözmez ve bileşen testte çizilir.
import type { LogoVariant } from '../../lib/brand/logo-geometry'
import { logoSvg } from '../../lib/brand/logo-svg'

/**
 * Sitedeki logo işareti (D-086), satır içi SVG. Renkler varsayılan olarak `currentColor`'dır: başlık
 * şeridinde işaret yazıyla aynı renktedir (`--header-ink`, beyaz). Açık zeminde `ring` ve `plane`
 * verilir (`lib/seo/brand.ts` → `LOGO_COLORS` ya da CSS değişkeni, ör. `var(--header)`).
 *
 * Maskenin kimliği `useId` ile her örnekte tekildir; sunucu çizimi ve hidrasyon aynı kimliği üretir,
 * aynı sayfadaki iki işaret birbirinin maskesini kullanmaz. İşaret her zaman yazı markanın yanında
 * süstür: `aria-hidden`, bağlantının erişilebilir adı yalnızca yazıdan gelir.
 */
export function BrandMark({
  variant = 'full',
  ring = 'currentColor',
  plane = 'currentColor',
  className,
}: {
  variant?: LogoVariant
  ring?: string
  plane?: string
  className?: string
}) {
  const maskId = `${useId()}logo-cut`
  return logoSvg({ variant, colors: { ring, plane }, maskId, className })
}
