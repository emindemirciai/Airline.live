/**
 * İstemci saatleri (D-075).
 *
 * - `monotonicNow`: sayfa açıkken geri gitmeyen, epoch ms biçiminde saat
 *   (`performance.timeOrigin + performance.now()`). Çizim döngüsü, seyreltmeler, "son görülme" ve
 *   alınma zamanları bununla ölçülür; sistem saati geri alınsa da (uykudan dönüşte saat eşitleme,
 *   elle değişiklik) döngü durmaz, süreler eksiye düşmez. Yalnızca istemci içindeki farklar için
 *   kullanılır; sunucu zamanıyla (`t`) doğrudan karşılaştırılmaz.
 * - `ServerClock`: sunucu saatinin istemci saatine göre tahmini. Örnek zamanı `t` sunucu saatiyle
 *   yazılır; iki saat arasındaki kayma bilinmediği için `t` hiçbir zaman `Date.now()` ile
 *   karşılaştırılmaz. Her WebSocket mesajı sunucu saatine bir alt sınır verir (mesajdaki en yeni
 *   örnek + `status.newestAgeS`); en sıkı alt sınır, alındığı andaki istemci saatiyle birlikte tutulur.
 *   Bir örneğin yaşı = tahmini sunucu saati − `t`; iki değer de sunucu saatindendir, kayma etkilemez.
 */

/** Geri gitmeyen saat, epoch ms. `performance` yoksa (eski ortam) `Date.now()`. */
export function monotonicNow(): number {
  if (typeof performance !== 'undefined' && Number.isFinite(performance.timeOrigin)) {
    return performance.timeOrigin + performance.now()
  }
  return Date.now()
}

export class ServerClock {
  private anchor: { server: number; local: number } | null = null

  /**
   * `local` anında sunucu saatinin en az `server` olduğu bilgisi. Mevcut tahminden büyükse tahmin
   * buna göre düzelir; küçükse (daha gevşek alt sınır, ör. yalnızca eski uçaklı sakin bir görünüm)
   * yok sayılır.
   */
  observe(server: number, local: number): void {
    if (!Number.isFinite(server) || !Number.isFinite(local)) return
    const estimate = this.serverAt(local)
    if (estimate === null || server > estimate) this.anchor = { server, local }
  }

  /** `local` anındaki tahmini sunucu saati; henüz gözlem yoksa null. */
  serverAt(local: number): number | null {
    return this.anchor === null ? null : this.anchor.server + (local - this.anchor.local)
  }

  /** Sunucu saatindeki `server` anının istemci saatindeki karşılığı; gözlem yoksa null. */
  localAt(server: number): number | null {
    return this.anchor === null ? null : this.anchor.local + (server - this.anchor.server)
  }
}
