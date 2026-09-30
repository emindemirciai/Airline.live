import { connection } from 'next/server'
// Göreli yollar: vitest `@/` takma adını çözmez; bu dosya testte doğrudan çağrılır.
import { getAirports } from '../../lib/airports'
import { appName, getServerEnv } from '../../lib/env'
import { buildLlmsTxt } from '../../lib/seo/llms'
import { siteUrl } from '../../lib/seo/metadata'

/**
 * `/llms.txt` (içerik: lib/seo/llms.ts). İstek anında üretilir: WEB_HOST ve APP_NAME çalışma
 * zamanı ortamındadır, havalimanı verisi sayfalarla aynı önbellekli toplu istekten gelir.
 */
export async function GET(): Promise<Response> {
  await connection()
  const body = buildLlmsTxt({
    base: siteUrl(),
    appName: appName(getServerEnv()),
    airports: await getAirports(),
  })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
