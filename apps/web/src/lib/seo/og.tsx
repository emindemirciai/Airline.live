import { MAP_COLORS } from '@havayolu/shared'
import type { ReactNode } from 'react'
import { BRAND_ACCENT, BRAND_ICON_MARK_RATIO, BRAND_MARK_DIAMETERS } from './brand'

/**
 * Paylaşım görselleri ve uygulama simgeleri için ortak görünüm (`next/og`, Satori). Yalnızca
 * flexbox ve düz renk kullanılır. Renkler canlı haritanın koyu paletinden (`MAP_COLORS`) ve
 * koyu tema vurgusundan (brand.ts) gelir; marka işareti sitenin başlığındaki `.brand-mark`
 * halkasıdır. Havalimanı paylaşım görseli de bu parçaları kullanır.
 */
export const OG_COLORS = {
  background: MAP_COLORS.background,
  panel: MAP_COLORS.panel,
  line: MAP_COLORS.lineStrong,
  ink: MAP_COLORS.ink,
  muted: MAP_COLORS.muted,
  accent: BRAND_ACCENT,
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

/** Marka işareti: ince dış çizgi, zemin renginde boşluk, vurgu halkası (`size` = toplam çap, px). */
export function BrandMark({
  size,
  background = OG_COLORS.background,
}: {
  size: number
  background?: string
}) {
  const unit = size / BRAND_MARK_DIAMETERS.outline
  const d = (value: number) => value * unit
  return (
    <Circle diameter={d(BRAND_MARK_DIAMETERS.outline)} color={OG_COLORS.line}>
      <Circle diameter={d(BRAND_MARK_DIAMETERS.gap)} color={background}>
        <Circle diameter={d(BRAND_MARK_DIAMETERS.ring)} color={OG_COLORS.accent}>
          <Circle diameter={d(BRAND_MARK_DIAMETERS.hole)} color={background} />
        </Circle>
      </Circle>
    </Circle>
  )
}

/**
 * Uygulama simgesi: tam kare koyu zemin ve ortada marka işareti. Kare saydam köşe taşımaz (iOS ve
 * Android kendi maskesini uygular); işaret maskelenebilir simgenin güvenli alanı içindedir.
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
        background: OG_COLORS.background,
      }}
    >
      <BrandMark size={Math.round(size * BRAND_ICON_MARK_RATIO)} />
    </div>
  )
}
