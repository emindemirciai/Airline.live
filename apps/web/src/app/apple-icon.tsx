import { ImageResponse } from 'next/og'
// Göreli yol: vitest `@/` takma adını çözmez; bu dosya testte doğrudan çağrılır.
import { BrandIcon } from '../lib/seo/og'

/**
 * iOS ana ekran simgesi (180 px; D-086). Köşeleri iOS yuvarlar ve saydam pikselleri siyaha boyar;
 * zemin bu yüzden tam karedir. Build sırasında bir kez üretilir.
 */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(<BrandIcon size={size.width} rounded={false} />, { ...size })
}
