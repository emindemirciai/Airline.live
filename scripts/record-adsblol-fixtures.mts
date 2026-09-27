// adsb.lol'den test fixture'ı alır (canlı istek; yalnızca kullanıcı onayıyla ve elle çalıştırılır,
// CLAUDE.md DUR-SOR 6, parça-1 M3). Kurallar (data-sources.md §1):
// - En fazla 5 istek, aralarında en az 10 sn. 200 dışında bir yanıt gelirse hemen durur.
// - Tanımlayıcı User-Agent zorunlu; iletişim adresi yalnızca ortam değişkeninden gelir
//   (CONTACT_EMAIL) ve hiçbir dosyaya yazılmaz.
// Kullanım (tek satır):
//   CONTACT_EMAIL=<adres> pnpm exec tsx scripts/record-adsblol-fixtures.mts --confirm
// Çıktı: tools/fixtures/adsblol/<ad>.json (yanıt gövdesi olduğu gibi) ve index.json (istek listesi,
// durum kodu, zaman; kimlik bilgisi yok).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://api.adsb.lol'
const MAX_REQUESTS = 5
const SPACING_MS = 12_000
/** LTFM havalimanı merkezi (OurAirports fixture'ı). */
const LTFM = { lat: 41.2749, lon: 28.7321 }

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(root, 'tools', 'fixtures', 'adsblol')
const email = process.env.CONTACT_EMAIL?.trim()
if (!process.argv.includes('--confirm')) {
  console.error('Canlı istek atar; kullanıcı onayı alındıysa --confirm ile çalıştır.')
  process.exit(1)
}
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('CONTACT_EMAIL tanımlı değil (User-Agent için zorunlu, data-sources.md §1).')
  process.exit(1)
}
const version = (
  JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }
).version
const userAgent = `havayolu/${version} (+mailto:${email})`

interface Aircraft {
  hex?: string
  flight?: string
  r?: string
  alt_baro?: number | string
  lat?: number
  lastPosition?: unknown
}

interface Recorded {
  name: string
  path: string
  status: number
  fetchedAt: string
  aircraft: number | null
}

const recorded: Recorded[] = []
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function get(name: string, path: string): Promise<{ ac?: Aircraft[] } | null> {
  if (recorded.length >= MAX_REQUESTS) throw new Error('istek sınırı aşıldı')
  if (recorded.length > 0) await sleep(SPACING_MS)
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'user-agent': userAgent, accept: 'application/json', 'accept-encoding': 'gzip' },
    signal: AbortSignal.timeout(20_000),
  })
  const text = await response.text()
  const entry: Recorded = {
    name,
    path,
    status: response.status,
    fetchedAt: new Date().toISOString(),
    aircraft: null,
  }
  recorded.push(entry)
  console.log(`${response.status} ${path} (${text.length} bayt)`)
  if (response.status !== 200) {
    writeFileSync(join(outDir, `${name}.error.txt`), text.slice(0, 2000))
    // 429/420 (kısıtlama), 401/403 (politika) ya da başka bir hata: sonraki isteklere geçilmez.
    throw new Error(`HTTP ${response.status}: kayıt durduruldu`)
  }
  const body = JSON.parse(text) as { ac?: Aircraft[] }
  entry.aircraft = body.ac?.length ?? 0
  writeFileSync(join(outDir, `${name}.json`), `${JSON.stringify(body, null, 2)}\n`)
  return body
}

mkdirSync(outDir, { recursive: true })
try {
  const point = await get('point-ltfm-40nm', `/v2/point/${LTFM.lat}/${LTFM.lon}/40`)
  const ac = point?.ac ?? []
  if (ac.length > 0) {
    // Farklı durumları yakalamak için örnekler: yerde, havada, konumu bayat (lastPosition).
    const ground = ac.find((a) => a.alt_baro === 'ground')
    const airborne = ac.filter((a) => typeof a.alt_baro === 'number' && a.lat !== undefined)
    const stale = ac.find((a) => a.lastPosition !== undefined)
    const hexes = [ground, stale, ...airborne.slice(0, 3)]
      .filter((a): a is Aircraft => a !== undefined && typeof a.hex === 'string')
      .map((a) => a.hex as string)
    if (hexes.length > 0) await get('hex-mixed', `/v2/hex/${[...new Set(hexes)].join(',')}`)
    const withCallsign = airborne.find((a) => a.flight?.trim())
    if (withCallsign?.flight) {
      await get('callsign', `/v2/callsign/${withCallsign.flight.trim()}`)
    }
    const withReg = airborne.find((a) => a.r && /^[A-Za-z0-9-]+$/.test(a.r))
    if (withReg?.r) await get('reg', `/v2/reg/${withReg.r}`)
  }
} finally {
  writeFileSync(
    join(outDir, 'index.json'),
    `${JSON.stringify({ source: BASE, license: 'ODbL-1.0', requests: recorded }, null, 2)}\n`,
  )
  console.log(`${recorded.length} istek; çıktı: tools/fixtures/adsblol/`)
}
