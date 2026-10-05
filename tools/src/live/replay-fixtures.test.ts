import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sanitizeFrameForFixture } from './record'
import { FIXTURES_DIR } from './test/adsblol-stub'

/**
 * Commit'lenecek canlı kayıtlar (`tools/fixtures/replay/*.jsonl`, yalnızca `pnpm record --fixture`
 * ile ve kullanıcı onayıyla) genel API'nin göstereceğinden fazlasını taşıyamaz: her kaydın yanında
 * `sanitized: true` künyesi olmalı ve gizlilik süzgeci hiçbir karede bir şey değiştirmemelidir.
 * Klasör boşken (M7a) test bir şey bulmadan geçer.
 */

const REPLAY_DIR = join(FIXTURES_DIR, 'replay')
const recordings = existsSync(REPLAY_DIR)
  ? readdirSync(REPLAY_DIR)
      .filter((name) => name.endsWith('.jsonl'))
      .sort()
  : []

describe("tools/fixtures/replay: commit'li canlı kayıtlar", () => {
  it('her kaydın künyesi sanitized: true; süzgeç hiçbir kareyi değiştirmez', () => {
    for (const name of recordings) {
      const metaPath = join(REPLAY_DIR, name.replace(/\.jsonl$/, '.meta.json'))
      expect(existsSync(metaPath), `${name}: .meta.json yok`).toBe(true)
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { sanitized?: unknown }
      expect(meta.sanitized, `${name}: künyede sanitized true değil`).toBe(true)
      const lines = readFileSync(join(REPLAY_DIR, name), 'utf8')
        .split('\n')
        .filter((line) => line.trim())
      expect(lines.length, `${name}: kare yok`).toBeGreaterThan(0)
      for (const [index, line] of lines.entries()) {
        const frame = JSON.parse(line) as unknown
        expect(sanitizeFrameForFixture(frame), `${name}: ${index + 1}. satır süzülmemiş`).toEqual(
          frame,
        )
      }
    }
  })
})
