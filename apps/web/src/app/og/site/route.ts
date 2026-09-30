import { getMessages } from '@havayolu/i18n'
import { connection } from 'next/server'
// Göreli yollar: vitest `@/` takma adını çözmez; bu dosya testte doğrudan çağrılır.
import { appName, getServerEnv } from '../../../lib/env'
import { siteUrlFrom } from '../../../lib/seo/metadata'
import { renderSiteOgPng, type SiteOgContent } from '../../../lib/seo/og-site'

/**
 * `/og/site`: sitenin varsayılan paylaşım görseli (`pageMetadata` → `ogImage: 'default'`). Ad ve alan
 * adı çalışma zamanı ortamından okunur (APP_NAME, WEB_HOST; Docker build'inde yoktur). İçerik süreç
 * boyunca değişmediğinden görsel bir kez üretilip bellekte tutulur.
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
  const png = await cachedPng({
    name: appName(env),
    host: env.WEB_HOST ? siteUrlFrom(env.WEB_HOST).host : null,
    taglineTr: getMessages('tr').seo.ogTagline,
    taglineEn: getMessages('en').seo.ogTagline,
  })
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
