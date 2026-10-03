import type { AirportDetail } from '@havayolu/shared'
import { ImageResponse } from 'next/og'
// Göreli yollar: vitest `@/` takma adını çözmez ve görsel testte çizilir.
import { BrandMark, OG_COLORS, OG_SIZE } from '../../lib/seo/og'
import { OG_FONT_STACK, ogFonts } from '../../lib/seo/og-fonts'
import { airportLocation, airportName } from './airport-text'

/**
 * Havalimanı sayfasının paylaşım görseli (1200×630, M6b brief §c). Dilden bağımsızdır: kodlar,
 * Türkçe ad, il (yakın ülkelerde yerleşim ve ülke) ve alan adı. Görsel iç yoldan
 * (`/istasyon/<ICAO>/opengraph-image`) sunulur, TR ve EN sayfaları aynı görseli kullanır. Yazı
 * tipleri yereldir (og-fonts.ts); görseldeki metinlerde bu yazı tiplerinin kapsamadığı karakter
 * (emoji, ok, ₺) yoktur, dış istek yapılmaz.
 */
export interface AirportOgContent {
  app: string
  /** WEB_HOST (ör. havayolu.live); tanımlı değilse gösterilmez. */
  host: string | null
  codes: string
  name: string
  location: string
}

/** Görselin metinleri, veriden (Türkçe ad ve yer satırı: il ya da yakın ülkelerde yerleşim ve ülke). */
export function airportOgContent(
  airport: AirportDetail,
  app: string,
  host: string | null,
): AirportOgContent {
  return {
    app,
    host,
    codes: `${airport.iata} · ${airport.icao}`,
    name: airportName(airport, 'tr'),
    location: airportLocation(airport, 'tr'),
  }
}

/** Uzun adlar (ör. "İstanbul Sabiha Gökçen Uluslararası Havalimanı") iki satıra sığsın. */
function nameFontSize(name: string): number {
  if (name.length > 38) return 54
  if (name.length > 26) return 62
  return 72
}

export function AirportOgImage({ app, host, codes, name, location }: AirportOgContent) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '64px 80px',
        background: OG_COLORS.background,
        color: OG_COLORS.ink,
        fontFamily: OG_FONT_STACK,
        borderTop: `12px solid ${OG_COLORS.accent}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <BrandMark size={64} />
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 800 }}>{app}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 96,
            fontWeight: 800,
            color: OG_COLORS.accent,
            letterSpacing: '0.02em',
          }}
        >
          {codes}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: nameFontSize(name),
            fontWeight: 800,
            lineHeight: 1.1,
          }}
        >
          {name}
        </div>
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 400, color: OG_COLORS.muted }}>
          {location}
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 34, fontWeight: 400, color: OG_COLORS.accent }}>
        {host ?? ''}
      </div>
    </div>
  )
}

/** Görseli PNG olarak üretir. */
export async function renderAirportOgPng(content: AirportOgContent): Promise<ArrayBuffer> {
  const response = new ImageResponse(<AirportOgImage {...content} />, {
    ...OG_SIZE,
    fonts: await ogFonts(),
  })
  return response.arrayBuffer()
}
