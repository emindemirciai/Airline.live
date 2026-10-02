-- OurAirports içe aktarım süzgeci genişledi (D-080, data-sources.md §3): Türkiye'nin IATA kodlu
-- küçük alanları da alınır (yurt dışı havalimanlarının uzaklık referansı). Kaynak dosya değişmese
-- (304) de içerik bir kez yeni süzgeçle yazılsın diye iki OurAirports kaynağının koşullu indirme
-- doğrulayıcıları ve son kontrol anı sıfırlanır: worker açılışta telafi içe aktarımı ister ve dosyayı
-- koşulsuz indirir. Satır yoksa (temiz veritabanı) etkisizdir; tekrar çalışması zararsızdır.
UPDATE "reference_sources"
SET "etag" = NULL, "last_modified" = NULL, "imported_at" = NULL, "checked_at" = NULL
WHERE "source" IN ('ourairports-airports', 'ourairports-runways');
