import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/**
 * Yönetim sayfaları arama motorlarına kapalıdır: `noindex, nofollow` meta etiketi (admin host'unda
 * ayrıca `X-Robots-Tag` başlığı ve robots.txt `Disallow: /`). Yönetim yalnızca Türkçedir ve `/en`
 * ikizi yoktur (D-076). Sayfalar kendi `robots` değerini yazmaz; bu değeri miras alır.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children
}
