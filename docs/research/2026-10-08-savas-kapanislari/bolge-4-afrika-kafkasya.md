# Bölge 4: Afrika ve Kafkasya, savaş ve çatışma nedeniyle kapalı havalimanları (2026-10-08, ikinci deneme)

- **Dal:** `p1/map-war-closures` (29d415d, v0.23.0).
- **Girdi:** `sayim.md`, `sayim-adaylar.csv` ve sayımın ara çıktıları (bugünkü liste ve 4. halka dökümü; depoya alınmadı).
- **Veri:** `C:/PROJELER/havayolu-data/ourairports-2026-10-01/airports.csv` (salt okunur).
- **Kaynaklar:** Uçuş verisi API'si çağrılmadı. Bütün web kaynakları **2026-10-08'de okundu**. "Arama özeti" diye işaretlenen kaynak, sayfa açılmadan arama sonucundan okundu; doğrulama gücü daha düşüktür.

**Bu deneme ne yaptı?** İlk denemede web araçları oturum sınırına takılmış, birkaç satır açık kalmıştı. Bu denemede şunlar yeniden araştırıldı:
- Mali'deki üç kentin (Gao, Mopti, Timbuktu) Nisan 2026 sonrası durumu
- Goma'nın Mart 2026 sonrası durumu
- Tigray'ın Ekim 2026 durumu
- Sayımın "doğrulanmadı" satırları

Sonuçta iki satır değişti ve birkaç satır kapandı:
- **Timbuktu çıktı.** Sky Mali Nisan 2026 başında Timbuktu'ya uçuyordu. 2026-04-28 askıya alması yalnız Gao ve Mopti'yi kapsıyor. 2023-09-11 kesintisi de 2023-12-07'de bitmişti.
- **Bunia savaş dışı.** Kapanış Ebola yüzünden.
- **Bamenda için yeni resmî kaynak.** Kamerun Sivil Havacılık Otoritesi (CCAA) tarih ve durumu doğruladı.

Güven ölçeği:
- **resmî:** hükümet, BM ya da havacılık otoritesi
- **raporlanmış:** havayolu açıklaması ya da güvenilir haber
- **dolaylı:** sefer olmadığına dair dolaylı kanıt
- **doğrulanmadı**

## 1. Özet tablo (kural içi: büyük/orta, 3 harfli IATA, 4 karakterli ICAO; halka ≤ 4)

| ICAO | IATA | Ad | Liste | Durum (2026-10-08) | Başlangıç | Neden | Güven | Öneri | Kaynak |
|---|---|---|---|---|---|---|---|---|---|
| HAMK | MQX | Mekele Alula Aba Nega | listede (4/2566) | **kapalı** (sivil seferler durdu; havalimanı 2026-10-03'te federal güçlere geçti, seferler dönmedi) | 2026-09-23 (FCDO: 22 Eylül) | Tigray çatışması: TPLF havalimanını aldı | **resmî** (FCDO, 2026-10-07) + raporlanmış (Ethiopian Airlines, AP) | **not ekle**, 2026 | S1–S8, S32, S33 |
| HAAX | AXU | Aksum | listede (4/2482) | **kapalı** (sivil seferler durdu) | 2026-09-23 | Tigray çatışması | **resmî** (FCDO: bütün Tigray) + raporlanmış | **not ekle**, 2026 | S1, S3, S4, S7, S8 |
| FZNA | GOM | Goma International | listede (4/4233) | **kapalı** (2026-02-12'de yalnız MONUSCO helikopteri indi; pist mayınlı ve hasarlı, 2026-04-23) | 2025-01-27 | AFC/M23 Goma'yı aldı | **resmî** (MONUSCO, BM Güvenlik Konseyi, 2026-03-26) + raporlanmış | **not ekle**, 2025 | S11, S12, S34, S35 |
| FZMA | BKY | Bukavu Kavumu | **listede değil** (4/4308; sched=no) | **kapalı** | 2025-02-14 | M23 havalimanını aldı | **resmî** (MONUSCO, 2026-03-26: "iki havalimanı" kapalı) | **listeye ekle + not**, 2025 | S12–S14 |
| HSFS | ELF | El Fasher | listede (4/2591) | **kapalı** | 2023-04-15 | Sudan savaşı: kuşatma, RSF kenti 2025-10-26'da aldı | raporlanmış | **not ekle**, 2023 | S16 |
| HSNN | UYL | Nyala | listede (4/2769) | **sivil tarifeli sefere kapalı** (RSF kargo ve askerî kullanım, SAF saldırıları) | 2023-04-15 | Sudan savaşı; RSF 2023-10'dan beri denetliyor | raporlanmış | **not ekle**, 2023 | S17, S36 |
| GAGO | GAQ | Gao International | listede (4/3574) | **ticari seferler askıda**; dönüş bulunamadı. Havalimanı orduda, 2026-07-04'te Gao'ya yeni saldırı oldu | 2026-04-28 (önce 2026-03-30 ile 04-0x arasında bakanlık yasağı) | JNIM ve FLA saldırısı (2026-04-25) | raporlanmış (Sky Mali açıklaması basında; Savunma Bakanlığı yönergesi basında) | **not ekle**, 2026 | S26–S28, S37, S38 |
| GAMB | MZI | Mopti (Sévaré) | listede (4/4019) | **ticari seferler askıda**; dönüş bulunamadı. Havalimanı ve hava üssü 2026-09'da art arda saldırıya uğradı (Reuters 09-21: altı gece üst üste bombardıman) | 2026-04-28 | JNIM, Mopti'yi aldığını açıkladı (2026-04-25) | raporlanmış | **not ekle**, 2026 | S27, S28, S37, S39, S40 |
| HSOB | EBD | El Obeid | listede (4/2582) | ticari sefer bulunamadı; tek hat (Badr, Hartum) "suspended" | 2023-04-15 | Savaşın ilk günü RSF havalimanını aldığını iddia etti; 2023-05-30'da RSF saldırısı püskürtüldü; kuşatma koşulları sürüyor | dolaylı | **kullanıcı kararı** (zayıf kanıt) | S18, S41 |
| FKKV | BPC | Bamenda | **listede değil** (4/3889; sched=no) | tarifeli sefer yok. Pist 2026'da onarıldı (papa ziyareti 2026-04-16); CCAA 2026-05-07'de "ticari taşımacılığa hazır" diyor ama tarifeli sefer başlamadı | 2019-12-01 (Camair-Co uçağına ateş açıldı); 2020'de bütün faaliyet durdu | Kamerun'daki İngilizce konuşan bölgeler krizi (silahlı ayrılıkçılar) | **resmî** (CCAA, kapanış ve hazırlık) + raporlanmış | **kullanıcı kararı**: eklenirse not, 2019; savaş öncesinde tarifeli sefer yalnız 2017-07-20 ile 2019-12 arasındaydı | S42–S46 |

**Listede kalır ve not almaz** (açık ya da yeniden açıldı): Timbuktu, Hartum, Port Sudan, Dongola, Kassala, Kisangani, Gondar, Bahir Dar, Bamako, Niamey, Sohum. Ayrıntısı §3'te.

## 2. Ayrıntılar

### 2a. Etiyopya, Tigray (sayımın "open since Dec 2022" satırı artık yanlış)

- **Savaş öncesi durum:** Savaş kapanışı 2020-11'den 2022-12'ye sürdü. Aksum seferleri 2024-06'da döndü.
- **2026'nın ilk kesintisi:** 2026-01-29 ile 2026-02-03 arası (S3).
- **Bugünkü kapanış:**
  - 2026-09-20: TPLF ve müttefikleri hükümete karşı ittifak ilan etti.
  - 22-23 Eylül gecesi: Tigray güçleri Mekele havalimanını federal polisten aldı.
  - 2026-09-23: Ethiopian Airlines Mekele, Aksum ve Şire seferlerini "yeni bir duyuruya kadar" durdurdu (S2–S5, S7, S8).
  - 2026-10-03: Federal güçler havalimanını geri aldı (AP, S32).
  - 2026-10-04: Wikipedia'nın havalimanı sayfası hâlâ "As of 23 September 2026, Ethiopian Airlines had suspended all flights to Mekelle" diyor (S33).
- **Resmî teyit:** FCDO'nun 2026-10-07 tarihli uyarısı: "All civilian flights to and from Tigray region were suspended on 22 September 2026", yeniden başlama yok (S1).
- **Hava sahası:**
  - safeairspace'in son kaydı 2026-10-02 tarihli UK NOTAM EGTT V0030/26 (Tigray, Afar, Amhara; 2026-12-21'e kadar).
  - 2026'da Gondar, Bahir Dar ya da Lalibela için havalimanı kapanışı kaydı yok (S8).
- **Kod notu:** Aksum'un ICAO kodu OurAirports'ta `HAAX`, safeairspace'te `HATF`. Kayıt OurAirports kodu `HAAX` ile yazılmalı.

### 2b. Kongo DC, Goma ve Bukavu

- **Goma:** 2025-01 sonundan beri kapalı (S11, S34).
  - 2026-02-12'de MONUSCO başkan vekili helikopterle indi. Bu iniş ateşkes izleme mekanizması içindi; sınırlı ve geçiciydi (S11).
  - 2026-02-20'de AFC/M23 yeniden açılışı görüşmeyi kabul etti.
  - 2026-04-23'te AFC/M23 sözcüsü havalimanını "inutilisable" diye tanımladı: pist mayınlı ve tahrip, kule çalışmıyor, hava sahası Kinşasa'nın kararıyla kapalı (S35).
  - 2026-10-08 itibarıyla yeniden açılış haberi bulunamadı. Wikipedia sayfası son kez 2026-07-24'te düzenlendi ve açılıştan söz etmiyor (S34).
- **Bukavu Kavumu:**
  - M23 2025-02-14'te havalimanını aldı.
  - Savaştan önce CAA'nın tarifeli hatları vardı: Goma, Kalemie, Kongolo, Lubumbashi (S13).
  - MONUSCO 2026-03-26'da BM Güvenlik Konseyi'nde iki havalimanı için şunu söyledi: "fermés depuis l'occupation de la région par la rébellion de l'AFC/M23" (S12).

### 2c. Sudan

- **El Fasher ve Nyala:** Bkz. ilk taslak (S16, S17).
  - Nyala'ya 2026'da gelen trafik RSF kargosu: 2026-08 sonunda büyük bir kargo uçağı indi. SAF'ın hava ve dron saldırıları sürüyor (S36).
  - Badr'ın web sitesindeki tarifede El Fasher ve Nyala hatları hâlâ görünüyor, ama tarih yok ve tarife savaş öncesinden kalma. Kanıt sayılmadı.
- **El Obeid:** Wikipedia'daki tek hat "Badr Airlines: Khartoum (suspended)" (2026-08-26 düzenlemesi). 2023'ten sonra ticari sefer haberi bulunamadı (S18, S41).
- **Merowe** (listede değil): Durum değişmedi. Savaştan önce tarifeli sefer olduğu gösterilemedi, öneri yok (S19).

### 2d. Mali

- **Mart sonu bakanlık yasağı:** 2026-03-30'dan sonra Savunma Bakanlığı ve askerî bölge komutanlığı "yeni bir duyuruya kadar" kuzeye sivil uçuşları yasakladı. Yasak Gao, Tombouctou, Mopti, Kidal ve Ménaka'yı, UNHAS, ICRC ve Sky Mali'yi kapsıyordu; gerekçe "askerî operasyonlar" (S26, 2026-04-03).
- **Ticari seferler kısa sürede döndü:** 2026-04-09 tarihli haberde Sky Mali uçaklarının "ces derniers jours" Tombouctou'ya ve Gao'ya uçtuğu yazıyor (S47).
- **İnsani uçuşlar:** Gao ve Tombouctou'da 2026-04-10'da yeniden başladı (S48).
- **Gao ve Mopti'nin bugünkü kapanışı:** 2026-04-25'teki JNIM ve FLA saldırılarından sonra Sky Mali **2026-04-28'de yalnız Gao ve Mopti** seferlerini askıya aldı (S27, S37). Dönüş haberi bulunamadı.
  - Mopti/Sévaré: 2026-09-15'te hava üssüne kamikaze dron ve havan saldırısı oldu (S39). Reuters 2026-09-21'de altı gece üst üste bombardıman bildirdi (S40, arama özeti).
- **Bamako:** 2026-04-25'te 24 saat kapalı kaldı, 2026-04-26 06:00'da yeniden açıldı (S49). Savaş kapanışı değil.
- **Timbuktu (sayım düzeltmesi):**
  - 2023-09-11 kesintisi 2023-12-07'de bitti (S50).
  - 2026-04 başında Sky Mali Timbuktu'ya uçuyordu (S47). 04-28'deki askıya alma Timbuktu'yu kapsamıyor (S37).
  - 2026-01'de yakıt ablukası yüzünden Kayes ve Timbuktu seferleri iptal edildi (S51). Bu kapanış değil, aksama.
  - Sonuç: not önerilmez, izlenmeli.
- **Kayes:** Yakıt ablukası iptalleri oldu (2026-01) ve 2026-05-13'te sokağa çıkma yasağı ilan edildi. Kapanış bulunamadı. Not önerilmez.

### 2e. Kamerun, Bamenda (FKKV/BPC; sayımda CONFLICT_UNCERTAIN)

- **Savaş öncesi sefer:** Camair-Co Bamenda seferleri 2017-07-20'de, haftada 3 sefer olarak başladı (S43).
- **Kapanış:**
  - 2019-12-01: Douala–Bamenda QC272 seferini yapan MA60 (TJ-QDB) iniş yaklaşmasında ateş altında kaldı; saldırı ayrılıkçılara atfedildi (S44).
  - 2020'de bütün faaliyet durdu (S45).
- **2026:**
  - 2026-03-29: Camair-Co deneme uçuşları yapıldı (S46).
  - 2026-04-16: Papa ziyareti için onarıldı.
  - CCAA 2026-05-07: "closed following incidents in 2019" ve "ready to accommodate commercial air transport" diyor. Tarifeli seferin başladığı söylenmiyor (S42).
  - Cameroon Tribune 2026-05-16: "The last commercial flight had departed in 2020", yeniden başlama takvimi vermiyor.
  - Camair-Co'nun 2026'da Bamenda'ya tarifeli sefer açtığına dair kaynak bulunamadı.
- **Sonuç:** Savaş kapanışı gerçek, ama savaş öncesindeki tarifeli dönem kısa (2017–2019) ve havalimanı fiziksel olarak yeniden açıldı. Kullanıcı kararı.

## 3. Çatışma bölgesinde, açık ya da savaş dışı neden (not gerekmez)

| ICAO | IATA | Ad | Liste | Durum | Kaynak |
|---|---|---|---|---|---|
| GATB | TOM | Timbuktu | listede | Açık: Sky Mali 2026-04 başında uçuyordu. 2023 kesintisi 2023-12-07'de bitti; 2026-01'de yakıt iptalleri oldu | S47, S50, S51 |
| GAKD | KYS | Kayes | listede | Açık: yakıt ablukası iptalleri (2026-01), sokağa çıkma yasağı (2026-05-13); kapanış yok | S51, arama özeti |
| GABS | BKO | Bamako | listede | Açık: 2026-04-25'te 24 saat kapalı kaldı, 04-26'da açıldı | S49 |
| HSSK | KRT | Hartum | listede | Yeniden açıldı: 2023-04-15 ile 2025-10-22 arası kapalıydı; 2026-05-04 dron saldırısından sonra birkaç gün kapandı. 2026-09'da da seferi var (arama özeti) | S20, sayım |
| HSPN / HSDN / HSKA | PZU / DOG / KSL | Port Sudan / Dongola / Kassala | listede | Açık. Kassala: Kassala–Port Sudan hattında haftada 5 sefer (Tarco 2, Badr 3; arama özeti) | S22, S24, S52 |
| FZIC | FKI | Kisangani | listede | Açık: 2026-02-01 ve 03-01 dron saldırıları sırasında CAA uçağı indi | S15, S53 |
| FZKA | BUX | Bunia | listede | **Savaş dışı kapanış:** Ebola yüzünden ticari seferler 2026-05-23'te askıya alındı, 06-02'de açıldı, ~06-06'da yeniden askıya alındı. İnsani uçuşlar serbest. Not kuralının dışında | S54, S55 |
| HAGN / HABD | GDQ / BJR | Gondar / Bahir Dar | listede | Açık: 2026'da durdurma kaydı yok (2023-08 Amhara kesintisi kısa sürdü). FCDO bütün Amhara için "gitmeyin" diyor; izlenmeli | S1, S8, S31 |
| DRRN | NIM | Niamey | listede | Açık: IŞİD 2026-01-29 ve 2026-06-18'de havalimanına saldırdı, havalimanı açık kaldı | S56 |
| DFFD / DFOO | OUA / BOY | Ouagadougou / Bobo-Dioulasso | listede | Açık: Air Burkina OUA–BOY 2026-07'de uçuyor (arama özeti) | S57 |
| HSSM / HSWW / HJJJ | MAK / WUU / JUB | Malakal / Wau / Juba | listede | Açık. Malakal: Badr'ın askıya alması pist durumu yüzünden (2022), savaş değil. Eye Radio'nun "Malakal reopened" haberi 2013-12-31 tarihli. Wau: 2026-01'de genişletme planı açıklandı | S58, S59 |
| UGSS | SUI | Sohum | listede | Açık: Abhazya, Rus seferleri. Kapanış değil | sayım |
| HCMK | KMU | Kismayo | listede değil (OTHER) | Federal hükümet 2024-12'de Kismayo seferlerini yasakladı (Jubaland ile siyasi ve güvenlik anlaşmazlığı). 2026-02'de Kismayo'dan uçuşlar var. Savaş kapanışı değil; öneri yok | S60, S61 |
| DRZA | AJY | Agadez | listede değil (OTHER) | Açık: Niger Airlines AJY–NIM (2026-09 ile 11 arası tarife; arama özeti). Savaş kapanışı değil | S62 |
| HLGT / HLLS | GHT / SEB | Ghat / Sabha | — | Libya, `bolge-3-orta-dogu.md`'nin kapsamında. Ek bilgi: Sabha'nın yeni terminali 2026-05-16'da açıldı (S63); Ghat'taki ara teknik nedenliydi | S63 |

**Doğrulanmadı, kapanış haberi de yok:** Bosaso, Berbera, Hargeisa, Mogadişu, Zinder, N'Djamena, Bangui, Maroua, Maiduguri. Yalnız genel aramalar yapıldı; bu havalimanları için 2026'da kapanış raporu çıkmadı.

## 4. Kural dışında kalan savaş kayıpları (bilgi; listeye girmez)

| Kimlik | IATA | Ad | Neden kural dışı | Durum | Kaynak |
|---|---|---|---|---|---|
| ET-SHC (HASR; safeairspace HASI) | SHC | Şire | small_airport | 2026-09-23'ten beri seferler durdu | S3, S8 |
| HALL | LLI | Lalibela | small_airport | 2026-09-24'ten beri seferler durdu; Fano denetiminde | S9, S10 |
| HAHU | HUE | Humera | small_airport | 2026-01-29 ile 02-03 arası askıdaydı; 2026-09'daki durumu belirsiz | S3 |
| FZNP / FZMB | BNC / RUE | Beni / Butembo | small_airport | Kuzey Kivu; doğrulanmadı | — |
| HSGN, HSLI, HSZA, HSNH ve El Daein | EGN, KDX, ZLX, NUD, ADV | Geneina, Kadugli, Zalingei, En Nahud, El Daein | small_airport | Darfur ve Kordofan; doğrulanmadı | — |
| UB13 (sayım: UBBS; Azerbaycan basını: UBES) | — | Hocalı (Hankendi) | IATA yok, sched=no | Sivil hizmette değil. Azerbaycan yeniden yapım planlıyor (2024-07-05'te Aliyev ziyareti; arama özeti) | S64 |
| LY-0019 | TIP | Trablus Uluslararası | type `closed` | Bkz. `bolge-3-orta-dogu.md` | sayım |

Kafkasya'da kural içinde kalan savaş kapanışı **yok.** Erivan, Gümrü, Bakü, Gence, Nahçıvan, Gebele, Laçın, Tiflis, Batum, Kutaisi ve Sohum açık.

## 5. Uygulama için öneri

- **Kesin not, listede (7):**
  - Mekele, Aksum: `since` 2026-09-23 ("2026'dan beri")
  - Goma: 2025-01-27 ("2025'ten beri")
  - El Fasher, Nyala: 2023-04-15 ("2023'ten beri")
  - Gao, Mopti: 2026-04-28 ("2026'dan beri"). Güven "raporlanmış"; resmî bir havacılık kaynağı yok, havayolu açıklaması ve bakanlık yönergesi basında.
- **Listeye ekle ve not ver (1):** Bukavu Kavumu (FZMA/BKY), 2025-02-14. Resmî kaynak: MONUSCO.
- **Kullanıcı kararı (2):**
  - El Obeid (listede; dolaylı kanıt, 2023)
  - Bamenda (listede değil; savaş kapanışı 2019-12, havalimanı 2026'da onarıldı, tarifeli sefer başlamadı)
- **Önerilmez:**
  - Timbuktu: açık
  - Merowe: savaştan önce tarifeli sefer gösterilemedi
  - Hartum: yeniden açıldı
  - Kismayo: siyasi yasak, savaş kapanışı değil
  - Bunia: Ebola
- **Hava sahası uyarıları** (havalimanı kapanışı değil):
  - EASA CZIB-2023-01 R8, Sudan (2027-01-31'e kadar)
  - UK NOTAM EGTT V0030/26, Tigray, Afar ve Amhara (2026-12-21'e kadar)
  - Italy NOTAM LIRR E2228/26, Addis Ababa FIR (2026-11-29'a kadar) (S8, S21)

## 6. Kaynaklar (hepsi 2026-10-08'de okundu)

İlk denemeden kalan kaynaklar (S1–S31):
- S1 https://www.gov.uk/foreign-travel-advice/ethiopia/warnings-and-insurance · https://www.gov.uk/foreign-travel-advice/ethiopia (FCDO; "Updated: 7 October 2026"; "All civilian flights to and from Tigray region were suspended on 22 September 2026"; bu denemede yeniden okundu)
- S2 https://www.cp24.com/news/world/2026/09/23/ethiopian-airlines-cancels-flights-to-tigray-capital-as-fighters-take-over-airport/ (AP, 2026-09-23)
- S3 https://www.ch-aviation.com/news/172044 (2026-09-24)
- S4 https://addisfortune.news/news-alert/ethiopian-grounds-flights-to-the-north-as-conflict-escalates (2026-09-23)
- S5 https://www.aerotime.aero/articles/ethiopian-airlines-tigray-flights-mekelle-airport-seized (2026-09-23)
- S6 https://www.rustourismnews.com/2026/10/04/ethiopian-forces-retake-mekelle-airport-after-commercial-flights-were-suspended/ (2026-10-04)
- S7 https://aerocorner.com/news/ethiopian-airlines-mekelle-axum-shire-flights-suspended/ (2026-09-24)
- S8 https://safeairspace.net/ethiopia/ (bu denemede yeniden okundu; 2026'da son kayıtlar 10-02, 09-23 ve 09-01; Gondar, Bahir Dar ve Lalibela için kayıt yok)
- S9 https://www.devdiscourse.com/article/international/3981975-flights-suspended-to-ethiopian-holy-town-of-lalibela-as-fighting-expands (Reuters, 2026-09-25)
- S10 https://www.defconlevel.com/alert/2026-09-26-u-s-embassy-advises-against-travel-to-amhara-tigray-and-afar-fighting-near-lalibela
- S11 https://www.ktpress.rw/2026/02/goma-international-airport-sees-first-aircraft-in-over-a-year/ (2026-02-12)
- S12 https://www.radiookapi.net/2026/03/28/actualite/politique/new-york-la-monusco-appelle-la-reouverture-des-aeroports-de-goma-et (2026-03-26; Vivian van de Perre, BM Güvenlik Konseyi; bu denemede yeniden okundu)
- S13 https://en.wikipedia.org/wiki/Kavumu_Airport (son düzenleme 2026-08-26; 2026'da açılış yok; bu denemede yeniden okundu)
- S14 https://www.africanews.com/amp/2025/02/14/m23-rebels-seize-key-airport-in-eastern-congo/
- S15 https://africanews.com/2026/03/02/drone-attack-targets-drcs-strategic-kisangani-airport · https://africanews.com/2026/02/04/afcm23-rebels-claim-responsability-for-drone-attack-on-kisangani-airport
- S16 https://en.wikipedia.org/wiki/Siege_of_El_Fasher · https://allafrica.com/stories/202510280552.html · https://en.wikipedia.org/wiki/El_Fasher_Airport
- S17 https://darfur24.com/en/2026/08/11/increased-air-traffic-at-nyala-airport/ · https://darfur24.com/en/2026/09/23/nyala-airport-strike-disrupts-rsf-deployment-flight/ · https://sudantribune.com/article/319114
- S18 https://en.wikipedia.org/wiki/Siege_of_El_Obeid (havalimanı: 2023-04-15'te RSF iddiası, 2023-05-30'da püskürtülen saldırı; 2025-26'da havalimanına özgü kayıt yok)
- S19 https://en.wikipedia.org/wiki/Merowe_Airport
- S20 https://www.dabangasudan.org/en/all-news/article/un-flights-from-khartoum-airport-suspended-for-the-third-day-following-drone-attack-sudan-pm-visits-site · https://sudantribune.com/article/313688
- S21 https://safeairspace.net/sudan/ (EASA CZIB-2023-01 R8)
- S22 https://www.flightsfrom.com/DOG-PZU (arama özeti)
- S24 https://sudantribune.com/article/314120 · https://sudantribune.com/article/316718 (arama özeti)
- S26 https://fr.allafrica.com/stories/202604080547.html (2026-04-03; RFI; Savunma Bakanlığı yönergesi; bu denemede yeniden okundu)
- S27 https://www.ch-aviation.com/news/167046-sky-mali-halts-flights-amid-security-crisis (2026-05-12; bu denemede yeniden okundu: yalnız Gao ve Mopti)
- S28 https://en.wikipedia.org/wiki/2026_Mali_offensives (2026-04-25: "Malian forces held the Gao airport", JNIM Mopti'yi aldığını açıkladı; en son kayıt 2026-09-10)
- S31 https://www.ch-aviation.com/news/130465-ethiopian-airlines-suspends-amhara-flights-due-to-clashes (2023-08; arama özeti)

Bu denemede eklenen kaynaklar (S32–S64):
- S32 https://www.clickondetroit.com/business/2026/10/03/ethiopian-federal-forces-retake-mekelle-airport-from-tigrayan-fighters-residents-say/ (AP, 2026-10-03; arama özeti: havalimanı geri alındı, seferlerin dönmesi otomatik değil)
- S33 https://en.wikipedia.org/wiki/Alula_Aba_Nega_Airport (son düzenleme 2026-10-04 08:08 UTC: "As of 23 September 2026, Ethiopian Airlines had suspended all flights to Mekelle")
- S34 https://en.wikipedia.org/wiki/Goma_International_Airport (son düzenleme 2026-07-24; açılış yok)
- S35 https://actualite.cd/2026/04/23/goma-selon-lafcm23-kinshasa-qui-avait-ferme-lespace-aerien-detient-la-cle-de-reouverture · https://www.journaldekinshasa.com/aeroport-de-goma-le-neuvieme-round-des-discussions-na-rien-debloque/ (2026-04-23; kapalı, pist mayınlı)
- S36 https://sudantribune.com/article/317809 (arama özeti; Nyala'ya kargo uçağı geldikten sonra dron saldırıları, 2026-08)
- S37 https://afriquinfos.com/sky-mali-justifie-la-suspension-temporaire-de-ses-vols-domestiques-securite-en-rouge-sur-bamako/ (2026-04-28: "les vols à destination et en provenance de Gao et Mopti sont temporairement suspendus")
- S38 https://worldview.ranenetwork.com/content/situational-report/2026-07-06/mali-jnim-and-fla-launch-new-coordinated-attacks-captures-most-of-anefis (arama özeti; Gao'ya 2026-07-04 saldırısı)
- S39 https://www.koaci.com/article/2026/09/15/mali/politique/mali-la-base-aerienne-de-sevare-visee-par-une-attaque-attribuee-au-jnim_200561.html (2026-09-15)
- S40 https://www.polity.org.za/article/al-qaeda-linked-militants-kill-more-than-100-malian-soldiers-in-attack-this-month-sources-say-2026-09-21 (Reuters, 2026-09-21; sayfa 403 döndü, arama özeti)
- S41 https://en.wikipedia.org/wiki/El_Obeid_Airport (son düzenleme 2026-08-26: "Badr Airlines: Khartoum (suspended)")
- S42 https://www.ccaa.aero/index.php/en/espace-informations-nouvelles-de-la-ccaa-en/1859-modernization-of-bamenda-airport-towards-international-standards (CCAA, 2026-05-07) · https://cameroon-tribune.cm/article.html/76771/fr.html/details_2 (2026-05-16)
- S43 https://www.ch-aviation.com/news/57539-bamenda-cameroon-to-see-commercial-traffic-from-mid-3q17 (arama özeti; 2017-07-20 başlangıcı, haftada 3 sefer)
- S44 https://www.businessincameroon.com/public-management/0212-9733-shots-fired-at-landing-camair-co-flight-local-media-attributes-attack-to-separatists · https://www.aviation24.be/airlines/camair-co/xian-ma60-hit-by-gunfire-during-approach-into-bamenda-airport-cameroon/ (arama özeti; 2019-12-01)
- S45 https://en.wikipedia.org/wiki/Bamenda_Airport (arama özeti; 2020'de faaliyet durdu)
- S46 https://ccaa.aero/index.php/en/espace-informations-nouvelles-de-la-ccaa-en/1854-bamenda-airport-two-camair-co-test-flights-on-the-runway · https://www.hilltopvoices.com/2026/03/commercially-void-bamenda-airport.html (2026-03-25)
- S47 https://fr.allafrica.com/stories/202604090229.html (RFI, 2026-04-09: "des avions de la compagnie privée Sky Mali ont desservi Tombouctou ou encore Gao ces derniers jours")
- S48 https://www.tunisienumerique.com/mali-reprise-des-vols-humanitaires-dans-les-regions-du-nord/ (2026-04-11)
- S49 https://senego.com/mali-reprise-des-vols-a-laeroport-modibo-keita-de-senou_1954007.html · https://cameroun24.net/article/73752-mali-sous-tension-bamako-rouvre-son-aeroport-apres-des-attaques-coordonnees-couvre-feu-et-incertitudes-au-sommet-de-letat.html (arama özeti; 2026-04-26 06:00'da açıldı)
- S50 https://sahelien.com/mali-la-compagnie-aerienne-sky-mali-annonce-la-reprise-de-ses-vols-vers-tombouctou/ (2023-11-28: 2023-12-07'de yeniden başlıyor)
- S51 https://fr.allafrica.com/stories/202601140053.html (2026-01-14; yakıt ablukası, iptaller)
- S52 https://www.flightsfrom.com/KSL-PZU (arama özeti)
- S53 https://fr.allafrica.com/stories/202603030131.html (arama özeti; CAA uçağı iniş yaparken dronlar düşürüldü)
- S54 https://www.mediacongo.net/article-actualite-163939_ebola_le_gouvernement_suspend_les_vols_commerciaux_vers_bunia.html (2026-05-23)
- S55 https://ouragan.cd/2026/06/les-vols-commerciaux-de-nouveau-suspendus-a-laeroport-de-bunia (2026-06-07)
- S56 https://africanews.com/2026/06/19/niger-search-underway-for-attackers-who-killed-11-soldiers-at-niamey-airport · https://fr.allafrica.com/stories/202601300182.html (arama özeti)
- S57 https://www.cgrs.be/sites/default/files/rapporten/coi_focus_burkina_faso._possibilites_de_retour_liaisons_aeriennes_vers_ouagadougou_20260130.pdf (arama özeti)
- S58 https://www.eyeradio.org/malakal-airport-re-opened-closed-week/ (2013-12-31; güncel değil) · https://www.radiotamazuj.org/en/news/article/badr-airlines-halts-flights-to-malakal (2022, pist)
- S59 https://www.eyeradio.org/?p=19255 (arama özeti; Wau genişletme planı, 2026-01)
- S60 https://www.fanamc.com/english/amp/somalia-grounds-flights-to-kismayo-escalating-tensions-with-jubbaland (2024-12-06)
- S61 https://www.hiiraan.com/news4/2026/Feb/204310/jubaland_puntland_accuse_federal_government_of_turning_back_planes_carrying_security_delegations.aspx (arama özeti; 2026-02)
- S62 https://roame.travel/flightmap/AJY/NIM (arama özeti)
- S63 https://en.almarsad.co/national-development-agency-opens-sebha-international-airport-ushering-in-a-new-development-phase-for-libyas-south/ (arama özeti; 2026-05-16)
- S64 https://en.apa.az/official-news/president-ilham-aliyev-visited-khojaly-airport-photo-updated-441913 (arama özeti)
