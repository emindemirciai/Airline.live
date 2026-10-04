# Commit'li referans verisi alt kümeleri

Testler, CI ve `EXTERNAL_PROVIDERS_DISABLED=true` iken yerel geliştirme bu dosyaları kullanır; canlı kaynağa istek atılmaz (CLAUDE.md → Kalite çıtası). Üretim imajına girmez. Worker yalnızca `APP_ENV` üretim değilken ve dış istek kapalıyken okur (D-066).

| Dosya | Kaynak | Lisans | İçerik |
|---|---|---|---|
| `ourairports/airports.csv` | OurAirports `airports.csv` | Kamu malı (Unlicense) | 601 satır: Türkiye'deki bütün kayıtlar (429), EGLL, LFPG, EDDF, EHAM, OMDB, OTHH, KJFK, LEMD, ardından Türkiye dışı 1. halkanın 75 havalimanı (D-080) ve sonda 2. halkanın 89 havalimanı (D-088) |
| `ourairports/runways.csv` | OurAirports `runways.csv` | Kamu malı (Unlicense) | 358 satır: Türkiye ve sekiz uzak havalimanının bütün pistleri (146), 1. halka havalimanlarının açık pistleri (89) ve sonda 2. halka havalimanlarının açık pistleri (123) |
| `vrs/airlines.csv` | VRS standing-data `airlines/schema-01/airlines.csv` | CC0-1.0 | Havayollarının tamamı (5.964) |
| `adsblol/*.json` | adsb.lol API v2 (`/v2/point`, `/v2/hex`, `/v2/callsign`, `/v2/reg`) | ODbL-1.0 | 2026-09-27 08:49 UTC: LTFM çevresi 40 NM (18 uçak), 3 hex, 1 çağrı kodu, 1 tescil. `index.json` istek listesidir |
| `weather/*.json` | Elle yazılmış, sentetik (aviationweather.gov Data API biçiminde; istek atılmadı) | Kayıt değil, projenin kendi verisi | 20 istasyonun (14 Türkiye, 6 1. halka) METAR/SPECI'si, 11 istasyonun TAF'ı, LTFM'nin 3 günlük METAR/TAF geçmişi. Ayrıntı ve zaman kaydırma: [`weather/README.md`](weather/README.md) (D-078) |

- **Alınma tarihi:** 2026-09-27, kullanıcı onayıyla tek seferlik indirme (CLAUDE.md DUR-SOR 6). OurAirports 1. ve 2. halka satırları ikinci, yine kullanıcı onaylı tek seferlik indirmeden gelir: **2026-10-01T23:03Z** (`airports.csv` ve `runways.csv`; M6d ve M6g). O indirmede Türkiye ve sekiz uzak havalimanının satırları 2026-09-27'dekiyle aynıydı; 1. halka satırları M6d'de, 2. halka satırları M6g'de (2026-10-04, aynı indirmeden, yeniden indirme yapılmadı) sona eklendi, mevcut satırlar ve sıraları değişmedi. adsb.lol için 4 istek, aralarında 12 sn (`scripts/record-adsblol-fixtures.mts`); User-Agent'taki iletişim adresi yalnızca ortam değişkenindeydi, hiçbir dosyaya yazılmadı.
- **Kaynak adresleri:** `packages/providers/src/reference/ourairports.ts` (`OURAIRPORTS_URLS`) ve `vrs.ts` (`VRS_AIRLINES_URL`).
- **ETag'ler:** airports `"6ab87735-c24393"`, runways `"6ab87735-3c86da"` (2026-09-27 indirmesi; 2026-10-01 indirmesinin ETag'i kaydedilmedi).
- **Halka seçimi (D-080, D-088):** Türkiye dışında, tarifeli seferi olan (`scheduled_service = yes`), üç harfli IATA kodlu `large_airport` ya da `medium_airport`; Türkiye'deki IATA kodlu en yakın OurAirports satırına büyük daire uzaklığı 1. halkada ≤ 500 km, 2. halkada 500 km'den fazla ve ≤ 1.000 km. Uzaklık Türkiye'deki IATA kodlu bütün satırlarla (66; listeye girmeyen beş tarifesiz küçük alan dahil) ölçülür; uygulama da aynı kümeyle ölçer (içe aktarım bu beş alanı yalnızca uzaklık referansı olarak alır), bu yüzden 164 havalimanının (75 + 89) hepsi uygulamada da aynı halkadadır. Pistlerden kapalı olanlar (`closed = 1`) alınmadı (2. halkada 9 kapalı pist).
- **Kaynakta bilinen hatalar (D-088):** fixture satırları kaynaktaki gibidir; düzeltmeler kodda, belgeli tablolardadır. İskenderiye (OurAirports `ident` HEBA, `icao_code` ve `gps_code` HEAX) uygulamada HEBA'dır (`OURAIRPORTS_ICAO_CORRECTIONS`); Taba'nın "04/22" ve Cluj'un "08/26" satırları uzunluğu ve koordinatı olmayan yinelenen kayıtlardır, gösterilmez (`HIDDEN_RUNWAY_IDS`); Bacău'nun adındaki çift boşluk okurken teke iner.
- **Biçim:** Satırlar kaynaktaki gibidir. Bütün alanlar tırnaklıdır, BOM yoktur ve satır sonu LF'dir; ayrıştırıcının tırnaklı alan yolunu da sınar.

## Neyi sınar
- adsb.lol yanıt biçimi ve M3 kabulü (`packages/providers/src/live/*.test.ts`). Bu örnekte yerdeki uçak, `lastPosition`, ICAO dışı (`~`) adres yok; o durumlar testte gerçek bir kaydın alanları değiştirilerek üretilir. Bir kayıtta LADD bayrağı (8) var.
- M2 pist kabulü: eşikler arası mesafe, eşikten eşiğe yön, kaydırılmış eşik (`packages/providers/src/reference/reference.test.ts`).
- LTFM'de heading alanı hatalı dört pist (16L/16R/17L/17R) ve LTAC 03L'de zaten eşik olan uç koordinatı (D-066).
- İçe aktarım, değişmeyen dosyanın yeniden yazılmaması ve hata kaydı (`apps/worker/src/jobs/jobs.int.test.ts`).
- Türkiye dışı havalimanları (M6d, D-080; M6g, D-088): listelenen havalimanları kapsamı (`scope=listed`, 61 + 75 + 89 = 225), Türkçe ad ve şehir tablosu, ülke adları, KKTC (LCEN), saat dilimleri, kaynak düzeltmeleri (İskenderiye HEBA, yinelenen boş pistler) ve hava durumu istasyon listesinin halkalarla büyümesi.

## Yeniden üretmek
Ham dosyaları indirmek canlı istektir; önce kullanıcıya sorulur. Sonra ağa çıkmadan alt küme üretilir:

```bash
pnpm exec tsx scripts/make-reference-fixtures.mts <ham-dosyaların-klasörü>
```

Betik önce Türkiye ve sekiz uzak havalimanını, sonra halka halka Türkiye dışı adayları yazar (önce 1. halka, sonra 2. halka; her halka kaynak sırasıyla, pistler de aynı sırayla); isteğe bağlı ikinci argüman çıktı klasörüdür (varsayılan `tools/fixtures`). 2026-10-01 OurAirports ham dosyalarıyla bugünkü iki OurAirports fixture'ını bayt bayt aynı üretir (2026-10-04'te denetlendi). Yeni halka `FIXTURE_RINGS_KM`'e eklenir; satırları dosyanın sonuna gelir. Fixture değişirse testlerdeki sayılar (601 havalimanı, 429'u Türkiye'de; `packages/providers/src/reference/reference.test.ts`) ve bu dosyadaki tarih güncellenir.

adsb.lol fixture'ları (canlı istek, en fazla 5, önce kullanıcıya sorulur):

```bash
CONTACT_EMAIL=<adres> pnpm exec tsx scripts/record-adsblol-fixtures.mts --confirm
```
