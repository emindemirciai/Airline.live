'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

const noop = () => () => {}

/**
 * Ham METAR/TAF metnini panoya kopyalayan düğme (M6c). Yalnızca JavaScript ve pano erişimi varken
 * çizilir: sunucu çiziminde ve hidrasyonda yoktur, JavaScript'siz sayfada işe yaramaz düğme kalmaz.
 */
export function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const available = useSyncExternalStore(
    noop,
    () => typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function',
    () => false,
  )
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  if (!available) return null
  return (
    <button
      type="button"
      className="button button-secondary weather-copy"
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => setCopied(false),
        )
      }}
    >
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  )
}
