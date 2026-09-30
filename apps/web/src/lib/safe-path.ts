/** Hedef boş ya da güvensizse dönülen sayfa: kök adresteki canlı harita. */
export const DEFAULT_PATH = '/'

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Yönlendirme hedefini yalnızca aynı sitedeki göreli bir yola izin verecek şekilde temizler.
 * "//evil.com", "https://…", ters bölü ve kontrol karakterleri reddedilir (açık yönlendirme koruması).
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_PATH
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_PATH
  if (value.includes('\\') || hasControlCharacter(value)) return DEFAULT_PATH
  return value
}
