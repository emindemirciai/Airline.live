/**
 * Uçak ikonlarının özgün silüetleri (bu proje için çizildi; hiçbir marka ya da uygulama ikon
 * setinden alınmadı). Her sınıf için tek bir SVG yol dizesi vardır: `0 0 64 64` görünüm kutusunda,
 * burun yukarıda (kuzey), dönme merkezi kutunun ortası (32, 32). Kenar çizgisi yolun dışına
 * taşabileceği için şekiller kenardan en az 1,5 birim içeride durur.
 *
 * Birden çok alt yol (ör. motor, pervane, rotor palası) aynı dolgu kuralıyla (nonzero) birleşir.
 * Web ikonu önce kalın kenarı, sonra dolguyu çizer; böylece alt yolların iç kenarları görünmez.
 * Mobil de aynı dizeleri kullanır.
 */
import type { AircraftCategory } from './aircraft'

/** Silüet görünüm kutusunun kenarı (birim). */
export const SILHOUETTE_VIEWBOX = 64

/**
 * Sınıf başına silüet. Boyut farkı çizime gömülüdür: geniş gövde kutuyu neredeyse doldurur, jet
 * biraz küçük, hafif uçak ve helikopter daha küçüktür; böylece aynı ikon boyutunda sınıf
 * bakışta ayırt edilir.
 */
export const AIRCRAFT_SILHOUETTES: Readonly<Record<AircraftCategory, string>> = {
  // Geniş gövde: kalın gövde, geniş ve geriye açılı kanat, kanat önünde iki motor.
  heavy:
    'M32 2C34.6 2 36 5 36 9.5L36 22L61 37.4L61 40.6L36 34.4L36 46.5L48.5 55.8L48.5 58.8' +
    'L34.6 56.6L32 62L29.4 56.6L15.5 58.8L15.5 55.8L28 46.5L28 34.4L3 40.6L3 37.4L28 22' +
    'L28 9.5C28 5 29.4 2 32 2Z' +
    'M43.2 25.8Q43.2 24.2 45 24.2Q46.8 24.2 46.8 25.8L46.8 31.6L43.2 31.6Z' +
    'M17.2 25.8Q17.2 24.2 19 24.2Q20.8 24.2 20.8 25.8L20.8 31.6L17.2 31.6Z',
  // Dar gövde jet ve turboprop: ince gövde, geriye açılı kanat, küçük yatay kuyruk.
  jet:
    'M32 4C34.2 4 35.4 6.6 35.4 10.5L35.4 23L58 36.8L58 39.6L35.4 33.6L35.4 46L45 53.6' +
    'L45 56.4L34.2 54.4L32 60L29.8 54.4L19 56.4L19 53.6L28.6 46L28.6 33.6L6 39.6L6 36.8' +
    'L28.6 23L28.6 10.5C28.6 6.6 29.8 4 32 4Z',
  // Hafif uçak: düz, dikdörtgen kanat, burunda pervane, kısa gövde.
  light:
    'M32 10.5C34.6 10.5 35.4 12.5 35.4 15L35.4 22L57 22Q58.5 22 58.5 23.6L58.5 28.4' +
    'Q58.5 30 57 30L35.4 30L33.6 46L44 46.5Q45 46.5 45 47.6L45 50.4Q45 51.4 44 51.4' +
    'L33.2 51.4L32 54L30.8 51.4L20 51.4Q19 51.4 19 50.4L19 47.6Q19 46.5 20 46.5L30.4 46' +
    'L28.6 30L7 30Q5.5 30 5.5 28.4L5.5 23.6Q5.5 22 7 22L28.6 22L28.6 15C28.6 12.5 29.4 10.5' +
    ' 32 10.5Z' +
    'M24.5 8.4L39.5 8.4L39.5 10.8L24.5 10.8Z',
  // Helikopter: oval kabin, çapraz iki ana rotor palası, ince kuyruk kirişi ve kuyruk rotoru.
  rotor:
    'M32 16A7 10 0 0 1 39 26A7 10 0 0 1 32 36A7 10 0 0 1 25 26A7 10 0 0 1 32 16Z' +
    'M15.2 7.4L50.6 42.8L48.8 44.6L13.4 9.2Z' +
    'M48.8 7.4L50.6 9.2L15.2 44.6L13.4 42.8Z' +
    'M30.8 34L33.2 34L33 53L31 53Z' +
    'M26 51.6L38 51.6L38 54.2L26 54.2Z' +
    'M37.6 48.5L40 48.5L40 57.5L37.6 57.5Z',
  // Bilinmeyen: tip ve kategori yokken kullanılan sade, orta boy genel uçak (az açılı kanat).
  unknown:
    'M32 8C33.8 8 34.8 10 34.8 13L34.8 25L53 33L53 36.6L34.8 33.8L34 46.5L41.5 51.5' +
    'L41.5 54.5L33 53.2L32 56L31 53.2L22.5 54.5L22.5 51.5L30 46.5L29.2 33.8L11 36.6L11 33' +
    'L29.2 25L29.2 13C29.2 10 30.2 8 32 8Z',
}

/**
 * Kuyruk vurgusu: dikey kuyruğun üstten görünen ince şeridi (THY ikonunda beyaz çizilir). Aynı
 * görünüm kutusundadır ve silüetin içinde kalır.
 */
export const AIRCRAFT_TAIL_ACCENTS: Readonly<Record<AircraftCategory, string>> = {
  heavy: 'M31 47.5L33 47.5L33 58.6L32 60.6L31 58.6Z',
  jet: 'M31.1 46.8L32.9 46.8L32.9 56.4L32 58.2L31.1 56.4Z',
  light: 'M31.2 45L32.8 45L32.8 51.2L32 52.8L31.2 51.2Z',
  rotor: 'M31.4 36.5L32.6 36.5L32.5 51L31.5 51Z',
  unknown: 'M31.2 46.8L32.8 46.8L32.8 52.8L32 54.6L31.2 52.8Z',
}
