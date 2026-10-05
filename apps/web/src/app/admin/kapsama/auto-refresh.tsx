'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AutoRefreshLoop, nextRefreshActiveId } from './auto-refresh-loop'

export interface AutoRefreshLabels {
  active: string
  stopped: string
  restart: string
}

/**
 * Etkin (kuyrukta ya da çalışan) rapor varken sayfayı 5 sn'de bir yeniler; 25 dk sonra durur ve
 * iletiyle "Yenile" düğmesini gösterir. Etkin rapor değişince ya da düğmeye basılınca süre yeniden
 * başlar. Etkin rapor yoksa hiçbir şey çizmez.
 *
 * `activeId` `undefined` ise sayfa listeyi alamamıştır: bileşen son bilinen etkin raporla devam
 * eder (sayfa onu her durumda aynı yerde çizer, durum korunur). Tek bir başarısız yenileme döngüyü
 * kalıcı olarak durdurmaz.
 */
export function AutoRefresh({
  activeId,
  labels,
}: {
  activeId: number | null | undefined
  labels: AutoRefreshLabels
}) {
  const router = useRouter()
  const [generation, setGeneration] = useState(0)
  const [stoppedKey, setStoppedKey] = useState<string | null>(null)
  // Önceki çizimden kalan bilgi (React: "storing information from previous renders").
  const [known, setKnown] = useState<number | null>(activeId ?? null)
  const current = nextRefreshActiveId(known, activeId)
  if (current !== known) setKnown(current)
  const key = current === null ? null : `${current}:${generation}`

  useEffect(() => {
    if (key === null) return
    const loop = new AutoRefreshLoop({
      refresh: () => router.refresh(),
      onStop: () => setStoppedKey(key),
    })
    loop.start()
    return () => loop.stop()
  }, [key, router])

  if (key === null) return null
  const stopped = stoppedKey === key
  return (
    <div className="coverage-refresh" role="status">
      <p>{stopped ? labels.stopped : labels.active}</p>
      {stopped ? (
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            setGeneration((value) => value + 1)
            router.refresh()
          }}
        >
          {labels.restart}
        </button>
      ) : null}
    </div>
  )
}
