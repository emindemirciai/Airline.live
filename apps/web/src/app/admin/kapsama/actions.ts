'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
// Göreli yollar: vitest `@/` takma adını çözmez; bu eylem testte doğrudan çağrılır.
import { ADMIN_COOKIE, requestCoverageReport } from '../../../lib/admin-api'
import { coverageReportHref, parseCoverageHours } from '../../../lib/arrival-coverage'
import { clientForwardHeaders } from '../../../lib/forwarded'

export type StartCoverageError = 'invalid_hours' | 'active' | 'rate_limited' | 'unavailable'

export interface StartCoverageState {
  error: StartCoverageError | null
}

/**
 * "Raporu başlat" formu (POST, Next server action: Origin/Host denetimi; çerez `SameSite=Strict`).
 * Saat izinli listede değilse API çağrılmaz. Başarıda yeni raporun sayfasına gider; oturum yoksa ya
 * da API reddederse giriş sayfasına.
 */
export async function startCoverageReportAction(
  _previous: StartCoverageState,
  formData: FormData,
): Promise<StartCoverageState> {
  const hours = parseCoverageHours(formData.get('hours'))
  if (hours === null) return { error: 'invalid_hours' }
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!token) redirect('/admin/giris')

  const result = await requestCoverageReport(token, hours, await clientForwardHeaders())
  if (result.ok) redirect(coverageReportHref(result.id))
  if (result.reason === 'unauthorized') redirect('/admin/giris')
  return { error: result.reason }
}
