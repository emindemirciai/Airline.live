/**
 * Hava durumu kaynağının bağlantısı (M6c, D-078). API yanıtı kendi atfını taşır
 * (`attribution.url`); yanıt yoksa bu adres yazılır. NOAA/NWS logosu kullanılmaz, onay ima edilmez
 * (weather.gov/disclaimer).
 */
export const AVIATION_WEATHER_URL = 'https://aviationweather.gov/'

/** NWS kullanım şartları: kamu malı, onay ima edilmez, ad ve logo izne bağlıdır (REFERENCES.md). */
export const NWS_DISCLAIMER_URL = 'https://www.weather.gov/disclaimer'
