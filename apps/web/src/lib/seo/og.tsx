import type { ReactNode } from 'react'
import { BRAND_ICON_MARK_RATIO, BRAND_MARK_DIAMETERS, THEME_COLORS } from './brand'

/**
 * Paylaşım görselleri ve uygulama simgeleri için ortak görünüm (`next/og`, Satori). Yalnızca
 * flexbox ve düz renk kullanılır. Renkler sitenin "Açık turkuaz" temasındandır (brand.ts, D-081):
 * açık zemin, koyu yazı, üstte başlık renginde şerit. Görsellerdeki en küçük yazı 34 px'tir (büyük
 * yazı, AA 3:1); marka rengi zemine karşı 4,17:1, ikincil yazı 5,52:1'dir. Marka işareti sitenin
 * başlığındaki `.brand-mark` halkasıdır. Havalimanı paylaşım görseli de bu parçaları kullanır.
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

function Circle({
  diameter,
  color,
  children,
}: {
  diameter: number
  color: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        background: color,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Marka işareti: ince dış çizgi, zemin renginde boşluk, halka (`size` = toplam çap, px). Açık
 * zeminde halka marka rengindedir; başlık renginde zeminde (uygulama simgesi) beyazdır.
 */
export function BrandMark({
  size,
  background = OG_COLORS.background,
  ring = OG_COLORS.accent,
}: {
  size: number
  background?: string
  ring?: string
}) {
  const unit = size / BRAND_MARK_DIAMETERS.outline
  const d = (value: number) => value * unit
  return (
    <Circle diameter={d(BRAND_MARK_DIAMETERS.outline)} color={OG_COLORS.line}>
      <Circle diameter={d(BRAND_MARK_DIAMETERS.gap)} color={background}>
        <Circle diameter={d(BRAND_MARK_DIAMETERS.ring)} color={ring}>
          <Circle diameter={d(BRAND_MARK_DIAMETERS.hole)} color={background} />
        </Circle>
      </Circle>
    </Circle>
  )
}

/**
 * Uygulama simgesi: başlık renginde tam kare zemin ve ortada beyaz halkalı marka işareti (sitenin
 * başlığındaki görünüm). Kare saydam köşe taşımaz (iOS ve Android kendi maskesini uygular); işaret
 * maskelenebilir simgenin güvenli alanı içindedir.
 */
export function BrandIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: THEME_COLORS.header,
      }}
    >
      <BrandMark
        size={Math.round(size * BRAND_ICON_MARK_RATIO)}
        background={THEME_COLORS.header}
        ring={THEME_COLORS.headerInk}
      />
    </div>
  )
}
