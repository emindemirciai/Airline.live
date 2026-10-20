import { getMessages } from '@havayolu/i18n'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ADMIN_COOKIE, fetchLiveLayer } from '@/lib/admin-api'
import { clientForwardHeaders } from '@/lib/forwarded'
import { LIVE_LAYER_RESULT_PARAM, parseLiveLayerResult } from '@/lib/live-layer'
import { getLocale } from '@/lib/locale'
import { logoutAction } from '../actions'
import { AdminNav } from '../admin-nav'
import { LiveLayerForm } from './layer-form'
import { LiveLayerLog, LiveLayerStatus } from './live-layer-view'

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).admin.liveLayer.title }
}

/**
 * Canlı katman anahtarı (Parça 1 M7d.1, D-115): durum, son değişiklik, tek düğmeli form ve işlem
 * kaydı. Telefondan kullanılır (düğme tam genişlik, en az 2,5 rem). Yönetim gibi yalnızca
 * Türkçedir ve arama motorlarına kapalıdır (layout).
 */
export default async function AdminLiveLayerPage({
  searchParams,
}: PageProps<'/admin/canli-katman'>) {
  await connection()
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!token) redirect('/admin/giris')

  const admin = getMessages(await getLocale()).admin
  const t = admin.liveLayer
  const params = await searchParams
  const changed = parseLiveLayerResult(params[LIVE_LAYER_RESULT_PARAM])
  const result = await fetchLiveLayer(token, await clientForwardHeaders())
  if (!result.ok && result.reason === 'unauthorized') redirect('/admin/giris')

  return (
    <article className="page page-wide live-layer-page">
      <AdminNav
        current="live"
        labels={{
          label: admin.navLabel,
          services: admin.servicesTitle,
          coverage: admin.coverage.title,
          live: t.title,
        }}
      />
      <header className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p className="lead">{t.intro}</p>
        </div>
        <div className="actions">
          <form action={logoutAction}>
            <button type="submit" className="button button-secondary">
              {admin.logout}
            </button>
          </form>
        </div>
      </header>

      {result.ok ? (
        <>
          <section aria-labelledby="live-layer-state">
            <h2 id="live-layer-state" className="sr-only">
              {t.state}
            </h2>
            <LiveLayerStatus layer={result.layer} result={changed} t={t} />
            <LiveLayerForm
              enabled={result.layer.enabled}
              labels={{
                reason: t.reason,
                reasonHint: t.reasonHint,
                turnOff: t.turnOff,
                turnOn: t.turnOn,
                pending: t.pending,
                errors: t.errors,
              }}
            />
          </section>
          <section aria-labelledby="live-layer-log">
            <h2 id="live-layer-log">{t.log.heading}</h2>
            <LiveLayerLog actions={result.layer.actions} t={t} />
          </section>
        </>
      ) : (
        <p role="alert" className="form-error">
          {result.reason === 'no_database' ? t.noDatabase : t.fetchFailed}
        </p>
      )}
    </article>
  )
}
