'use client'

import { format, type Messages } from '@havayolu/i18n'
import type { CoverageState, LiveStatus, ProviderState } from '@havayolu/shared'
import { useState } from 'react'
import type { ConnectionState } from '../../../lib/live/connection'

export interface StatusStripProps {
  status: LiveStatus | null
  coverage: CoverageState | null
  connection: ConnectionState
  basemapFailed: boolean
  /** Saniyelik saat (ms); sağlayıcı sorunluyken veri yaşı iki mesaj arasında da ilerler. */
  now: number
  messages: Messages['map']['status']
}

type StatusMessageKey = Exclude<keyof Messages['map']['status'], 'freshness'>

/** Şeridin genel tonu: gösterge noktasının rengi (anlamı metin taşır, renk yalnızca destektir). */
export type StatusTone = 'ok' | 'warn' | 'down'

export interface StatusSummary {
  tone: StatusTone
  /** Öncelik sırasıyla gösterilecek uyarılar. */
  notices: StatusMessageKey[]
}

/**
 * Sağlayıcıların birleşik durumu (data-sources.md → Sağlayıcı durumu). Yapılandırılmış sağlayıcı
 * yoksa `none`; hepsi `down` ise `down`; biri bile `down` ya da `degraded` ise `degraded`; değilse
 * biri `limited` ise (günlük bütçeyle seyrek sorgu, D-122) `limited`; hepsi `ok` ise `ok`.
 */
export function providerHealth(status: LiveStatus): ProviderState | 'none' {
  const states = Object.values(status.providers).filter(
    (state): state is ProviderState => state !== undefined,
  )
  if (states.length === 0) return 'none'
  if (states.every((state) => state === 'down')) return 'down'
  if (states.some((state) => state === 'down' || state === 'degraded')) return 'degraded'
  if (states.some((state) => state === 'limited')) return 'limited'
  return 'ok'
}

/**
 * Gösterilecek uyarılar, öncelik sırasıyla: bağlantı sorunu, canlı katman kapalı (D-115),
 * sağlayıcı yok / kapalı / sorunlu / seyrek (D-122), kapsama dışı alan, harita altlığı. Bağlantı açık değilken
 * eldeki durum bayat olduğundan katman, sağlayıcı ve kapsama uyarıları gösterilmez. Katman
 * kapalıyken haritada hiçbir uçak olmadığından sağlayıcı ve kapsama uyarıları da gösterilmez.
 */
export function summarizeStatus(
  status: LiveStatus | null,
  coverage: CoverageState | null,
  connection: ConnectionState,
  basemapFailed: boolean,
): StatusSummary {
  const notices: StatusMessageKey[] = []
  let tone: StatusTone = 'ok'
  if (connection !== 'open') {
    notices.push(connection)
    tone = connection === 'offline' ? 'down' : 'warn'
  } else if (status?.layer === 'off') {
    notices.push('layerOff')
    tone = 'down'
  } else {
    const health = status ? providerHealth(status) : 'ok'
    if (health === 'none') {
      notices.push('noProvider')
      tone = 'down'
    } else if (health === 'down') {
      notices.push('providerDown')
      tone = 'down'
    } else if (health === 'degraded') {
      notices.push('providerDegraded')
      tone = 'warn'
    } else if (health === 'limited') {
      notices.push('providerLimited')
      tone = 'warn'
    }
    if (coverage === 'none') notices.push('coverageNone')
    else if (coverage === 'partial') notices.push('coveragePartial')
  }
  if (basemapFailed) notices.push('basemapFailed')
  return { tone, notices }
}

/**
 * Veri yaşı, sn: birincil istasyonun tazeliği (`primaryAgeS`, adsb.lol sağlık kaydından), yoksa en
 * yeni örneğin yaşı; sunucunun son durum mesajındaki değer. Bilinmiyorsa null.
 *
 * Sunucu yalnızca görünümde bir değişiklik olunca mesaj gönderir. Son durumda sağlayıcılar `ok` ise
 * (data-sources.md → Sağlayıcı durumu: son 60 sn'de başarılı yanıt, istasyon tazeliği hedefte) besleme
 * işliyor demektir; mesaj gelmemesi yalnızca görünümde hareket olmadığını gösterir ve yaş olduğu gibi
 * gösterilir (sakin bölgede sayaç yanıltıcı biçimde artmaz). Sağlayıcı sorunluysa, seyrekse (`limited`)
 * ya da yoksa besleme gecikiyor demektir; mesajdan bu yana geçen süre eklenir. Durumun bayat kalmaması için uzun
 * sessizlikte abonelik yenilenir (use-live.ts, `SILENCE_REFRESH_MS`).
 */
export function dataAgeSeconds(status: LiveStatus | null, elapsedMs: number): number | null {
  if (!status) return null
  const base = status.primaryAgeS ?? status.newestAgeS
  if (base === null || !Number.isFinite(base)) return null
  const elapsed = providerHealth(status) === 'ok' ? 0 : Math.max(0, elapsedMs) / 1000
  return Math.max(0, Math.round(base + elapsed))
}

/**
 * Haritanın durum şeridi. Uyarılar `role="status"` bölgesindedir (değişince ekran okuyucu okur);
 * her saniye değişen veri yaşı bu bölgenin dışında tutulur, yoksa her saniye duyurulurdu.
 */
export function StatusStrip({
  status,
  coverage,
  connection,
  basemapFailed,
  now,
  messages,
}: StatusStripProps) {
  // Son durum mesajının geldiği an: `status` her mesajda yeni bir nesnedir. Önceki çizimden türetilen
  // durum (React belgesi: "storing information from previous renders").
  const [received, setReceived] = useState({ status, at: now })
  if (received.status !== status) setReceived({ status, at: now })

  const { tone, notices } = summarizeStatus(status, coverage, connection, basemapFailed)
  const age = connection === 'open' ? dataAgeSeconds(status, now - received.at) : null

  return (
    <div
      className="map-panel map-status"
      data-tone={tone}
      data-idle={notices.length === 0 && age === null ? 'true' : undefined}
    >
      <span className="map-status__dot" aria-hidden="true" />
      <div className="map-status__text">
        <p role="status" className="map-status__notices">
          {notices.map((key) => (
            <span key={key} className="map-status__notice">
              {messages[key]}
            </span>
          ))}
        </p>
        {age !== null ? (
          <p className="map-status__age mono">{format(messages.freshness, { s: age })}</p>
        ) : null}
      </div>
    </div>
  )
}
