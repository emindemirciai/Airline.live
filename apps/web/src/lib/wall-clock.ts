/** Cihaz kipinde cihaz saatinin sunucu saatinden en çok bu kadar ileride olmasına izin verilir. */
export const DEVICE_CLOCK_MAX_LEAD_MS = 10 * 60_000

interface Anchor {
  /** Çapadaki saat (epoch ms). */
  server: number
  /** Çapanın alındığı cihaz anı (`Date.now()`). */
  local: number
}

/** Çapadan sonra geçen cihaz süresi eklenir; cihaz saati çapanın gerisine alınırsa çapada bekler. */
const advance = (anchor: Anchor, local: number): number =>
  anchor.server + Math.max(0, local - anchor.local)

/**
 * Cihaz saati sunucu saatine göre akla yatkın mı: gerçek saat sunucunun bildirdiği andan geride
 * olamaz (önbellekten gelen eski `generatedAt` yalnızca alt sınırdır), çok ilerisi de yanlış saattir.
 */
export function deviceClockPlausible(device: number, server: number): boolean {
  const lead = device - server
  return lead >= 0 && lead <= DEVICE_CLOCK_MAX_LEAD_MS
}

/**
 * Sunucu saatine bağlı duvar saati (hava durumu: yerel saat, gözlem yaşı, eskime sınıfı, TAF
 * süresi; D-075, D-078). Sunucu zamanlarıyla (`observedAt`, `validTo`, `generatedAt`) karşılaştırılan
 * "şimdi" buradan gelir. İki kip vardır:
 *
 * - **Sunucu kipi** (varsayılan; havalimanı sayfası): çapa sunucu saatidir (sayfanın çizim anı ya da
 *   yanıtın `generatedAt`'i); çapadan sonra geçen süre `Date.now()` farkıyla eklenir. Cihaz saati
 *   saatlerce yanlış olsa da fark doğrudur; cihaz uyusa da `Date.now()` ilerler (`performance.now()`
 *   uykuda durur, MDN), uyanınca saat doğrudur. Daha geç bir sunucu zamanı gelirse çapa ileri alınır
 *   (ör. önbellekten gelen eski `generatedAt` saati geri götürmez).
 * - **Cihaz kipi** (`WallClock.preferDevice()`; harita penceresi): yanıtın `generatedAt`'i önbellekten
 *   gelmiş olabilir (API 60 sn + tarayıcı `max-age=60`); ona bağlı saat 2 dakikaya kadar geride
 *   kalırdı. Cihaz saati, bilinen en geç sunucu zamanına göre akla yatkınsa (`deviceClockPlausible`:
 *   geride değil ve en çok 10 dakika ileride) kullanılır; değilse sunucu saati. Karar her yeni
 *   yanıtta (`observe`) ve sekme yeniden görünür olunca (`resync`, `useWallNow`) yeniden verilir.
 *
 * Her iki kipte de cihaz saati çapanın gerisine alınırsa saat çapada bekler, geri gitmez; çapa yoksa
 * (ilk yanıt gelene kadar) `Date.now()` kullanılır. Geri gitmeyen `monotonicNow` (lib/live/clock.ts)
 * yalnızca istemci içindeki aralıklar içindir.
 */
export class WallClock {
  private anchor: Anchor | null = null
  /** Cihaz kipinde: bilinen en geç sunucu zamanı (alt sınır) ve alındığı cihaz anı. */
  private latest: Anchor | null = null
  private deviceFirst = false

  constructor(server?: number, local: number = Date.now()) {
    if (server !== undefined) this.observe(server, local)
  }

  /** Cihaz kipindeki saat (harita penceresi): cihaz saati akla yatkınsa o kullanılır. */
  static preferDevice(): WallClock {
    const clock = new WallClock()
    clock.deviceFirst = true
    return clock
  }

  /** `local` (Date.now) anında sunucu saatinin en az `server` olduğu bilgisi. */
  observe(server: number, local: number = Date.now()): void {
    if (!Number.isFinite(server) || !Number.isFinite(local)) return
    if (!this.deviceFirst) {
      if (this.anchor === null || server > this.now(local)) this.anchor = { server, local }
      return
    }
    if (this.latest === null || server > advance(this.latest, local)) {
      this.latest = { server, local }
    }
    this.resync(local)
  }

  /**
   * Cihaz kipinde çapayı yeniden kurar (sekme yeniden görünür olunca; cihaz saati arada
   * düzeltilmiş olabilir): cihaz saati akla yatkınsa cihaz saati, değilse en geç sunucu zamanından
   * ilerleyen saat. Sunucu kipinde bir şey yapmaz (havalimanı sayfası).
   */
  resync(local: number = Date.now()): void {
    if (!this.deviceFirst || this.latest === null || !Number.isFinite(local)) return
    const server = advance(this.latest, local)
    // Alt sınır bu andan ilerler: cihaz saati geri alındıysa da durmaz.
    this.latest = { server, local }
    this.anchor = { server: deviceClockPlausible(local, server) ? local : server, local }
  }

  /** Tahmini gerçek saat (epoch ms). */
  now(local: number = Date.now()): number {
    return this.anchor === null ? local : advance(this.anchor, local)
  }
}
