import type { IngestDeps } from '@havayolu/worker/ingest'
import { describe, expect, it } from 'vitest'
import { createRedactor } from './env'
import { createToolLogger, formatPinoLine } from './logger'

const T = Date.UTC(2026, 9, 4, 12, 31, 5, 250)

function capture(level = 'info') {
  const lines: string[] = []
  const log = createToolLogger({
    level,
    write: (line) => lines.push(line),
    redact: createRedactor(['ops@example.org']),
    now: () => T,
  })
  return { lines, log }
}

describe('createToolLogger', () => {
  it('kısa satır: saat, düzey, ileti ve alanlar', () => {
    const { lines, log } = capture()
    log.info({ provider: 'adsbLol', rps: 0.1, ok: true, note: 'iki sözcük' }, 'ingest started')
    log.warn('uyarı')
    expect(lines).toEqual([
      '12:31:05Z info ingest started provider=adsbLol rps=0.1 ok=true note="iki sözcük"',
      '12:31:05Z warn uyarı',
    ])
  })

  it('satırın tamamı maskelenir; hatada yalnızca ileti yazılır', () => {
    const { lines, log } = capture()
    log.error(
      { err: new Error('UA ops@example.org rejected'), ua: '(+mailto:ops@example.org)' },
      'x ops@example.org',
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toContain('ops@example.org')
    expect(lines[0]).toBe(
      '12:31:05Z error x <CONTACT_EMAIL> err="UA <CONTACT_EMAIL> rejected" ua=(+mailto:<CONTACT_EMAIL>)',
    )
    expect(lines[0]).not.toContain('stack')
  })

  it('düzey süzgeci', () => {
    const { lines, log } = capture('warn')
    log.info('görünmez')
    log.debug('görünmez')
    log.error('görünür')
    expect(lines).toEqual(['12:31:05Z error görünür'])
  })

  it("worker'ın ingest bağımlılığına verilebilir", () => {
    const { log } = capture()
    const deps: Pick<IngestDeps, 'log'> = { log }
    expect(typeof deps.log.child).toBe('function')
  })
})

describe('formatPinoLine', () => {
  it('JSON olmayan satır olduğu gibi; iç içe nesne JSON', () => {
    expect(formatPinoLine('düz metin\n')).toBe('düz metin')
    expect(formatPinoLine('[1,2]')).toBe('[1,2]')
    expect(
      formatPinoLine(JSON.stringify({ level: 'info', time: T, msg: 'm', a: { b: 1 }, n: null })),
    ).toBe('12:31:05Z info m a={"b":1} n=null')
  })
})
