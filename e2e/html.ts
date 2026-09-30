// Sunucunun döndürdüğü ham HTML, robots.txt, sitemap.xml ve llms.txt için küçük ayrıştırıcılar. Arama
// motoru ve yapay zekâ tarayıcıları JavaScript çalıştırmadan ham yanıtı okur; SEO testleri de bu yüzden
// tarayıcı DOM'unu değil, `request` ile alınan metni denetler. Tam bir HTML ayrıştırıcısı değildir:
// React öznitelik değerlerinde `<`, `>` ve `"` karakterlerini kaçırdığı için etiket sınırı güvenle bulunur.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** HTML karakter varlıklarını (`&amp;`, `&#x27;`, `&#39;`) çözer. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#')) {
      const hex = code[1] === 'x' || code[1] === 'X'
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(point) ? String.fromCodePoint(point) : match
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}

export type Attributes = Record<string, string>

function parseAttributes(source: string): Attributes {
  const attributes: Attributes = {}
  for (const match of source.matchAll(
    /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g,
  )) {
    const name = match[1]?.toLowerCase()
    if (name) attributes[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attributes
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Adı verilen bütün açılış etiketlerinin öznitelikleri; öznitelik adları küçük harfe çevrilir. */
export function tags(html: string, name: string): Attributes[] {
  const pattern = new RegExp(`<${escapeRegExp(name)}(?=[\\s/>])([^>]*)>`, 'gi')
  return [...html.matchAll(pattern)].map((match) => parseAttributes(match[1] ?? ''))
}

/** `<head>` ile `</head>` arasındaki metin; bulunamazsa boş metin. */
export function headOf(html: string): string {
  const start = html.search(/<head[\s>]/i)
  const end = html.search(/<\/head>/i)
  return start >= 0 && end > start ? html.slice(start, end) : ''
}

/** `<html lang>` değeri. */
export function htmlLang(html: string): string | undefined {
  return tags(html, 'html')[0]?.lang
}

/** Bütün `<title>` metinleri (kaynaktaki sırayla). */
export function titles(html: string): string[] {
  return [...html.matchAll(/<title(?:\s[^>]*)?>([^<]*)<\/title>/gi)].map((match) =>
    decodeEntities(match[1] ?? '').trim(),
  )
}

/** `rel` değeri verilen `<link>` öğeleri (`rel` birden çok değer taşıyabilir). */
export function linksByRel(html: string, rel: string): Attributes[] {
  return tags(html, 'link').filter((link) =>
    (link.rel ?? '').toLowerCase().split(/\s+/).includes(rel),
  )
}

/** `<link rel="alternate" hreflang>` öğeleri: dil kodu → adres. */
export function hreflangs(html: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const link of linksByRel(html, 'alternate')) {
    if (link.hreflang && link.href) result[link.hreflang] = link.href
  }
  return result
}

/** `name` ya da `property` özniteliği verilen `<meta>` öğelerinin `content` değerleri. */
export function metaContents(html: string, key: string): string[] {
  return tags(html, 'meta')
    .filter((meta) => meta.name === key || meta.property === key)
    .map((meta) => meta.content ?? '')
}

export type JsonLdNode = Record<string, unknown>

/**
 * Sayfadaki bütün `<script type="application/ld+json">` blokları. Her blok `JSON.parse` ile okunur;
 * bozuk blok testi düşürür.
 */
export function jsonLdBlocks(html: string): unknown[] {
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  return [...html.matchAll(pattern)].map((match) => JSON.parse(match[1] ?? '') as unknown)
}

function isNode(value: unknown): value is JsonLdNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * JSON-LD bloklarındaki `@type` taşıyan bütün düğümler, iç içe olanlar dahil (`@graph`, `mainEntity`,
 * `breadcrumb`, `itemListElement`…). Yalnızca `@id` taşıyan başvurular düğüm sayılmaz.
 */
export function jsonLdNodes(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!isNode(value)) return
    if (value['@type'] !== undefined) nodes.push(value)
    Object.values(value).forEach(visit)
  }
  jsonLdBlocks(html).forEach(visit)
  return nodes
}

/** Düğümün `@type` değerleri (tek metin ya da dizi olabilir). */
export function nodeTypes(node: JsonLdNode): string[] {
  const type = node['@type']
  if (typeof type === 'string') return [type]
  return Array.isArray(type) ? type.filter((t): t is string => typeof t === 'string') : []
}

/** `@type` değerlerinden biri `type` olan düğümler. */
export function nodesOfType(nodes: JsonLdNode[], type: string): JsonLdNode[] {
  return nodes.filter((node) => nodeTypes(node).includes(type))
}

export interface RobotsGroup {
  userAgents: string[]
  /** Kural satırları; yönerge adı küçük harfe çevrilir: `disallow: /admin`. */
  rules: string[]
}

export interface RobotsFile {
  groups: RobotsGroup[]
  sitemaps: string[]
  /** Grup dışı diğer satırlar (`host: …`). */
  global: string[]
}

/**
 * robots.txt'yi RFC 9309 gruplarına ayırır: art arda gelen `User-agent` satırları tek grup açar,
 * sonraki kurallar o gruba aittir. `Sitemap` ve `Host` grup dışıdır.
 */
export function parseRobots(text: string): RobotsFile {
  const groups: RobotsGroup[] = []
  const sitemaps: string[] = []
  const global: string[] = []
  let current: RobotsGroup | undefined
  let lastWasAgent = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    const separator = line.indexOf(':')
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()
    if (key === 'sitemap') {
      sitemaps.push(value)
      continue
    }
    if (key === 'host') {
      global.push(`${key}: ${value}`)
      continue
    }
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { userAgents: [], rules: [] }
        groups.push(current)
      }
      current.userAgents.push(value)
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    current?.rules.push(`${key}: ${value}`)
  }
  return { groups, sitemaps, global }
}

export interface SitemapEntry {
  loc: string
  lastmod: string | undefined
  /** `xhtml:link rel="alternate"`: dil kodu → adres. */
  alternates: Record<string, string>
}

/** sitemap.xml'deki `<url>` girdileri. */
export function parseSitemap(xml: string): SitemapEntry[] {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
    const body = match[1] ?? ''
    const alternates: Record<string, string> = {}
    for (const link of tags(body, 'xhtml:link')) {
      if (link.rel === 'alternate' && link.hreflang && link.href) {
        alternates[link.hreflang] = link.href
      }
    }
    return {
      loc: decodeEntities(/<loc>([^<]*)<\/loc>/.exec(body)?.[1]?.trim() ?? ''),
      lastmod: /<lastmod>([^<]*)<\/lastmod>/.exec(body)?.[1]?.trim(),
      alternates,
    }
  })
}

/** Markdown bağlantılarının (`[metin](adres)`) adresleri. */
export function markdownLinks(text: string): { label: string; href: string }[] {
  return [...text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((match) => ({
    label: match[1] ?? '',
    href: match[2] ?? '',
  }))
}

/** PNG dosyasının genişlik ve yüksekliği (IHDR); PNG değilse null. */
export function pngSize(bytes: Buffer): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || signature.some((byte, i) => bytes[i] !== byte)) return null
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}
