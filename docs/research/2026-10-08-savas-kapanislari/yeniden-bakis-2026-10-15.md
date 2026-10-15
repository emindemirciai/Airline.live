# Savaş kapanışları: dalgalı kayıtlara yeniden bakış (2026-10-15)

Tasarımdan önce, 2026-10-08 araştırmasında durumu değişebilecek görünen beş kayda yeniden bakıldı: Mekele, Aksum, Kamışlı, Gao ve Mopti. Yalnız kamuya açık sayfalar okundu; uçuş verisi API'si çağrılmadı. Etiketler D-110'un ve `docs/REFERENCES.md` → "Savaş kapanışları (D-110)" listesinindir. Sonuçlar `CIVIL_FLIGHT_CLOSURES`'a (D-110) böyle girdi.

| Havalimanı | 2026-10-08 önerisi | 2026-10-15 durumu | Karar | Kaynak (okunma 2026-10-15) |
|---|---|---|---|---|
| Mekele (HAMK, MQX), Etiyopya | belirsiz not, 2026 | Ethiopian Airlines Mekele seferlerinin 2026-10-11 pazar günü yeniden başlayacağını duyurdu; 2026-10-12 haberine göre seferler başladı | **not yok** (kayıt tabloya girmedi; listede kalır) | A11 (africanews 2026-10-09 ve 2026-10-12) |
| Aksum (HAAX, AXU), Etiyopya | belirsiz not, 2026 | 2026-10-09 haberinde Aksum ve Şire seferleri hâlâ askıda (Mekele'ninkiler açılırken); seferler 2026-09-23'ten beri askıdaydı (A2; FCDO'ya göre Tigray'a sivil uçuşlar 2026-09-22'de askıya alındı); resmî kaynak FCDO tavsiyesidir (A1), havacılık otoritesinin duyurusu yok | **belirsiz**, `since` 2026-09-23 (seferlerin askıya alındığı gün; denetim son 30 günde el değiştirdi) | A1, A2, A11 |
| Kamışlı (OSKL, KAC), Suriye | belirsiz not, 2024 | SDG–Şam anlaşmasıyla ilk sivil uçuş 2026-02-21'de indi; hükümet heyeti Şubat 2026'da yeniden açılış öncesi incelemedeydi; onarım 2026-09-08'de "son aşamada". Şubat 2026'dan sonra tarifeli seferin başladığına dair haber bulunamadı | **belirsiz**, `since` 2024-12-08 (açılışı yakın duyurulan kayıt) | M6, M7, M8; Rudaw ve Enab Baladi (aşağıda) |
| Gao (GAGO, GAQ), Mali | belirsiz not, 2026 | Sky Mali iç hat seferlerini 2026-04-28'de güvenlik nedeniyle askıya aldı; Gao'ya dönüş haberi bulunamadı | **belirsiz**, `since` 2026-04-28 (resmî havacılık kaynağı yok, havayolu açıklaması basında) | A12, A13, A14 |
| Mopti Sévaré (GAMB, MZI), Mali | belirsiz not, 2026 | Aynı askıya alma; Sévaré hava üssü 2026-09'da saldırıya uğradı; dönüş haberi bulunamadı | **belirsiz**, `since` 2026-04-28 | A12, A13, A15 |

Ek kaynaklar (Kamışlı):
- Rudaw, "first plane lands at Qamishli airport in over a year": https://www.rudaw.net/english/middleeast/syria/210220261
- Enab Baladi, "Syrian government delegation at Qamishli Airport ahead of reopening" (2026-02): https://english.enabbaladi.net/archives/2026/02/syrian-government-delegation-at-qamishli-airport-ahead-of-reopening/

Yeniden okunan kaynaklar:
- A1 FCDO Etiyopya seyahat tavsiyesi (2026-10-07 güncel): https://www.gov.uk/foreign-travel-advice/ethiopia
- A2 aerocorner, 2026-09-24 (Mekele, Aksum, Şire seferleri askıda): https://aerocorner.com/news/ethiopian-airlines-mekelle-axum-shire-flights-suspended/
- A11 africanews, 2026-10-09: https://www.africanews.com/2026/10/09/ethiopian-airlines-to-resume-flights-to-tigrays-capital-from-sunday/ ; 2026-10-12: https://www.africanews.com/2026/10/12/flights-to-mekelle-resume-after-ethiopian-forces-recapture-of-tigray-capital/
- A12 afriquinfos, 2026-04-28: https://afriquinfos.com/sky-mali-justifie-la-suspension-temporaire-de-ses-vols-domestiques-securite-en-rouge-sur-bamako/
- A13 ch-aviation, 2026-05-12: https://www.ch-aviation.com/news/167046-sky-mali-halts-flights-amid-security-crisis
- A14 Prensa Latina, 2026-04-28: https://www.prensa-latina.cu/2026/04/28/aerolinea-de-mali-anuncia-suspension-de-vuelos/
- A15 Koaci, 2026-09-15 (Sévaré üssüne saldırı): https://www.koaci.com/article/2026/09/15/mali/politique/mali-la-base-aerienne-de-sevare-visee-par-une-attaque-attribuee-au-jnim_200561.html
- M6 SANA EN, ~2026-09-08 (Kamışlı, onarım son aşamada): https://sana.sy/en/syria/2341201/
- M7 SyriacPress, 2026-09-08: https://syriacpress.com/blog/2026/09/08/delegation-reviews-final-stages-of-qamishli-international-airport-rehabilitation
- M8 Shafaq, 2026-02-21 (ilk sivil uçuş): https://shafaq.com/en/Middle-East/First-civilian-flight-lands-at-Qamishli-Airport-under-SDF-Damascus-deal

**Sonuç:** Mekele araştırmadan üç gün sonra açıldı; tablo durağandır ve durum yayınlar arasında değişebilir. Belirsiz kayıtlar (Aksum, Kamışlı, Gao, Mopti) RUNBOOK → "Savaş kapanışları tablosu"ndaki bakımla her havalimanı yayınında ve ayda bir yeniden okunur.

## Yayın öncesi inceleme (2026-10-15)

Tablo yazıldıktan sonra kayıtların kaynakları D-110'un kendi ölçütüyle yeniden okundu. Değişenler:

| Kayıt | Bulgu | Sonuç | Kaynak (okunma 2026-10-15) |
|---|---|---|---|
| Taiz (OYTZ, TAI), Yemen | Tek resmî kaynak 2021-07-31 tarihli (Sana merkezli CAMA: 2015-10'dan beri hizmet dışı); 12 aydan yeni resmî kaynak ya da Taiz'in kapalı olduğunu söyleyen güvenilir haber bulunamadı; Saba 2026-02-01 yalnız Muha'nın açılışını anlatır (dolaylı) | kesinden **belirsize**; `since` 2015-10 kalır (sivil seferin durduğu ayı veren kaynak yok) | M1, M2; https://en.wikipedia.org/wiki/Taiz_International_Airport |
| Simferopol (UKFF, SIP), Kırım | Ukrayna havalimanını 2014-03'ten beri kapalı sayar; Rus iç hat seferleri 2022-02-24'e kadar sürdü | `since` 2022-02-24 kalır (sivil seferin fiilen durduğu gün); D-110'a yazıldı | U10 |
| Rusya (R1) | AEX haberi Rosaviatsiya'nın kendi sayfası değil, aktarımdır (AviaStat → AVIA.RU → basın servisi); havalimanları "güney ve orta Rusya"dadır | kesin kalır; kaynak etiketi düzeltildi | R1 |
| Ukrayna (U4) | Bakan Kalashnyk havalimanı ve tarih vermedi; Lviv yalnız kamuoyu tartışmasında | `bolge-1-ukrayna.md` düzeltildi | U4 |
| Aksum (HAAX) | FCDO Tigray seferlerinin 2026-09-22'de askıya alındığını yazar; tablo Ethiopian Airlines'ın 2026-09-23'ünü kullanır | `since` 2026-09-23 kalır (yıl aynı) | A1, A2 |
