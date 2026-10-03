import { ImageResponse } from 'next/og'
// Göreli yol: vitest `@/` takma adını çözmez; bu dosya testte doğrudan çağrılır.
import { BrandIcon } from '../lib/seo/og'

/**
 * Uygulama simgeleri (PNG; D-086): `/icon/192` ve `/icon/512` köşeleri yuvarlatılmış turkuaz kare
 * (saydam köşe; tarayıcı, masaüstü kurulumu, Organization JSON-LD logosu), `/icon/maskable` 512 px
 * tam kare (manifestteki maskelenebilir simge; Android kendi şekliyle keser, saydam piksel olmamalı).
 * Yalnızca şekil çizilir, yazı tipi gerekmez; ortam değişkeni okunmadığından build sırasında bir kez
 * üretilir.
 */
const ICONS = [
  { id: '192', size: 192, rounded: true },
  { id: '512', size: 512, rounded: true },
  { id: 'maskable', size: 512, rounded: false },
] as const

export function generateImageMetadata() {
  return ICONS.map(({ id, size }) => ({
    id,
    size: { width: size, height: size },
    contentType: 'image/png',
  }))
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const requested = String(await id)
  const icon = ICONS.find((candidate) => candidate.id === requested) ?? ICONS[0]
  return new ImageResponse(<BrandIcon size={icon.size} rounded={icon.rounded} />, {
    width: icon.size,
    height: icon.size,
  })
}
