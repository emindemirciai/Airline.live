import { ImageResponse } from 'next/og'
// Göreli yol: vitest `@/` takma adını çözmez; bu dosya testte doğrudan çağrılır.
import { BrandIcon } from '../lib/seo/og'

/**
 * Uygulama simgeleri (192 ve 512 px PNG; `/icon/192`, `/icon/512`). Yalnızca şekil çizilir, yazı
 * tipi gerekmez; ortam değişkeni okunmadığından build sırasında bir kez üretilir. Manifest ve
 * Organization JSON-LD logosu bu adresleri kullanır.
 */
const SIZES = [192, 512] as const

export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: 'image/png',
  }))
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const requested = Number(await id)
  const size = SIZES.find((candidate) => candidate === requested) ?? SIZES[0]
  return new ImageResponse(<BrandIcon size={size} />, { width: size, height: size })
}
