import { getMessages } from '@havayolu/i18n'
import type { Metadata } from 'next'
import { LiveMap } from '@/components/map/live-map'
import { analyticsConfig, appName, getServerEnv } from '@/lib/env'
import { getLocale } from '@/lib/locale'
import { resolveMapConfig } from '@/lib/map-config'
import { parseHexParam } from '@/lib/map/url-state'

/**
 * Kök yolda başlık şablonu (`%s · havayolu`, layout.tsx) uygulanmaz: şablon yalnızca alt yollara
 * geçer. Aynı biçim burada açıkça kurulur.
 */
export async function generateMetadata(): Promise<Metadata> {
  const title = getMessages(await getLocale()).map.title
  return { title: { absolute: `${title} · ${appName(getServerEnv())}` } }
}

/**
 * Kök adres: canlı harita. Altlık ve API adresleri çalışma zamanında sunucu ortamından çözülür
 * (NEXT_PUBLIC_* yok, D-075); `?hex=` paylaşılan bağlantıdaki seçili uçaktır. Harita sayfasında alt
 * bilgi gizlidir; analiz açıksa tercih düğmesi harita denetimlerine taşınır.
 */
export default async function MapPage({ searchParams }: PageProps<'/'>) {
  const locale = await getLocale()
  const t = getMessages(locale)
  const messages = t.map
  const env = getServerEnv()
  const config = resolveMapConfig(env)
  const { hex } = await searchParams

  return (
    <div className="map-page">
      {/* Sayfa başlığı ekran okuyucu içindir; görsel başlık haritanın kendisidir. */}
      <h1 className="sr-only">{messages.title}</h1>
      <LiveMap
        config={config}
        locale={locale}
        messages={messages}
        initialHex={parseHexParam(hex)}
        consentSettingsLabel={analyticsConfig(env) ? t.consent.settings : null}
      />
    </div>
  )
}
