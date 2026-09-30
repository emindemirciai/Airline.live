'use client'

import type { Locale } from '@havayolu/shared'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, type Ref } from 'react'
import { languageToggleHrefFromLocation } from '@/lib/language-href'

export interface LanguageToggleProps {
  target: Locale
  label: string
  /**
   * Sunucunun çizdiği ilk adres: proxy'nin ilettiği mantıksal yoldan (`PATH_HEADER`) hesaplanır
   * (`languageToggleHref`, lib/language-href.ts). İstemci açıldıktan ve her gezinmeden sonra adres
   * yeniden hesaplanır.
   */
  initialHref: string
}

interface ToggleLinkProps {
  target: Locale
  label: string
  href: string
  ref?: Ref<HTMLAnchorElement>
}

function ToggleLink({ target, label, href, ref }: ToggleLinkProps) {
  return (
    <a ref={ref} href={href} hrefLang={target} lang={target} className="lang-toggle">
      {label}
    </a>
  )
}

/**
 * Adres açılıştan ve her gezinmeden sonra `window.location`'dan yeniden hesaplanıp bağlantıya
 * yazılır. `usePathname` yeniden yazılan (`/en/*`) sayfalarda sunucuda ve istemcide farklı yol
 * verebilir (Next belgesi: "Avoid hydration mismatch with rewrites"); bu yüzden kancalar yalnızca
 * "adres değişti" sinyalidir. `useSearchParams`, haritanın `history.replaceState` ile değiştirdiği
 * `?hex=`'i de izler. Etki çalıştığında Next yeni adresi geçmişe yazmıştır. Kök layout istemci
 * gezinmesinde yeniden çizilmediğinden sunucunun adresi (`initialHref`) değişmez; bağlantı DOM'da
 * güncellenir (durum ve ikinci çizim gerekmez).
 */
function LiveToggle({ target, label, initialHref }: LanguageToggleProps) {
  const ref = useRef<HTMLAnchorElement>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    const { pathname: current, search } = window.location
    ref.current?.setAttribute('href', languageToggleHrefFromLocation(target, current, search))
  }, [target, pathname, searchParams])
  return <ToggleLink ref={ref} target={target} label={label} href={initialHref} />
}

/**
 * Dil değiştirme bağlantısı: diğer dildeki aynı sayfaya düz `<a>` (tam sayfa yüklemesi). `<Link>`
 * kullanılmaz: kök layout istemci gezinmesinde yeniden çizilmez, `<html lang>` ve menü eski dilde
 * kalırdı. `useSearchParams` ön işlemede Suspense sınırı ister; o sırada sunucunun adresi çizilir.
 */
export function LanguageToggle(props: LanguageToggleProps) {
  return (
    <Suspense
      fallback={<ToggleLink target={props.target} label={props.label} href={props.initialHref} />}
    >
      <LiveToggle {...props} />
    </Suspense>
  )
}
