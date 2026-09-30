import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ImageResponse } from 'next/og'

/**
 * Paylaşım görsellerinin yazı tipleri (Overpass, OFL-1.1; `apps/web/assets/og-fonts/OFL.txt`).
 * - `next/og` WOFF2 okumaz; `.woff` kullanılır (image-response.md: ttf, otf, woff).
 * - Verilen yazı tiplerinin hiçbirinde olmayan bir harf için Satori Google Fonts'tan yazı tipi
 *   indirir; bu canlı dış istek kurallara aykırıdır. Latin alt kümesinde ğ, İ, ş yoktur; bu yüzden
 *   latin-ext ayrı bir aile adıyla ("Overpass Ext") eklenir ve Satori onu harf başına yedek olarak
 *   kullanır. Görsel metinlerinde emoji, ok ve ₺ gibi bu kümelerin dışındaki karakterler kullanılmaz.
 * - Dosyalar çalışma dizinine göre okunur: `next start` ve standalone `server.js` `apps/web`'de
 *   çalışır; standalone çıktıya `next.config.ts` → `outputFileTracingIncludes` ile girer.
 */
export type OgFont = NonNullable<
  NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts']
>[number]

export const OG_FONT_FAMILY = 'Overpass'
export const OG_FONT_FAMILY_EXT = 'Overpass Ext'

const FONT_FILES = [
  { name: OG_FONT_FAMILY, file: 'overpass-latin-400-normal.woff', weight: 400 },
  { name: OG_FONT_FAMILY, file: 'overpass-latin-800-normal.woff', weight: 800 },
  { name: OG_FONT_FAMILY_EXT, file: 'overpass-latin-ext-400-normal.woff', weight: 400 },
  { name: OG_FONT_FAMILY_EXT, file: 'overpass-latin-ext-800-normal.woff', weight: 800 },
] as const

export const OG_FONT_DIR = join(process.cwd(), 'assets', 'og-fonts')

let loading: Promise<OgFont[]> | undefined

async function load(): Promise<OgFont[]> {
  return Promise.all(
    FONT_FILES.map(async ({ name, file, weight }) => ({
      name,
      data: await readFile(join(OG_FONT_DIR, file)),
      weight,
      style: 'normal' as const,
    })),
  )
}

/** Yazı tipleri bir kez okunur; okuma hatası önbelleğe alınmaz (sonraki istek yeniden dener). */
export function ogFonts(): Promise<OgFont[]> {
  loading ??= load().catch((error: unknown) => {
    loading = undefined
    throw error
  })
  return loading
}

/** Görsellerde kullanılacak `fontFamily` değeri (latin, sonra latin-ext yedeği). */
export const OG_FONT_STACK = `${OG_FONT_FAMILY}, ${OG_FONT_FAMILY_EXT}`
