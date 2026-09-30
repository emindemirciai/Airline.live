import { getMessages } from '@havayolu/i18n'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/json-ld'
import { LiveMap } from '@/components/map/live-map'
import { analyticsConfig, appName, getServerEnv } from '@/lib/env'
import { getLocale } from '@/lib/locale'
import { resolveMapConfig } from '@/lib/map-config'
import { parseAirportParam, parseHexParam } from '@/lib/map/url-state'
import { pageMetadata } from '@/lib/seo/metadata'
import { websiteGraph } from '@/lib/seo/structured-data'

/**
 * Kök yolda başlık şablonu (`%s · havayolu`, layout.tsx) uygulanmaz: şablon yalnızca alt yollara
 * geçer. Aynı biçim burada açıkça kurulur. Kanonik adres her zaman `/` (EN `/en`) olur: `?hex=` ve
 * `?havalimani=` aynı sayfanın görünümleridir (M6b brief §b).
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = getMessages(locale).seo.home
  return pageMetadata({
    locale,
    path: '/',
    title: `${t.title} · ${appName(getServerEnv())}`,
    absoluteTitle: true,
    description: t.description,
  })
}

/**
 * Kök adres: canlı harita. Altlık ve API adresleri çalışma zamanında sunucu ortamından çözülür
 * (NEXT_PUBLIC_* yok, D-075); `?hex=` paylaşılan bağlantıdaki seçili uçak, `?havalimani=` açılışta
 * ortalanan havalimanıdır (havalimanı sayfasındaki "Canlı haritada aç"). Harita sayfasında alt
 * bilgi gizlidir; analiz açıksa tercih düğmesi harita denetimlerine taşınır.
 */
export default async function MapPage({ searchParams }: PageProps<'/'>) {
  const locale = await getLocale()
  const t = getMessages(locale)
  const messages = t.map
  const env = getServerEnv()
  const config = resolveMapConfig(env)
  const { hex, havalimani } = await searchParams

  return (
    <>
      <JsonLd data={websiteGraph(locale)} />
      <div className="map-page">
        {/* Sayfa başlığı ekran okuyucu içindir; görsel başlık haritanın kendisidir. */}
        <h1 className="sr-only">{messages.title}</h1>
        <LiveMap
          config={config}
          locale={locale}
          messages={messages}
          initialHex={parseHexParam(hex)}
          initialAirport={parseAirportParam(havalimani)}
          consentSettingsLabel={analyticsConfig(env) ? t.consent.settings : null}
        />
      </div>
    </>
  )
}
