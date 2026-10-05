import { isAbsolute, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { PRIMARY_EXTRA_RADIUS_NM } from '@havayolu/geo/coverage'

/** `pnpm record` ve `pnpm smoke:live` argümanları (replay alıcısının argüman kalıbı). */

export class LiveArgsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LiveArgsError'
  }
}

/** `--minutes` ve `--radius` sınırları (record.ts bunu yeniden dışa aktarır). */
export const RECORD_LIMITS = {
  minMinutes: 1,
  maxMinutes: 60,
  minRadiusNm: 1,
  maxRadiusNm: 60,
} as const
/** Varsayılan süre 30 dk; yarıçap birincil istasyonun 40 NM'lik çemberi. */
export const RECORD_DEFAULTS = { minutes: 30, radiusNm: PRIMARY_EXTRA_RADIUS_NM } as const

export type RecordArgs =
  | { kind: 'help' }
  | {
      kind: 'run'
      /** Büyük harfli 4 harfli ICAO. */
      station: string
      minutes: number
      radiusNm: number
      /** `--out`'un mutlak yolu (INIT_CWD'ye göre çözülmüş); yoksa null. */
      out: string | null
      fixture: boolean
      confirm: boolean
    }

export type SmokeArgs = { kind: 'help' } | { kind: 'run'; confirm: boolean }

export const RECORD_USAGE = [
  'Kullanım: pnpm record --station <ICAO> [--minutes <1-60>] [--radius <1-60>]',
  '                      [--out <dosya.jsonl> | --fixture] [--confirm]',
  "  --station <ICAO>     kaydedilecek istasyon (ör. LTFM); merkez OurAirports fixture'ındaki ARP",
  '  --minutes <1-60>     süre, dakika (varsayılan 30)',
  '  --radius <1-60>      nokta sorgusunun yarıçapı, deniz mili (varsayılan 40)',
  '  --out <dosya.jsonl>  çıktı dosyası (varsayılan tools/recordings/tmp/<ICAO>-<UTC>.jsonl);',
  '                       repo içinde yalnızca tools/recordings/tmp/ altı ya da repo dışı bir yol',
  "  --fixture            commit'lenecek kayıt: tools/fixtures/replay/, gizlilik süzgeciyle",
  '                       (--out ile birlikte kullanılamaz)',
  '  --confirm            canlı adsb.lol isteklerini başlatır; yoksa yalnızca plan yazılır',
  '  -h, --help           bu yardım',
  'Canlı istek atar (CLAUDE.md DUR-SOR 6): yalnızca kullanıcı kendi terminalinde çalıştırır.',
  'Kayıt pnpm dev:replay --recording <dosya> ile oynar.',
  'Çıkış: 0 tamam · 1 kare yok · 2 ret ya da ön koşul eksik · 3 adsb.lol 401/403 ·',
  '       4 bekçi ihlali, beklenmeyen yanıt, dosya hatası ya da iç hata · 130 Ctrl+C',
].join('\n')

export const SMOKE_USAGE = [
  'Kullanım: pnpm smoke:live [--confirm]',
  "  --confirm   gerçek ingest'i 5 dk canlı adsb.lol'e karşı çalıştırır; yoksa yalnızca plan yazılır",
  '  -h, --help  bu yardım',
  'Yerel altyapı gerekir (pnpm dev:infra): app_smoke_live veritabanı yeniden kurulur, redis-live 7',
  'temizlenir. Ölçütler: Türkiye bbox’ında ≥ 50 uçak, LTFM veri yaşı p95 ≤ 20 sn, provider_health.',
  'Canlı istek atar (CLAUDE.md DUR-SOR 6): yalnızca kullanıcı kendi terminalinde çalıştırır.',
  'Çıkış: 0 GEÇTİ · 1 KALDI · 2 ret ya da ön koşul eksik · 3 adsb.lol 401/403 ·',
  '       4 bekçi ihlali ya da iç hata · 130 Ctrl+C',
].join('\n')

/** `pnpm <script> -- --x` biçiminde gelen ayraç atlanır. */
function stripSeparator(argv: readonly string[]): string[] {
  return argv[0] === '--' ? argv.slice(1) : [...argv]
}

/** node:util parseArgs hatasını (bilinmeyen bayrak, konumsal argüman) LiveArgsError'a çevirir. */
function strict<T>(parse: () => T): T {
  try {
    return parse()
  } catch (error) {
    throw new LiveArgsError(
      `geçersiz argüman: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function boundedInteger(
  value: string | undefined,
  flag: string,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined) return fallback
  if (!/^\d{1,3}$/.test(value.trim()))
    throw new LiveArgsError(`${flag} ${min}–${max} arası tam sayı olmalı`)
  const parsed = Number(value.trim())
  if (parsed < min || parsed > max)
    throw new LiveArgsError(`${flag} ${min}–${max} arası tam sayı olmalı`)
  return parsed
}

/**
 * `--out`'un göreli yolu pnpm'in çağrıldığı dizine (INIT_CWD) göre çözülür: `pnpm record` kökte
 * çalışsa da kullanıcının yazdığı yol geçerli kalır.
 */
export function parseRecordArgs(
  argv: readonly string[],
  baseDir: string = process.env.INIT_CWD ?? process.cwd(),
): RecordArgs {
  const { values } = strict(() =>
    parseArgs({
      args: stripSeparator(argv),
      options: {
        station: { type: 'string' },
        minutes: { type: 'string' },
        radius: { type: 'string' },
        out: { type: 'string' },
        fixture: { type: 'boolean' },
        confirm: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
      allowPositionals: false,
    }),
  )
  if (values.help) return { kind: 'help' }
  const station = values.station?.trim().toUpperCase() ?? ''
  if (!station) throw new LiveArgsError('--station zorunlu (ör. --station LTFM)')
  if (!/^[A-Z]{4}$/.test(station)) {
    throw new LiveArgsError('--station 4 harfli bir ICAO kodu olmalı (ör. LTFM)')
  }
  const minutes = boundedInteger(
    values.minutes,
    '--minutes',
    RECORD_LIMITS.minMinutes,
    RECORD_LIMITS.maxMinutes,
    RECORD_DEFAULTS.minutes,
  )
  const radiusNm = boundedInteger(
    values.radius,
    '--radius',
    RECORD_LIMITS.minRadiusNm,
    RECORD_LIMITS.maxRadiusNm,
    RECORD_DEFAULTS.radiusNm,
  )
  const fixture = values.fixture === true
  let out: string | null = null
  if (values.out !== undefined) {
    if (fixture) throw new LiveArgsError('--out ve --fixture birlikte kullanılamaz')
    const raw = values.out.trim()
    if (!raw) throw new LiveArgsError('--out bir dosya yolu ister')
    if (!raw.toLowerCase().endsWith('.jsonl')) throw new LiveArgsError('--out .jsonl ile bitmeli')
    out = resolve(baseDir, raw)
  }
  return { kind: 'run', station, minutes, radiusNm, out, fixture, confirm: values.confirm === true }
}

export function parseSmokeArgs(argv: readonly string[]): SmokeArgs {
  const { values } = strict(() =>
    parseArgs({
      args: stripSeparator(argv),
      options: {
        confirm: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
      allowPositionals: false,
    }),
  )
  if (values.help) return { kind: 'help' }
  return { kind: 'run', confirm: values.confirm === true }
}

/**
 * `child`, `parent`'ın kendisi ya da altında mı? Windows'ta büyük/küçük harf duyarsız karşılaştırır
 * (`--out` ile tools/fixtures altına yazma reddi).
 */
export function isPathInside(
  child: string,
  parent: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const fold = (p: string) => (platform === 'win32' ? resolve(p).toLowerCase() : resolve(p))
  const rel = relative(fold(parent), fold(child))
  if (rel === '') return true
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) && !/^[a-zA-Z]:/.test(rel)
}
