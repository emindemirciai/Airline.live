import { resolveLocale } from '@havayolu/i18n'
import type { NextRequest } from 'next/server'
// Göreli yollar: vitest `@/` takma adını çözmez; bu rota testte doğrudan çağrılır.
import { localePath } from '../../lib/locale-routing'
import { safeLogicalPath, safeNextPath } from '../../lib/safe-path'

/** Dil tercihini tutan eski çerez (M6'ya kadar); dil artık adrestedir (D-076). */
const LEGACY_LOCALE_COOKIE = 'lang'

/**
 * `Location` başlığı yalnızca Latin-1 taşır; `next` çözülmüş hâliyle "ş" gibi karakter içerirse
 * başlık kurulamaz ve yanıt 500 olurdu. Denetlenmiş yol yüzde kodlanır (`encodeURI` bölü, soru ve
 * diyez işaretlerine dokunmaz, yalnızca kaçış ekler); kodlanamayan yol kök sayfaya döner.
 */
function headerSafePath(path: string): string {
  try {
    return encodeURI(path)
  } catch {
    return '/'
  }
}

/**
 * Eski dil değiştirme uç noktası: `/dil?to=en&next=/durum` → 308 `/en/durum`. Paylaşılmış ve yer
 * imlerindeki adresler çalışmayı sürdürür. Hedef aynı sitede kalır: `next` önek ayrılmadan önce ve
 * sonra denetlenir (`safeLogicalPath`), dil öneki eklendikten sonraki son adres de bir kez daha
 * (`safeNextPath`). Eski dil çerezi silinir, yanıt arama sonuçlarına girmez.
 */
export function GET(request: NextRequest) {
  const locale = resolveLocale(request.nextUrl.searchParams.get('to'))
  const next = safeLogicalPath(request.nextUrl.searchParams.get('next'))
  const secure = process.env.APP_ENV === 'production' ? '; Secure' : ''
  return new Response(null, {
    status: 308,
    headers: {
      Location: headerSafePath(safeNextPath(localePath(locale, next))),
      'Set-Cookie': `${LEGACY_LOCALE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${secure}`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
