import 'server-only'
import { ImageResponse } from 'next/og'
import { BrandMark, OG_COLORS, OG_SIZE } from './og'
import { OG_FONT_STACK, ogFonts } from './og-fonts'

/**
 * Sitenin varsayılan paylaşım görseli (1200×630): marka, iki dilde kısa tanım ve alan adı. Metinler
 * `packages/i18n` → `seo.ogTagline`'dan gelir. Yazı tipleri yerel Overpass'tır (og-fonts.ts); dış
 * istek yapılmaz.
 */
export interface SiteOgContent {
  name: string
  /** WEB_HOST (ör. havayolu.live); yerelde tanımlı değilse gösterilmez. */
  host: string | null
  taglineTr: string
  taglineEn: string
}

export function SiteOgImage({ name, host, taglineTr, taglineEn }: SiteOgContent) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '72px 80px',
        background: OG_COLORS.background,
        color: OG_COLORS.ink,
        fontFamily: OG_FONT_STACK,
        borderTop: `12px solid ${OG_COLORS.accent}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <BrandMark size={120} />
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, letterSpacing: '0.01em' }}>
          {name}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>
          {taglineTr}
        </div>
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 400, color: OG_COLORS.muted }}>
          {taglineEn}
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 36, fontWeight: 400, color: OG_COLORS.accent }}>
        {host ?? ''}
      </div>
    </div>
  )
}

/** Görseli PNG olarak üretir. */
export async function renderSiteOgPng(content: SiteOgContent): Promise<ArrayBuffer> {
  const response = new ImageResponse(<SiteOgImage {...content} />, {
    ...OG_SIZE,
    fonts: await ogFonts(),
  })
  return response.arrayBuffer()
}
