import { getMessages } from '@havayolu/i18n'
import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
// Göreli yollar: vitest `@/` takma adını çözmez; bu dosya testte doğrudan çağrılır.
import { appName, getServerEnv } from '../lib/env'
import { OG_COLORS } from '../lib/seo/og'

/**
 * `/manifest.webmanifest`: uygulama adı ve simgeleri. Ad çalışma zamanında APP_NAME'den okunur
 * (`connection()`, D-059). Service worker Parça 3 M5'te gelir; o zamana kadar `display: browser`
 * (kurulabilir uygulama gibi davranmaz). Simgeler `app/icon.tsx`'in ürettiği 192 ve 512 px PNG'lerdir;
 * işaret maskelenebilir simgenin güvenli alanı içindedir.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection()
  const name = appName(getServerEnv())
  return {
    id: '/',
    name,
    short_name: name,
    description: getMessages('tr').seo.home.description,
    lang: 'tr',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'browser',
    theme_color: OG_COLORS.background,
    background_color: OG_COLORS.background,
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
