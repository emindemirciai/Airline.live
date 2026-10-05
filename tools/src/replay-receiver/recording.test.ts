import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseLiveResponse } from '@havayolu/providers'
import { afterAll, describe, expect, it } from 'vitest'
import { cruiseScenario } from '../scenarios'
import {
  loadRecording,
  parseRecording,
  recordingPlayer,
  RecordingFormatError,
  type RecordedFrame,
  type Recording,
} from './recording'

const T0 = Date.UTC(2026, 8, 28, 9, 0, 0)
const adsbLolFixture = fileURLToPath(
  new URL('../../fixtures/adsblol/point-ltfm-40nm.json', import.meta.url),
)

const frame = (now: number, marker: string, extra: Record<string, unknown> = {}) => ({
  now,
  messages: 1,
  aircraft: [{ hex: marker, lat: 41, lon: 29, seen_pos: 0.4, seen: 0.1, dbFlags: 0, ...extra }],
})

const tempDir = mkdtempSync(join(tmpdir(), 'hy-recording-'))
afterAll(() => rmSync(tempDir, { recursive: true, force: true }))

describe('parseRecording: biçimler', () => {
  it('{ frames }, kare dizisi ve tek kare kabul edilir; kareler zamana göre sıralanır', () => {
    const frames = [frame(1002, 'b'), frame(1001, 'a')]
    const expected = [frame(1001, 'a'), frame(1002, 'b')]
    expect(parseRecording(JSON.stringify({ frames })).frames).toEqual(expected)
    expect(parseRecording(JSON.stringify(frames)).frames).toEqual(expected)
    expect(parseRecording(JSON.stringify(frame(1001, 'a'))).frames).toEqual([frame(1001, 'a')])
  })

  it('JSON Lines: satır başına bir kare, boş satırlar atlanır', () => {
    const text = `${JSON.stringify(frame(1001, 'a'))}\r\n\n${JSON.stringify(frame(1002, 'b'))}\n`
    expect(parseRecording(text).frames.map((f) => f.aircraft[0]!.hex)).toEqual(['a', 'b'])
  })

  it('adsb.lol v2 yanıtı: now ms → saniye, ac → aircraft, eksik dbFlags 0 olur', () => {
    const recording = loadRecording(adsbLolFixture)
    expect(recording.frames).toHaveLength(1)
    const [only] = recording.frames
    expect(only!.now).toBeLessThan(1e11)
    expect(only!.aircraft).toHaveLength(18)
    for (const a of only!.aircraft) expect(typeof a.dbFlags).toBe('number')
    // Bayrağı olan kayıt (LADD) korunur.
    expect(only!.aircraft.some((a) => a.dbFlags === 8)).toBe(true)
  })

  it('çok kareli adsb.lol JSON Lines (pnpm record): ms → sn, eksik dbFlags 0, döngü', () => {
    const offsets = [0, 10_000, 19_091]
    const text = offsets
      .map((dt, i) =>
        JSON.stringify({
          ac: [
            { hex: `4b000${i}`, lat: 41, lon: 29, seen_pos: 0.5 },
            { hex: 'abc123', lat: 41.1, lon: 29.1, dbFlags: 8 },
          ],
          msg: 'No error',
          now: T0 + dt,
          total: 2,
          ctime: T0 + dt,
          ptime: 3,
        }),
      )
      .join('\n')
    const recording = parseRecording(`${text}\n`)
    expect(recording.frames.map((f) => f.now)).toEqual(offsets.map((dt) => (T0 + dt) / 1000))
    for (const f of recording.frames) {
      expect(f.aircraft[0]!.dbFlags).toBe(0)
      expect(f.aircraft[1]!.dbFlags).toBe(8)
    }
    const player = recordingPlayer(recording, T0)
    // Adımlar 10.000 ve 9.091 ms; medyan (sıralı dizinin ortası) 10.000 → son ofset + 10.000.
    expect(player.durationMs).toBe(19_091 + 10_000)
    const hexAt = (t: number) => player.frameAt(t).aircraft[0]!.hex
    expect(hexAt(T0)).toBe('4b0000')
    expect(hexAt(T0 + 10_000)).toBe('4b0001')
    expect(hexAt(T0 + 19_091)).toBe('4b0002')
    expect(hexAt(T0 + 29_091)).toBe('4b0000')
  })

  it('readsb karesinde eksik dbFlags eklenmez (yerel alıcıda bilinmiyor demektir)', () => {
    const text = JSON.stringify({ now: 1001, aircraft: [{ hex: 'abc123', lat: 41, lon: 29 }] })
    expect(parseRecording(text).frames[0]!.aircraft[0]).not.toHaveProperty('dbFlags')
  })

  it('bozuk kayıtlar anlaşılır hatayla reddedilir', () => {
    const bad = (text: string) => () => parseRecording(text)
    expect(bad('')).toThrow(RecordingFormatError)
    expect(bad('[]')).toThrow(/kare yok/)
    expect(bad('{"frames": []}')).toThrow(/kare yok/)
    expect(bad('{"now": 1}\nnot json')).toThrow(/2\. satır/)
    expect(bad('{"aircraft": []}')).toThrow(/now/)
    expect(bad('{"now": -5, "aircraft": []}')).toThrow(/now/)
    expect(bad('{"now": 1001}')).toThrow(/aircraft/)
    expect(bad('{"now": 1001, "aircraft": [{"lat": 1}]}')).toThrow(/1\. uçak: hex/)
    expect(bad('[1]')).toThrow(/nesne değil/)
  })

  it('loadRecording hatada dosya yolunu söyler', () => {
    const path = join(tempDir, 'bozuk.json')
    writeFileSync(path, '{"now": "x", "aircraft": []}')
    expect(() => loadRecording(path)).toThrow(`${path}: 1. kare: now`)
    expect(() => loadRecording(join(tempDir, 'yok.json'))).toThrow(/ENOENT/)
  })
})

describe('recordingPlayer', () => {
  const recording: Recording = {
    frames: [frame(1000, 'a'), frame(1001, 'b'), frame(1002, 'c'), frame(1004, 'd')],
  }
  const hexAt = (player: ReturnType<typeof recordingPlayer>, t: number) =>
    player.frameAt(t).aircraft[0]!.hex

  it('döngü süresi son kare + medyan aralık; kareler kendi zaman diliminde sunulur', () => {
    const player = recordingPlayer(recording, T0)
    expect(player.durationMs).toBe(4000 + 1000)
    expect(hexAt(player, T0)).toBe('a')
    expect(hexAt(player, T0 + 999)).toBe('a')
    expect(hexAt(player, T0 + 1000)).toBe('b')
    expect(hexAt(player, T0 + 2500)).toBe('c')
    expect(hexAt(player, T0 + 3999)).toBe('c')
    expect(hexAt(player, T0 + 4000)).toBe('d')
    expect(hexAt(player, T0 + 5000)).toBe('a')
    expect(hexAt(player, T0 + 6000)).toBe('b')
    // Başlangıçtan önceki an da döngüye düşer.
    expect(hexAt(player, T0 - 1)).toBe('d')
  })

  it('now sunulduğu an; seen_pos ve seen kare diliminde geçen süre kadar artar', () => {
    const player = recordingPlayer(recording, T0)
    const served = player.frameAt(T0 + 1300)
    expect(served.now).toBe((T0 + 1300) / 1000)
    expect(served.messages).toBe(1)
    expect(served.aircraft[0]).toMatchObject({ hex: 'b', seen_pos: 0.7, seen: 0.4 })
    // Dilimin başında kare olduğu gibi döner.
    expect(player.frameAt(T0 + 1000).aircraft[0]).toEqual(recording.frames[1]!.aircraft[0])
  })

  it('aynı kare tekrar okunduğunda örnek zamanı değişmez (aynı konum yeni örnek sayılmaz)', () => {
    const player = recordingPlayer(recording, T0)
    const sampleTimes = [T0 + 1000, T0 + 1400, T0 + 1999].map((t) => {
      const parsed = parseLiveResponse(player.frameAt(t), 'localReceiver', { receivedAt: t })
      return parsed.aircraft[0]!.sampleTime
    })
    expect(new Set(sampleTimes).size).toBe(1)
    expect(sampleTimes[0]).toBe(T0 + 1000 - 400)
  })

  it('iki farklı zamanlı kare döngüye yeter; sırasız kareler sıralanır', () => {
    const unsorted = recordingPlayer({ frames: [frame(1001, 'b'), frame(1000, 'a')] }, T0)
    expect(unsorted.durationMs).toBe(2000)
    expect(hexAt(unsorted, T0)).toBe('a')
    expect(hexAt(unsorted, T0 + 1000)).toBe('b')
    expect(hexAt(unsorted, T0 + 2000)).toBe('a')
  })

  it('tek kare döngüye alınmaz: yaşı alıcının açılışından beri geçen süre kadar artar', () => {
    const single = recordingPlayer({ frames: [frame(1000, 'a')] }, T0)
    expect(single.durationMs).toBeNull()
    expect(single.frameAt(T0).aircraft[0]).toEqual(frame(1000, 'a').aircraft[0])
    const later = single.frameAt(T0 + 12_345)
    expect(later.now).toBe((T0 + 12_345) / 1000)
    expect(later.aircraft[0]).toMatchObject({ hex: 'a', seen_pos: 12.745, seen: 12.445 })
    // Açılıştan önceki an yaşı eksiltmez.
    expect(single.frameAt(T0 - 5_000).aircraft[0]).toMatchObject({ seen_pos: 0.4, seen: 0.1 })
    // Hepsi aynı anda olan kareler de tek kare sayılır; sonuncusu sunulur.
    const sameTime = recordingPlayer({ frames: [frame(1000, 'a'), frame(1000, 'b')] }, T0)
    expect(sameTime.durationMs).toBeNull()
    expect(sameTime.frameAt(T0 + 90_000).aircraft[0]).toMatchObject({ hex: 'b', seen_pos: 90.4 })
  })

  it('tek kare: her okumada aynı örnek, 60 sn içinde bayatlar (donmuş alıcı gibi)', () => {
    const single = recordingPlayer({ frames: [frame(1000, 'a')] }, T0)
    const parse = (t: number) =>
      parseLiveResponse(JSON.parse(JSON.stringify(single.frameAt(t))), 'localReceiver', {
        receivedAt: t,
      })
    const sampleTimes = [0, 1_000, 2_000, 30_000, 59_000].map(
      (dt) => parse(T0 + dt).aircraft[0]!.sampleTime,
    )
    expect(new Set(sampleTimes).size).toBe(1)
    expect(sampleTimes[0]).toBe(T0 - 400)
    const stale = parse(T0 + 60_000)
    expect(stale.aircraft).toEqual([])
    expect(stale.rejected).toEqual([{ hex: 'a', reason: 'stale' }])
  })

  it('yaş alanı olmayan uçağa yaş seen olarak eklenir; diğer alanlar korunur', () => {
    const noSeen: RecordedFrame = {
      now: 1000,
      aircraft: [
        { hex: 'x', lat: 1, lon: 2 },
        { hex: 'y', lat: 1, lon: 2, seen: 1 },
        { hex: 'z', lat: 1, lon: 2, seen_pos: 'bozuk' },
      ],
    }
    const player = recordingPlayer({ frames: [noSeen] }, T0)
    expect(JSON.parse(JSON.stringify(player.frameAt(T0).aircraft))).toEqual(noSeen.aircraft)
    expect(JSON.parse(JSON.stringify(player.frameAt(T0 + 500).aircraft))).toEqual([
      { hex: 'x', lat: 1, lon: 2, seen: 0.5 },
      { hex: 'y', lat: 1, lon: 2, seen: 1.5 },
      { hex: 'z', lat: 1, lon: 2, seen_pos: 'bozuk', seen: 0.5 },
    ])
    // Döngülü kayıtta da yaşsız uçak kendi diliminde yeni örnek üretmez.
    const looped = recordingPlayer({ frames: [noSeen, { ...noSeen, now: 1002 }] }, T0)
    const sampleTimes = [T0, T0 + 900, T0 + 1_999].map(
      (t) =>
        parseLiveResponse(looped.frameAt(t), 'localReceiver', { receivedAt: t }).aircraft[0]!
          .sampleTime,
    )
    expect(sampleTimes).toEqual([T0, T0, T0])
  })

  it('boş kayıt reddedilir', () => {
    expect(() => recordingPlayer({ frames: [] }, T0)).toThrow(RecordingFormatError)
  })

  it('senaryo kareleri de kayıt olarak oynatılabilir', () => {
    const scenario = cruiseScenario({ count: 2 })
    const frames = [0, 1000, 2000].map((dt) => scenario.frameAt(T0 + dt))
    const player = recordingPlayer({ frames }, T0 + 60_000)
    expect(player.frameAt(T0 + 61_000).aircraft).toEqual(frames[1]!.aircraft)
  })

  it('gerçek adsb.lol kaydı (tek kare) sıfır retle geçer, tekrar okununca yeni örnek üretmez', () => {
    const player = recordingPlayer(loadRecording(adsbLolFixture), T0)
    expect(player.durationMs).toBeNull()
    const parse = (t: number) =>
      parseLiveResponse(JSON.parse(JSON.stringify(player.frameAt(t))), 'localReceiver', {
        receivedAt: t,
      })
    const sampleTimes = (t: number) =>
      Object.fromEntries(parse(t).aircraft.map((a) => [a.hex, a.sampleTime]))
    const first = parse(T0)
    expect(first.rejected).toEqual([])
    expect(first.aircraft).toHaveLength(18)
    expect(first.aircraft.every((a) => a.dbFlags !== null)).toBe(true)
    // En yaşlı konum (4bd183, seen_pos 35,3 sn) 24,6 sn'ye kadar taze kalır.
    for (const t of [T0 + 700, T0 + 1_700, T0 + 20_000]) {
      expect(parse(t).rejected).toEqual([])
      expect(sampleTimes(t)).toEqual(sampleTimes(T0))
    }
    expect(parse(T0 + 30_000).rejected).toEqual([{ hex: '4bd183', reason: 'stale' }])
    // 60 sn sonra bütün uçaklar bayat: donmuş kayıt haritada sonsuza dek durmaz.
    const frozen = parse(T0 + 60_001)
    expect(frozen.aircraft).toEqual([])
    expect(frozen.rejected).toHaveLength(18)
  })
})
