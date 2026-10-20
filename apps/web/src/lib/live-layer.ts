import { z } from 'zod'

/**
 * Admin canlı katman sayfasının (`/admin/canli-katman`, Parça 1 M7d.1, D-115) saf yardımcıları:
 * API yanıt şeması ve form alanlarının denetimi. Sunucu bileşeni, server action ve API istemcisi
 * bunları paylaşır.
 */

export const LIVE_LAYER_PAGE_PATH = '/admin/canli-katman'
/** API uç noktası (`apps/api/src/admin/live-layer.ts`). */
export const LIVE_LAYER_API_PATH = '/v1/admin/live-layer'
/** Neden metninin en uzun hâli (karakter; API ve tablo denetimiyle aynı). */
export const LIVE_LAYER_REASON_MAX = 500
/** Başarılı değişiklikten sonra sayfanın sorgusu: yeni durum (sonuç satırı için). */
export const LIVE_LAYER_RESULT_PARAM = 'sonuc'
export const LIVE_LAYER_RESULTS = { on: 'acildi', off: 'kapatildi' } as const

/** Sorgudaki sonuç değeri; tanınmıyorsa null. */
export function parseLiveLayerResult(value: unknown): 'on' | 'off' | null {
  const raw = Array.isArray(value) ? (value as unknown[])[0] : value
  if (raw === LIVE_LAYER_RESULTS.on) return 'on'
  if (raw === LIVE_LAYER_RESULTS.off) return 'off'
  return null
}

const isoTime = z.string().refine((value) => Number.isFinite(Date.parse(value)))

export const LiveLayerSchema = z.object({
  enabled: z.boolean(),
  updatedAt: isoTime.nullable(),
  updatedBy: z.string().nullable(),
  actions: z.array(
    z.object({
      at: isoTime,
      actor: z.string(),
      action: z.enum(['on', 'off']),
      reason: z.string().nullable(),
    }),
  ),
})

export type LiveLayerState = z.infer<typeof LiveLayerSchema>
export type LiveLayerAction = LiveLayerState['actions'][number]

/** Formun gizli `enabled` alanı: yalnızca "true" ya da "false". */
export function parseLiveLayerEnabled(value: unknown): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

/**
 * Formun `reason` alanı: kırpılır, boşsa null; 500 karakterden (kod noktası) uzunsa `invalid`.
 * Alan yoksa null.
 */
export function parseLiveLayerReason(
  value: unknown,
): { ok: true; reason: string | null } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, reason: null }
  if (typeof value !== 'string') return { ok: false }
  const trimmed = value.replaceAll('\u0000', '').trim()
  if ([...trimmed].length > LIVE_LAYER_REASON_MAX) return { ok: false }
  return { ok: true, reason: trimmed === '' ? null : trimmed }
}

/** Yönetim zamanı: Türkiye saatiyle kısa tarih ve saniyeli saat. */
export function formatLiveLayerTime(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso))
}
