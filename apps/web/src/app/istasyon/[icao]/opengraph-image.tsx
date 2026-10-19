import { connection } from 'next/server'
// Göreli yollar: vitest `@/` takma adını çözmez; bu dosya testte doğrudan çağrılır.
import { airportOgContent, renderAirportOgPng } from '../../../components/airports/airport-og'
import { getAirports } from '../../../lib/airports'
import { appName, DEFAULT_APP_NAME, getServerEnv } from '../../../lib/env'
import { siteUrlFrom } from '../../../lib/seo/metadata'
import { OG_SIZE } from '../../../lib/seo/og'
import { createOgImageCache } from '../../../lib/seo/og-image-cache'

/**
 * `/istasyon/<ICAO>/opengraph-image`: havalimanı sayfasının paylaşım görseli. Veri sayfayla aynı
 * önbellekli toplu çağrıdan gelir (`getAirports`); ad ve alan adı çalışma zamanı ortamından okunur,
 * bu yüzden önce `connection()` çağrılır (Docker build'inde API ve WEB_HOST yoktur).
 *
 * `alt` sabittir: dosya tabanlı görselin alternatif metni modül düzeyinde verilir ve iki dil aynı
 * görseli kullanır. `generateImageMetadata` kullanılmaz: build sırasında `generateStaticParams`
 * üzerinden çağrılıp API'ye istek atabilirdi.
 */
export const alt = DEFAULT_APP_NAME
export const size = OG_SIZE
export const contentType = 'image/png'

/** Günde bir değişebilen veri; sosyal ağ önizleyicileri bir gün önbelleğe alabilir. */
const CACHE_CONTROL = 'public, max-age=86400'

/**
 * Çizilen görseller süreç içinde tutulur: en çok 256 görsel (~12,5 MB), en uzun süre istenmeyen önce
 * çıkar (D-111); içerik değişirse yeniden çizilir.
 */
const rendered = createOgImageCache(renderAirportOgPng)

export default async function Image({
  params,
}: {
  params: Promise<{ icao: string }>
}): Promise<Response> {
  await connection()
  const { icao } = await params
  const airport = (await getAirports()).find((candidate) => candidate.icao === icao)
  if (!airport) return new Response('Not Found', { status: 404 })
  const env = getServerEnv()
  const host = env.WEB_HOST ? siteUrlFrom(env.WEB_HOST).host : null
  const png = await rendered.get(airport.icao, airportOgContent(airport, appName(env), host))
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL },
  })
}
