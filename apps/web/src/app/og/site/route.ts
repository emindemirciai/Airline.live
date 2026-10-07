import { connection } from 'next/server'
// Göreli yollar: vitest `@/` takma adını çözmez; bu dosya testte doğrudan çağrılır.
import { appName, getServerEnv } from '../../../lib/env'
import { siteUrlFrom } from '../../../lib/seo/metadata'
import { renderSiteOgPng, type SiteOgContent } from '../../../lib/seo/og-site'
import { siteOgContent } from '../../../lib/seo/og-site-content'

/**
 * `/og/site`: sitenin varsayılan paylaşım görseli (`pageMetadata` → `ogImage: 'default'`). Ad ve alan
 * adı çalışma zamanı ortamından okunur (APP_NAME, WEB_HOST; Docker build'inde yoktur). İçerik süreç
 * boyunca değişmediğinden görsel bir kez üretilip bellekte tutulur. Sayfalar adresi içerikten
 * türetilen sürümle verir (`/og/site?v=…`, og-site-content.ts, D-106); rota sorguya bakmaz.
 */
let rendered: { key: string; png: Promise<ArrayBuffer> } | undefined

function cachedPng(content: SiteOgContent): Promise<ArrayBuffer> {
  const key = JSON.stringify(content)
  if (rendered?.key !== key) {
    const png = renderSiteOgPng(content).catch((error: unknown) => {
      if (rendered?.key === key) rendered = undefined
      throw error
    })
    rendered = { key, png }
  }
  return rendered.png
}

export async function GET(): Promise<Response> {
  await connection()
  const env = getServerEnv()
  const png = await cachedPng(
    siteOgContent(appName(env), env.WEB_HOST ? siteUrlFrom(env.WEB_HOST).host : null),
  )
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
