import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseEnv } from 'node:util'

/**
 * Replay araçlarının ortam okuması. Öncelik worker'ın geliştirme yüklemesiyle aynıdır: süreç
 * ortamı > kökteki `.env` > `.env.example` (ilk tanımlı olan kazanır). `process.env` değiştirilmez;
 * `pnpm dev`'e giden ortam böylece `pnpm dev`'in kendi başına göreceğiyle aynı kalır.
 */

/** `pnpm-workspace.yaml`'ın bulunduğu repo kökü; bulunamazsa null. */
export function findWorkspaceRoot(startDir: string): string | null {
  let dir = startDir
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function devEnvValue(
  name: string,
  root: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (env[name] !== undefined) return env[name]
  if (root === null) return undefined
  for (const file of ['.env', '.env.example']) {
    const path = join(root, file)
    if (!existsSync(path)) continue
    const value = parseEnv(readFileSync(path, 'utf8'))[name]
    if (value !== undefined) return value
  }
  return undefined
}
