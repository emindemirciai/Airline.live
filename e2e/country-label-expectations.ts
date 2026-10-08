// Ülke adlarının e2e beklentileri (D-096, D-099, D-100, D-102). Değerler commit'li yerleşim tablosundan
// (`COUNTRY_LABEL_PLACEMENTS`) ve kutu modelinden gelir; tools/src/country-labels/placement.test.ts
// onları yeniden hesaplar, tablo ya da model değişince orada kırılır. Görünüm: Tahran Mehrabad
// (OIII) ortada, Türkçe, geniş harita (1280 px), havalimanı kodları gizli.

/**
 * `shown`: ilk sığma yakınlaştırması en çok z olan ve çapası tuvalin içinde (kenardan en az 40 px)
 * kalan adlar; MapLibre hepsini yerleştirir. `hidden`: ilk sığma yakınlaştırması z'den büyük
 * adlar; katmanları o yakınlaştırmada çizilmez, nerede olurlarsa olsunlar listede yoktur. Kesirli
 * `minzoom`: z4'teki ÖZBEKİSTAN (4,5) ve PAKİSTAN (4,75) ile z3'teki AFGANİSTAN, SURİYE (3,75),
 * TÜRKİYE ve HİNDİSTAN (3,25) çapaları tuvalin içindeyken yalnızca katmanın kesirli `minzoom`'uyla
 * gizlenir; ilk üçü z4'te yazılır (HİNDİSTAN'ın çapası z4'te tuvalin dışındadır). 4. halkayla
 * (D-102) HİNDİSTAN'ın 105 pini arasında boş yer kalmaz: ad kalabalık kuralıyla 3,25'ten yazılır
 * (v0.22.5'te z3'te görünürdü). ÇAD z3'te yazılır (D-100; 4. halkayla N'Djamena listelenir).
 */
export const TEHRAN_COUNTRY_LABELS = {
  z5: {
    shown: ['İRAN', 'IRAK', 'TÜRKMENİSTAN'],
    hidden: [
      'AZERBAYCAN',
      'ERMENİSTAN',
      'GÜRCİSTAN',
      'KUVEYT',
      'KATAR',
      'BİRLEŞİK ARAP EMİRLİKLERİ',
    ],
  },
  z4: {
    shown: ['İRAN', 'IRAK', 'TÜRKMENİSTAN', 'AFGANİSTAN', 'SURİYE', 'TÜRKİYE'],
    hidden: ['ÖZBEKİSTAN', 'PAKİSTAN', 'GÜRCİSTAN', 'AZERBAYCAN', 'ERMENİSTAN'],
  },
  z3: {
    shown: ['İRAN', 'KAZAKİSTAN', 'LİBYA', 'ÇAD'],
    hidden: ['AFGANİSTAN', 'SURİYE', 'TÜRKİYE', 'HİNDİSTAN', 'IRAK', 'TÜRKMENİSTAN'],
  },
} as const

/**
 * İRAN'ın z5'teki görünür kutusu (mürekkep, harf aralığı ve halenin en uzak ucu; güvenlik payı
 * yok), OIII pininin ucuna (tuvalin ortası) göre px. Ad boş yer kuralıyla (D-099) Dest-i Kevir'deki
 * ortak noktadadır (55,6° D, 34° K; Tahran'ın 428 km doğu-güneydoğusu): kutusuna hiçbir pin ya da
 * kod girmez.
 */
export const IRAN_Z5_BOX = { left: 135.9, top: 72.4, right: 253.9, bottom: 112.1 } as const

/**
 * İmam Humeyni Havalimanı'nın (OIIE, IKA) pin ucu z5'te, OIII pininin ucuna göre px. Pin İRAN'ın
 * kutusunun dışındadır; e2e pin kesitinin ad açıkken ve kapalıyken aynı kaldığını ve pinin
 * tıklandığını burada denetler.
 */
export const IKA_PIN_Z5 = { x: -7.4, y: 15.3 } as const
