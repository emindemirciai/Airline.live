'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
// Göreli yollar: vitest `@/` takma adını çözmez; bu eylem testte doğrudan çağrılır.
import { ADMIN_COOKIE, setLiveLayer } from '../../../lib/admin-api'
import { clientForwardHeaders } from '../../../lib/forwarded'
import {
  LIVE_LAYER_PAGE_PATH,
  LIVE_LAYER_RESULT_PARAM,
  LIVE_LAYER_RESULTS,
  parseLiveLayerEnabled,
  parseLiveLayerReason,
} from '../../../lib/live-layer'

export type LiveLayerFormError = 'invalid' | 'no_database' | 'unavailable'

export interface LiveLayerFormState {
  error: LiveLayerFormError | null
}

/**
 * "Canlı katmanı kapat / aç" formu (POST, Next server action: Origin/Host denetimi; çerez
 * `SameSite=Strict`). Alanlar geçersizse API çağrılmaz. Başarıda sayfa yeni durumla yeniden açılır
 * (`?sonuc=kapatildi|acildi`); oturum yoksa ya da API reddederse giriş sayfasına gider.
 */
export async function setLiveLayerAction(
  _previous: LiveLayerFormState,
  formData: FormData,
): Promise<LiveLayerFormState> {
  const enabled = parseLiveLayerEnabled(formData.get('enabled'))
  const reason = parseLiveLayerReason(formData.get('reason'))
  if (enabled === null || !reason.ok) return { error: 'invalid' }
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!token) redirect('/admin/giris')

  const result = await setLiveLayer(token, await clientForwardHeaders(), {
    enabled,
    reason: reason.reason,
  })
  if (result.ok) {
    const value = result.layer.enabled ? LIVE_LAYER_RESULTS.on : LIVE_LAYER_RESULTS.off
    redirect(`${LIVE_LAYER_PAGE_PATH}?${LIVE_LAYER_RESULT_PARAM}=${value}`)
  }
  if (result.reason === 'unauthorized') redirect('/admin/giris')
  return { error: result.reason }
}
