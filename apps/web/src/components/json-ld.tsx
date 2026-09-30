/**
 * schema.org yapılandırılmış verisi için tek bir `<script type="application/ld+json">`.
 * - Tek düğüm `@context` ile, düğüm dizisi `@graph` olarak sarılır; hazır `@context` korunur.
 * - `<` karakteri `\u003c` kaçış dizisiyle yazılır: veri içindeki `</script>` betiği erken kapatamaz
 *   (Next.js JSON-LD kılavuzu, node_modules/next/dist/docs/01-app/02-guides/json-ld.md).
 * - Sayfanın en üst düzeyinde (Suspense dışında) çizilir; tarayıcıda çalışan kod gerekmez.
 */
const SCHEMA_CONTEXT = 'https://schema.org'

type JsonLdData = object | readonly object[]

export function jsonLdDocument(data: JsonLdData): object {
  if (Array.isArray(data)) return { '@context': SCHEMA_CONTEXT, '@graph': data }
  return '@context' in data ? data : { '@context': SCHEMA_CONTEXT, ...data }
}

/** Betik içine güvenle gömülebilen JSON metni. */
export function serializeJsonLd(data: JsonLdData): string {
  return JSON.stringify(jsonLdDocument(data)).replace(/</g, '\\u003c')
}

export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
