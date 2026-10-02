# Hava durumu fixture'ları (METAR/TAF)

**Gerçek hava durumu değildir.** Elle yazılmış, sentetik raporlardır; aviationweather.gov'a hiç istek atılmadı (D-078, kullanıcı kararı 2026-10-01). Dosyalar AWC Data API'nin JSON biçimindedir (`format=json`).

| Dosya | İçerik |
|---|---|
| `metar.json` | METAR/SPECI kayıtları (`/api/data/metar` biçimi): 20 istasyonun (14'ü Türkiye'de, 6'sı 1. halkada) güncel raporu ve LTFM'nin 3 günlük geçmişi |
| `taf.json` | TAF kayıtları (`/api/data/taf` biçimi): 11 istasyon (7 + 1. halkadan 4), LTFM için 3 günlük geçmiş |
| `index.json` | Kaynak notu, `fixtureNow` (2026-01-15T13:00:00Z) ve durum listesi |

- **Asıl veri ham metindir:** `rawOb` ve `rawTAF`. AWC'nin çözülmüş alanları (`temp`, `altim`, `visib`, `clouds`, `fltCat` …) ham metinle tutarlı yazıldı ve yalnızca çapraz denetim içindir.
- **Durumlar:** sağanak ve kuvvetli rüzgâr (LTFM), CAVOK (LTBA), kar (LTAC), kuvvetli gök gürültülü sağanak (LTAI), değişken hafif rüzgâr ve süresi dolmuş TAF (LTBJ), sis, dikey görüş ve RVR (LTCG), çisenti (LTFJ), kar sağanağı ve savrulan kar (LTCE), kuru pus ve NSC (LTDB), çevrede gök gürültüsü (LTAU), dolulu SPECI (LTBS), donan yağmur (LTCF), gecikmiş gözlem (LTAJ), eski gözlem (LTCW), raporu olmayan havalimanı (LTBQ).
- **Türkiye dışı, 1. halka (M6d, D-080):** kuzeyli rüzgâr ve TEMPO hamleli TAF (LGAV), kuvvetli kuzeybatı rüzgârı (LGTS), hafif sağanak ve CB (LCLK), KKTC olarak gösterilen Ercan, TAF yok (LCEN), donan sis, iki RVR ve dikey görüş (LBSF), m/sn rüzgâr, pus ve MVFR tavan (UGTB). LBSF ve UGTB gözlemleri :30'da, diğerleri :50'dedir. Gerçek kayıt değildir; aynı biçimde elle yazıldı.
- **LTFM geçmişi:** 2026-01-12 13:20Z'den 2026-01-15 12:50Z'ye 30 dakikada bir METAR (144), bir SPECI, bir düzeltilmiş rapor (`METAR COR`, aynı zamanlı asıl raporun yerine geçer) ve 13 TAF (6 saatte bir ve bir AMD). Hava sırası (açık, sis, yağmur, gök gürültülü sağanak, açılma, kuzeydoğulu sağanak) elle yazıldı; tek seferlik bir betikle 30 dakikalık raporlara açıldı. Düzeltme gerekirse JSON doğrudan düzenlenir.
- **Zamanın kaydırılması:** Worker `APP_ENV` development ya da test iken ve `EXTERNAL_PROVIDERS_DISABLED=true` iken bu dosyaları okur. Bütün zamanları (epoch alanları ve ham metindeki `DDHHMMZ`, `DDHH/DDHH`, `FMDDHHMM`, `TX/TN`, eğilimdeki `FM/TL/AT` grupları) tam saat kaydırır; `fixtureNow` içinde bulunulan UTC saatinin başına denk gelir. Böylece güncel raporlar 10–70 dakika (LBSF ve UGTB 30–90 dakika), LTAJ 1 saat 40 dakika–2 saat 40 dakika, LTCW 8–9 saat eski görünür. Birim testleri kaydırmaz, `fixtureNow`'ı kullanır.
- Üretim imajına girmez; üretim kodu bu dosyaları import etmez, worker çalışma anında okur (`apps/worker/src/jobs/weather-fixture.ts`).
