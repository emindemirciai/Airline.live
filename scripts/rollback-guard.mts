// Geri alma kapısı (D-115). rollback.yml bu betiği imaj etiketleri taşınmadan önce çalıştırır.
// v0.28.0'dan (M7d.1) eski imajlar yalnız-havayolu süzgecini, worker'daki engel listesini ve canlı
// katman anahtarını (`live_layer_state`) tanımaz: `CONTACT_EMAIL` girildiyse bütün uçakları yayınlar
// ve panelde kapatılmış katmanı sessizce açar; geri alma doğrulaması yine yeşil biter.
// İş Dokploy'daki env'i göremez. Bu yüzden eşiğin altındaki, sürümü okunamayan ya da süzgeç
// dosyaları olmayan bir hedef yalnız `allow_pre_live_gate` girdisiyle kabul edilir. Girdi,
// `CONTACT_EMAIL`'in Dokploy'da boşaltılıp yeniden deploy edildiğinin (ya da canlı uçakların hiç
// açılmadığının) beyanıdır (DEPLOY_DOKPLOY §12, RUNBOOK).
// Çıkış: 0 = hedef kabul edildi; 1 = reddedildi.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** Yalnız-havayolu süzgecini ve canlı katman anahtarını taşıyan ilk sürüm (M7d.1, D-115). */
export const LIVE_GATE_MIN_VERSION = '0.28.0'

/**
 * Süzgeci ve anahtarı taşıyan dosyalar. Sürüm numarası yayın sırasında kayarsa (ör. başka bir
 * kilometre taşı 0.28.0'ı alırsa) eşiği geçen ama süzgeci olmayan bir hedefi bunlar yakalar.
 */
export const LIVE_GATE_FILES = [
  'packages/providers/src/live-scope.ts',
  'packages/db/src/live-layer.ts',
] as const

export interface RollbackTarget {
  /** Hedef commit'teki kök package.json sürümü; okunamadıysa null. */
  version: string | null
  /** `LIVE_GATE_FILES`'tan hedef commit'te bulunmayanlar. */
  missingFiles: readonly string[]
}

export interface RollbackDecision {
  ok: boolean
  /** GitHub Actions açıklama düzeyi. */
  level: 'notice' | 'warning' | 'error'
  message: string
}

/** Yalnız `X.Y.Z` biçimi kabul edilir; ön sürüm ya da başka metin okunamaz sayılır. */
export function parseVersion(value: string): readonly [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** a < b → negatif, eşit → 0, a > b → pozitif. */
export function compareVersions(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  for (let i = 0; i < 3; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

const HOW_TO =
  `Önce Dokploy Environment'ta CONTACT_EMAIL'i boşalt ve yeniden deploy et (eski worker veri çekmez), ` +
  `sonra işi allow_pre_live_gate=true ile yeniden çalıştır (DEPLOY_DOKPLOY §12).`

/** Hedefin süzgeç eşiğini geçip geçmediğine ve girdiye göre kararı verir (saf). */
export function decideRollback(
  target: RollbackTarget,
  allowPreLiveGate: boolean,
  floor: string = LIVE_GATE_MIN_VERSION,
): RollbackDecision {
  const minimum = parseVersion(floor)
  if (!minimum) throw new Error(`geçersiz eşik sürümü: ${floor}`)
  const parsed = target.version === null ? null : parseVersion(target.version)
  const problems: string[] = []
  if (parsed === null) {
    problems.push(
      target.version === null
        ? 'hedefin package.json sürümü okunamadı'
        : `hedefin sürümü okunamadı (${target.version})`,
    )
  } else if (compareVersions(parsed, minimum) < 0) {
    problems.push(`hedef v${target.version}, v${floor}'dan eski`)
  }
  if (target.missingFiles.length > 0) {
    problems.push(`hedefte süzgeç dosyaları yok (${target.missingFiles.join(', ')})`)
  }
  if (problems.length === 0) {
    return {
      ok: true,
      level: 'notice',
      message: `Hedef v${target.version}: yalnız-havayolu süzgeci ve canlı katman anahtarı var (D-115).`,
    }
  }
  const reason = problems.join('; ')
  if (allowPreLiveGate) {
    return {
      ok: true,
      level: 'warning',
      message:
        `${reason}. allow_pre_live_gate=true ile kabul edildi: bu imajlar bütün uçakları yayınlar ve ` +
        `canlı katman anahtarını tanımaz; CONTACT_EMAIL boş kalmalı (D-115).`,
    }
  }
  return {
    ok: false,
    level: 'error',
    message:
      `${reason}. Bu imajlar yalnız-havayolu süzgecini ve canlı katman anahtarını tanımaz; ` +
      `CONTACT_EMAIL girildiyse bütün uçakları yayınlar (D-115). ${HOW_TO}`,
  }
}

/** Yalnız tam olarak "true" izin verir; başka her değer (boş, "1", "yes") kapalı sayılır. */
export function parseAllow(value: string | undefined): boolean {
  return value?.trim() === 'true'
}

/** Hedef commit'in sürümünü ve süzgeç dosyalarını yerel git deposundan okur (ağ yok). */
export function readRollbackTarget(sha: string, cwd: string = process.cwd()): RollbackTarget {
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  let version: string | null = null
  try {
    const parsed = JSON.parse(git(['show', `${sha}:package.json`])) as { version?: unknown }
    version = typeof parsed.version === 'string' ? parsed.version : null
  } catch {
    version = null
  }
  const missingFiles = LIVE_GATE_FILES.filter((path) => {
    try {
      git(['cat-file', '-e', `${sha}:${path}`])
      return false
    } catch {
      return true
    }
  })
  return { version, missingFiles }
}

function main(): number {
  const sha = process.env.TARGET_SHA?.trim() ?? ''
  if (!/^[0-9a-f]{7,40}$/.test(sha)) {
    console.log("::error::TARGET_SHA 7-40 karakterlik bir commit SHA'sı olmalı")
    return 1
  }
  const decision = decideRollback(
    readRollbackTarget(sha),
    parseAllow(process.env.ALLOW_PRE_LIVE_GATE),
  )
  console.log(`::${decision.level}::${decision.message}`)
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary) appendFileSync(summary, `### Geri alma kapısı (D-115)\n\n${decision.message}\n`)
  return decision.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main()
}
