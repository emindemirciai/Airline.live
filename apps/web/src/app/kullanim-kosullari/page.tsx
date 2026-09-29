import { getMessages } from '@havayolu/i18n'
import type { Metadata } from 'next'
import { TermsContent } from '@/components/terms-content'
import { appName, getServerEnv } from '@/lib/env'
import { getLocale } from '@/lib/locale'

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).terms.title }
}

/**
 * Geçici kullanım koşulları (D-075): Esri şartlarına uyma maddesi (E204 §3.1c.5) ve ODbL maddesi.
 * Dil, diğer sayfalardaki gibi çerezden gelir; adres iki dilde aynıdır.
 */
export default async function TermsPage() {
  const locale = await getLocale()
  return <TermsContent locale={locale} app={appName(getServerEnv())} />
}
