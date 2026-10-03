import Link from 'next/link'
import { BrandMark } from './brand-mark'

/**
 * Başlık şeridindeki marka bağlantısı: logo işareti ve yazı marka (`APP_NAME`, Overpass 800). Kök
 * düzende (site ve yönetim sayfaları, hata ve 404 sayfaları) kullanılır. Bağlantının erişilebilir
 * adı yazının kendisidir; işaret `aria-hidden`'dır (D-086).
 */
export function SiteBrand({ href, name }: { href: string; name: string }) {
  return (
    <Link href={href} className="brand">
      <BrandMark className="brand-mark" />
      {name}
    </Link>
  )
}
