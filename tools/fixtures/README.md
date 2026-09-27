# Commit'li referans verisi alt kümeleri

Testler, CI ve `EXTERNAL_PROVIDERS_DISABLED=true` iken yerel geliştirme bu dosyaları kullanır; canlı kaynağa istek atılmaz (CLAUDE.md → Kalite çıtası). Üretim imajına girmez. Worker yalnızca `APP_ENV` üretim değilken ve dış istek kapalıyken okur (D-066).

| Dosya | Kaynak | Lisans | İçerik |
|---|---|---|---|
| `ourairports/airports.csv` | OurAirports `airports.csv` | Kamu malı (Unlicense) | Türkiye'deki bütün kayıtlar (437) ve EGLL, LFPG, EDDF, EHAM, OMDB, OTHH, KJFK, LEMD |
| `ourairports/runways.csv` | OurAirports `runways.csv` | Kamu malı (Unlicense) | Yukarıdaki havalimanlarının bütün pistleri (146) |
| `vrs/airlines.csv` | VRS standing-data `airlines/schema-01/airlines.csv` | CC0-1.0 | Havayollarının tamamı (5.964) |

- **Alınma tarihi:** 2026-09-27, kullanıcı onayıyla tek seferlik indirme (CLAUDE.md DUR-SOR 6).
- **Kaynak adresleri:** `packages/providers/src/reference/ourairports.ts` (`OURAIRPORTS_URLS`) ve `vrs.ts` (`VRS_AIRLINES_URL`).
- **ETag'ler:** airports `"6ab87735-c24393"`, runways `"6ab87735-3c86da"`.
- **Biçim:** Satırlar kaynaktaki gibidir. Bütün alanlar tırnaklıdır, BOM yoktur ve satır sonu LF'dir; ayrıştırıcının tırnaklı alan yolunu da sınar.

## Neyi sınar
- M2 pist kabulü: eşikler arası mesafe, eşikten eşiğe yön, kaydırılmış eşik (`packages/providers/src/reference/reference.test.ts`).
- LTFM'de heading alanı hatalı dört pist (16L/16R/17L/17R) ve LTAC 03L'de zaten eşik olan uç koordinatı (D-066).
- İçe aktarım, değişmeyen dosyanın yeniden yazılmaması ve hata kaydı (`apps/worker/src/jobs/jobs.int.test.ts`).

## Yeniden üretmek
Ham dosyaları indirmek canlı istektir; önce kullanıcıya sorulur. Sonra ağa çıkmadan alt küme üretilir:

```bash
pnpm exec tsx scripts/make-reference-fixtures.mts <ham-dosyaların-klasörü>
```

Fixture değişirse testlerdeki sayılar (437 havalimanı, 146 pist) ve bu dosyadaki tarih güncellenir.
