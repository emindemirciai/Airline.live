import type { AirportDetail } from '@havayolu/shared'
import { connection } from 'next/server'
// Göreli yollar: vitest `@/` takma adını çözmez; bu dosya testte doğrudan çağrılır.
import { getAirports } from '../../lib/airports'
import { appName, getServerEnv } from '../../lib/env'
import { buildLlmsTxt } from '../../lib/seo/llms'
import { siteUrl } from '../../lib/seo/metadata'

/**
 * Kurulan metin liste başına (D-111): havalimanı listesi web belleğindedir ve yüklemeler arasında
 * aynı dizidir (`getAirports`); metin liste yenilenince (saatte bir) yeniden kurulur. 5. halkada
 * (3.243 havalimanıyla ölçüldü; D-110'la 3.266) kurulum ~54 ms'dir, her istekte tekrarlanmaz. Anahtar adres ve site adıdır
 * (çalışma zamanı ortamı). Eski liste çöpe gidince metni de gider.
 */
const built = new WeakMap<readonly AirportDetail[], { key: string; body: string }>()

/**
 * `/llms.txt` (içerik: lib/seo/llms.ts). İstek anında verilir: WEB_HOST ve APP_NAME çalışma
 * zamanı ortamındadır, havalimanı verisi sayfalarla aynı bellekteki listeden gelir.
 */
export async function GET(): Promise<Response> {
  await connection()
  const airports = await getAirports()
  const base = siteUrl()
  const name = appName(getServerEnv())
  const key = `${base.toString()}\n${name}`
  let entry = built.get(airports)
  if (entry?.key !== key) {
    entry = { key, body: buildLlmsTxt({ base, appName: name, airports }) }
    built.set(airports, entry)
  }
  return new Response(entry.body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
