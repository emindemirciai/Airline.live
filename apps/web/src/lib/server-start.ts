import 'server-only'

/**
 * Web sunucusu sürecinin açıldığı an, saniyeye yuvarlanmış (D-091). Yenilikler sayfası yayın anı
 * henüz yazılmamış çalışan sürüm için bunu gösterir.
 *
 * - Üretimde süreç konteynerle başlar; yeni sürüm yayına alınınca konteyner yeniden kurulur. Bu an
 *   çalışan sürümün yayına girdiği andır (konteyner aynı sürümle yeniden başlarsa o anı gösterir).
 *   Geliştirmede `pnpm dev`'in açılışıdır.
 * - Kaynak `performance.timeOrigin`'dir (Node'da sürecin başlangıcı). Next.js sayfa modülünü ilk
 *   istekte yükler; modül yüklenirken `new Date()` okunsaydı an, ilk ziyaretin saati olurdu.
 * - Değer süreç boyunca sabittir; istek anına bağlı değildir.
 */
export const SERVER_STARTED_AT: Date = new Date(Math.floor(performance.timeOrigin / 1000) * 1000)
