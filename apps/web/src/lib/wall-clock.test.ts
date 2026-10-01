import { describe, expect, it } from 'vitest'
import { DEVICE_CLOCK_MAX_LEAD_MS, deviceClockPlausible, WallClock } from './wall-clock'

const SERVER = Date.parse('2026-01-15T09:00:00Z')
const HOUR = 3_600_000

describe('WallClock', () => {
  it('sunucu çapasından sonra Date.now farkıyla ilerler; cihaz saati yanlış olsa da doğru', () => {
    // Cihaz saati 3 saat ileri.
    const deviceStart = SERVER + 3 * HOUR
    const clock = new WallClock(SERVER, deviceStart)
    expect(clock.now(deviceStart)).toBe(SERVER)
    expect(clock.now(deviceStart + 90_000)).toBe(SERVER + 90_000)
  })

  it('cihaz 2 saat uyuyup uyanınca saat 2 saat ilerlemiş olur (performance.now durur, Date.now durmaz)', () => {
    const clock = new WallClock(SERVER, SERVER)
    // Uyku: Date.now 2 saat ilerledi.
    expect(clock.now(SERVER + 2 * HOUR)).toBe(SERVER + 2 * HOUR)
  })

  it('daha eski sunucu zamanı (önbellekten gelen generatedAt) saati geri götürmez; daha yenisi ileri alır', () => {
    const clock = new WallClock(SERVER, SERVER)
    clock.observe(SERVER - 60_000, SERVER + 10_000)
    expect(clock.now(SERVER + 10_000)).toBe(SERVER + 10_000)
    clock.observe(SERVER + 5 * 60_000, SERVER + 10_000)
    expect(clock.now(SERVER + 10_000)).toBe(SERVER + 5 * 60_000)
  })

  it('cihaz saati geri alınırsa saat geri gitmez; çapa yoksa Date.now', () => {
    const clock = new WallClock(SERVER, SERVER)
    expect(clock.now(SERVER - HOUR)).toBe(SERVER)
    expect(new WallClock().now(1234)).toBe(1234)
    const late = new WallClock()
    late.observe(SERVER, SERVER + 3 * HOUR)
    expect(late.now(SERVER + 3 * HOUR + 1_000)).toBe(SERVER + 1_000)
  })
})

describe('WallClock.preferDevice (harita penceresi)', () => {
  const MINUTE = 60_000
  /** Gerçek saat: yanıtın alındığı an. */
  const TRUE = SERVER

  it('cihaz saati doğru: cihaz saati kullanılır', () => {
    const clock = WallClock.preferDevice()
    // Taze yanıt: 300 ms önce üretildi, cihaz saati doğru.
    clock.observe(TRUE - 300, TRUE)
    expect(clock.now(TRUE)).toBe(TRUE)
    expect(clock.now(TRUE + 5_000)).toBe(TRUE + 5_000)
  })

  it('önbellekten gelen 2 dakikalık yanıt saati geride bırakmaz (sunucu kipi 2 dk geride kalır)', () => {
    const cached = TRUE - 2 * MINUTE
    const clock = WallClock.preferDevice()
    clock.observe(cached, TRUE)
    expect(clock.now(TRUE + 1_000)).toBe(TRUE + 1_000)
    // Sunucu kipindeki saat aynı yanıtla 2 dakika geride kalır (havalimanı sayfası çizim anına bağlıdır).
    const serverOnly = new WallClock()
    serverOnly.observe(cached, TRUE)
    expect(serverOnly.now(TRUE + 1_000)).toBe(cached + 1_000)
  })

  it('cihaz saati sunucu zamanının gerisinde: sunucu saati kullanılır', () => {
    // Cihaz 5 dakika geride; yanıt 30 sn önce üretildi, cihazın saatinden 4,5 dk ileride.
    const device = TRUE - 5 * MINUTE
    const clock = WallClock.preferDevice()
    clock.observe(TRUE - 30_000, device)
    expect(clock.now(device)).toBe(TRUE - 30_000)
    expect(clock.now(device + 10_000)).toBe(TRUE - 20_000)
  })

  it('cihaz saati çok ileride (> 10 dk): sunucu saati kullanılır', () => {
    const device = TRUE + 3 * HOUR
    const clock = WallClock.preferDevice()
    clock.observe(TRUE - MINUTE, device)
    expect(clock.now(device + 30_000)).toBe(TRUE - 30_000)
    // Sınır: en çok 10 dakika ileri cihaz saati akla yatkındır.
    expect(deviceClockPlausible(TRUE + DEVICE_CLOCK_MAX_LEAD_MS, TRUE)).toBe(true)
    expect(deviceClockPlausible(TRUE + DEVICE_CLOCK_MAX_LEAD_MS + 1, TRUE)).toBe(false)
    expect(deviceClockPlausible(TRUE - 1, TRUE)).toBe(false)
  })

  it('her yeni yanıtta yeniden karar verilir; eski yanıt alt sınırı geri götürmez', () => {
    // Cihaz 1 dakika geride: önbellekten gelen 2 dk'lık yanıtla akla yatkın görünür.
    const device = (t: number) => t - MINUTE
    const clock = WallClock.preferDevice()
    clock.observe(TRUE - 2 * MINUTE, device(TRUE))
    expect(clock.now(device(TRUE))).toBe(device(TRUE))
    // Taze yanıt cihazın geride olduğunu gösterir: sunucu saatine geçilir.
    const later = TRUE + 5 * MINUTE
    clock.observe(later - 500, device(later))
    expect(clock.now(device(later) + 1_000)).toBe(later + 500)
    // Arkasından gelen eski (önbellekten) yanıt alt sınırı geri götürmez.
    clock.observe(later - 3 * MINUTE, device(later) + 2_000)
    expect(clock.now(device(later) + 2_000)).toBe(later + 1_500)
  })

  it('sekme görünür olunca (resync) yeniden çapalanır: geri alınan cihaz saati izlenir', () => {
    // Cihaz 2 dakika ileride (akla yatkın sınırda), yanıt taze.
    const clock = WallClock.preferDevice()
    clock.observe(TRUE - 2 * MINUTE, TRUE)
    // Cihaz saati 2 dakika geri alındı (ağ saatiyle düzeltildi): çapada bekler, geri gitmez.
    const corrected = TRUE + 10_000 - 2 * MINUTE
    expect(clock.now(corrected)).toBe(TRUE)
    // Görünür olunca karar yeniden verilir: cihaz saati alt sınırın gerisinde değil, kullanılır.
    clock.resync(corrected)
    expect(clock.now(corrected + 1_000)).toBe(corrected + 1_000)
  })

  it('yanıt gelmeden cihaz saati; sunucu kipinde resync etkisizdir', () => {
    expect(WallClock.preferDevice().now(1234)).toBe(1234)
    const serverOnly = new WallClock(SERVER, SERVER)
    serverOnly.resync(SERVER + HOUR)
    expect(serverOnly.now(SERVER + HOUR)).toBe(SERVER + HOUR)
    expect(serverOnly.now(SERVER + 1_000)).toBe(SERVER + 1_000)
  })
})
