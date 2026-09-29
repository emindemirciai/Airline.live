'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  OPEN_CONSENT_EVENT,
  type ConsentValue,
} from '@/lib/consent'

export interface AnalyticsConsentProps {
  trackerUrl: string
  siteId: string
  initialConsent: ConsentValue | null
  secure: boolean
  labels: { title: string; body: string; accept: string; reject: string }
}

function writeConsentCookie(value: ConsentValue, secure: boolean) {
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure ? '; Secure' : ''}`
}

function injectTracker(trackerUrl: string, siteId: string) {
  if (document.querySelector('script[data-hy-analytics]')) return
  const script = document.createElement('script')
  script.src = trackerUrl
  script.defer = true
  script.dataset.site = siteId
  script.dataset.hyAnalytics = 'true'
  document.head.appendChild(script)
}

/**
 * KVKK Çerez Rehberi: analiz script'i kalıcı ziyaretçi kimliği tuttuğu için yalnızca açık onayla
 * yüklenir. Onay yoksa bant gösterilir; "Kabul et" ve "Reddet" eşit ağırlıktadır. Admin sayfaları
 * hiçbir zaman ölçülmez.
 */
export function AnalyticsConsent({
  trackerUrl,
  siteId,
  initialConsent,
  secure,
  labels,
}: AnalyticsConsentProps) {
  const pathname = usePathname() ?? '/'
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  const [consent, setConsent] = useState<ConsentValue | null>(initialConsent)
  const [open, setOpen] = useState(initialConsent === null)

  useEffect(() => {
    if (consent === 'granted' && !isAdmin) injectTracker(trackerUrl, siteId)
  }, [consent, isAdmin, trackerUrl, siteId])

  useEffect(() => {
    const reopen = () => setOpen(true)
    window.addEventListener(OPEN_CONSENT_EVENT, reopen)
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen)
  }, [])

  const choose = useCallback(
    (value: ConsentValue) => {
      writeConsentCookie(value, secure)
      setOpen(false)
      // Önceden yüklenmiş script'i durdurmanın tek güvenli yolu sayfayı yenilemektir.
      if (value === 'denied' && document.querySelector('script[data-hy-analytics]')) {
        window.location.reload()
        return
      }
      setConsent(value)
    },
    [secure],
  )

  if (!open || isAdmin) return null
  return (
    <section className="consent" role="dialog" aria-labelledby="consent-title" aria-live="polite">
      <h2 id="consent-title">{labels.title}</h2>
      <p>{labels.body}</p>
      <div className="consent-actions">
        <button type="button" className="button button-secondary" onClick={() => choose('denied')}>
          {labels.reject}
        </button>
        <button type="button" className="button button-secondary" onClick={() => choose('granted')}>
          {labels.accept}
        </button>
      </div>
    </section>
  )
}

/**
 * Analiz tercihini yeniden açan düğme (onay bandını gösterir). Alt bilgide ve alt bilginin gizli
 * olduğu harita sayfasında harita denetimlerinde durur: onay, verildiği kadar kolay geri alınabilir
 * (KVKK, GDPR md. 7/3).
 */
export function ConsentSettingsButton({
  label,
  className = 'link-button',
}: {
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
    >
      {label}
    </button>
  )
}
