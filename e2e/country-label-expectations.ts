// Ülke adlarının e2e beklentileri (D-096). Değerler commit'li yerleşim tablosundan
// (`COUNTRY_LABEL_PLACEMENTS`) ve kutu modelinden gelir; tools/src/country-labels/placement.test.ts
// onları yeniden hesaplar, tablo ya da model değişince orada kırılır. Görünüm: Tahran Mehrabad
// (OIII) ortada, Türkçe, geniş harita (1280 px), havalimanı kodları gizli.

/**
 * `shown`: ilk sığma yakınlaştırması en çok z olan ve çapası tuvalin içinde (kenardan en az 40 px)
 * kalan adlar; MapLibre hepsini yerleştirir. `hidden`: ilk sığma yakınlaştırması z'den büyük
 * adlar; katmanları o yakınlaştırmada çizilmez, nerede olurlarsa olsunlar listede yoktur.
 */
export const TEHRAN_COUNTRY_LABELS = {
  z5: {
    shown: ['İRAN', 'IRAK', 'TÜRKMENİSTAN'],
    hidden: ['AZERBAYCAN', 'ERMENİSTAN', 'KUVEYT', 'KATAR', 'BİRLEŞİK ARAP EMİRLİKLERİ'],
  },
  z4: {
    shown: ['İRAN', 'IRAK'],
    hidden: ['TÜRKMENİSTAN', 'GÜRCİSTAN', 'AZERBAYCAN', 'ERMENİSTAN'],
  },
} as const

/**
 * İRAN'ın z5'teki görünür kutusu (mürekkep, harf aralığı ve halenin en uzak ucu; güvenlik payı
 * yok), OIII pininin ucuna (tuvalin ortası) göre px. Ad Tahran'ın 32 km güneyindeki ortak
 * noktadadır (51,4° D, 35,4° K; D-096 çapa kuralı).
 */
export const IRAN_Z5_BOX = { left: -55.2, top: -5.1, right: 62.8, bottom: 34.6 } as const

/**
 * İmam Humeyni Havalimanı'nın (OIIE, IKA) pin ucu z5'te, OIII pininin ucuna göre px. Pin İRAN'ın
 * kutusunun içindedir; e2e pin kesitini ve tıklamayı burada yapar.
 */
export const IKA_PIN_Z5 = { x: -7.4, y: 15.3 } as const
