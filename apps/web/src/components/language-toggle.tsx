'use client'

import type { Locale } from '@havayolu/shared'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
// Göreli yol: vitest `@/` takma adını çözmez ve bu dosyanın saf fonksiyonu test edilir.
import { DEFAULT_PATH } from '../lib/safe-path'

interface LanguageToggleProps {
  target: Locale
  label: string
}

/**
 * /dil uç noktasının adresi. Dönüş hedefi (`next`) sayfanın yolu ve sorgu metnidir; böylece seçili
 * uçak (`/?hex=…`) dil değişince korunur. Yol bilinmiyorsa kök adrese (harita) dönülür. Hedef
 * sunucuda yine `safeNextPath` ile denetlenir.
 */
export function languageToggleHref(
  target: Locale,
  pathname: string | null | undefined,
  search: string | null | undefined = '',
): string {
  const path = pathname && pathname.startsWith('/') ? pathname : DEFAULT_PATH
  const query = (search ?? '').replace(/^\?/, '')
  const next = query === '' ? path : `${path}?${query}`
  return `/dil?to=${target}&next=${encodeURIComponent(next)}`
}

function ToggleLink({ target, label, href }: LanguageToggleProps & { href: string }) {
  return (
    <a href={href} hrefLang={target} lang={target} className="lang-toggle">
      {label}
    </a>
  )
}

/** Sorgu metnini de taşıyan sürüm; `history.replaceState` ile değişen `?hex=` de izlenir. */
function ToggleWithQuery({ target, label }: LanguageToggleProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return (
    <ToggleLink
      target={target}
      label={label}
      href={languageToggleHref(target, pathname, searchParams.toString())}
    />
  )
}

/**
 * Dil tercihini çerezle kaydeden /dil uç noktasına gider ve aynı sayfaya (sorgu metniyle) geri döner.
 * `useSearchParams` ön işlemede Suspense sınırı ister; o sırada yalnızca yolu taşıyan bağlantı çizilir.
 */
export function LanguageToggle({ target, label }: LanguageToggleProps) {
  const pathname = usePathname()
  return (
    <Suspense
      fallback={
        <ToggleLink target={target} label={label} href={languageToggleHref(target, pathname)} />
      }
    >
      <ToggleWithQuery target={target} label={label} />
    </Suspense>
  )
}
