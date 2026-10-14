# Bölge 1: Ukrayna (Kırım ve işgal altındaki bölgeler dahil) ve Belarus sınırı (2026-10-08, ikinci deneme)

**Kapsam.** `sayim.md` ve `sayim-adaylar.csv`'deki UA ve BY satırları:
- UA: 23 büyük/orta havalimanı (IATA ve ICAO kodlu) ile kural dışında kalan 10 satır.
- BY: listelenmeyen 3 havalimanı ve listedeki Gomel, Brest, Minsk, Mogilev.
- Komşu Moldova yalnız bilgi için.

**Veri.** `C:/PROJELER/havayolu-data/ourairports-2026-10-01/airports.csv` (salt okunur) yeniden tarandı. UA'daki 23 büyük/orta havalimanının hepsinde `scheduled_service = no` ve hiçbiri listelenmiyor. Kodsuz UA/BY büyük/orta satırlarının hepsi askerî üs: Nizhyn, Oktyabrskoe, Kirovskoe, Melitopol, Kacha, Bila Tserkva, Zhovtneve, Dolgintsevo, Hvardiiske, Saky, Dzhankoy, Ozerne, Osovtsy, Baranavichi, Babruisk, Hostomel. Kural zaten dışarıda bırakıyor; D-107 gereği de eklenmezler.

**Yöntem.** Uçuş verisi API'si çağrılmadı. Bütün kaynaklar 2026-10-08'de okundu. İlk denemede kotası dolduğu için yalnız arama özetinden alınan iddialar bu kez sayfa açılarak doğrulandı. Açılamayanlar tabloda işaretli.

## Özet

1. **Ukrayna hava sahasının tamamı 2022-02-24'ten beri sivil uçuşa kapalı ve 2026-10-08 itibarıyla açılmadı. Yeniden açılan Ukrayna havalimanı yok.**
   - **Kapanış:** Devlet hava trafik kurumu Ukraerorukh (UkSATSE) hava sahasını 2022-02-24 sabahı 02:45'te kapattı. Resmî kaynak: Ukrayna Dışişleri Bakanlığı duyurusu, kmu.gov.ua'da 2022-02-24 [S2].
   - **Güncel NOTAM:** UKBV A0081/26, 2026-09-22'den 2026-12-21'e kadar geçerli. UIR Kyiv ile Lviv, Kyiv, Dnipro, Odesa ve Simferopol FIR'larını "Ukrayna devlet hava araçları dışındaki tüm hava araçlarına" kapatıyor [S3].
   - **EASA:** CZIB-2022-01R14, son revizyonu 2026-07-24, 2027-01-31'e kadar geçerli. Bültene göre bu hava sahasında, buradaki havalimanlarına iniş ve kalkış dahil, uçulmamalı [S1].
   - **Hükümet:** Altyapı Bakanı Kalashnyk 2026-09-30'da hava sahasının kapalı olduğunu ve tarih verilmediğini söyledi; Lviv olası ilk aday [S4]. Devlet Havacılık Servisi'ne göre açılış kararından sonra en az 3 ay hazırlık gerekiyor; altı ana havalimanının açılış planı var [S5]. 2026-03-16'da açılışa hazırlık için bir çalışma grubu kuruldu [S6].
   - **Bağımsız brifing:** 2026-09-19'da doğrulanan bir brifingde bütün ticari havalimanları kapalı [S7].
2. **Kırım (Simferopol, UKFF/SIP):** İki taraftan da kapalı.
   - Ukrayna tarafı: UKFV FIR'ı NOTAM'da ve CZIB'de [S1][S3].
   - Rus tarafı: Rosaviatsiya'nın 2022-02-24 kısıtlaması. 2026-01-06'da kısıtlamanın sürdüğü 8 havalimanının arasında Simferopol da var [S14]. Rosaviatsiya Kamu Konseyi üyesi Viktor Gorbachev 2026-01-14'te açılışın anlamsız olduğunu söyledi [S15]. Aksyonov 2025-07-07'de "Putin'den emir gelirse hemen açarız" dedi [S16].
   - 2026'nın ortasında hizmete girmesi planlanan yalnız yeni kontrol kulesi [S17].
   - Not metni siyasi taraf tutmamalı ("sivil uçuşlara kapalı").
3. **Census düzeltmeleri:**
   - **Cherkasy (UKKE):** Census "Pre-war civil service: yes" diyor. Ama Bakanlar Kurulu 2021-08-06'da "1997'den beri tarifeli sefer kabul etmiyor" dedi [S10]. → "normalde açık" değil.
   - **Mariupol (UKCM):** 2009'dan beri tarifeli sefer yoktu. 2014-06-19'dan beri kapalı, 2022-03-18'den beri Rus kontrolünde [S8]. → Savaş kapanışı kesin, ama "normalde tarifeli" değil.
   - **Kryvyi Rih (UKDR):** Savaştan önce zaten tarifeli sefer yoktu: Wikipedia'ya göre 2021-10-08'de tek sefer olan Windrose–Boryspil hattı kapanmıştı [S8]. Hattın 2021-06-08'de başladığı bilgisi yalnız arama özetinden geliyor (president.gov.ua 403 verdi) [S12]. Sertifikalı sivil havalimanı; 2019'da 21.329 yolcu [S9]. → Sınıf B.
   - **Rivne (UKLR):** 2019'da 11.183 yolcu [S9]. Hangi işletmeci ve hangi hat olduğu doğrulanamadı; Wikipedia'da 2017 sonrası veri yok. → Sınıf B, hizmet bilgisi zayıf.
4. **Normalde açık olduğu belirsiz beş havalimanı.** Öneri: hiçbiri eklenmez (Belbek D-107 gereği hiç eklenmez).
   - Berdyansk: savaş öncesi sefer bilgisi yok. 2022-02-26'dan beri işgal altında ve Rus askerî kullanımında; 2024'te pist kullanılamaz durumda.
   - Poltava: Wikipedia "2020'den beri yeniden yapım için kapalı" diyor, yani kapanışın ilk nedeni savaş değil.
   - Khmelnytskyi: genel havacılık; 2010'larda kapanmış.
   - Zhytomyr: tarifeli sefer yok. 2022-02-27'de Belarus'tan atılan 2 Iskander ile vuruldu.
   - Sevastopol/Belbek: sivil kullanım yalnız 2002–2007 arasında; 2014'ten beri Rus askerî üssü.
5. **Belarus: savaş nedeniyle kapanmış havalimanı yok, not önerilmez.**
   - Ukrayna sınırındaki Gomel (UMGG) ve Brest (UMBB) listede ve açık. Vitebsk bölge yönetiminin 2025-11-06 duyurusuna göre Belavia kış tarifesinde Brest–Moskova/St. Petersburg, Gomel–Moskova (Vnukovo, Sheremetyevo)/St. Petersburg ve Mogilev–Moskova seferleri var [S18].
   - Gomel 2022'de Rus ordusunca Ukrayna'ya saldırılar için kullanıldı [S19], ama bugün sivil seferler sürüyor.
   - Minsk FIR'ındaki kısıt AB, ABD ve Kanada işletmecilerine yönelik bir hava sahası yasağı: EASA SD-2021-02/03 (2021 Ryanair olayı). Bu havalimanı kapanışı değildir [S1][S20].
   - Listelenmeyen Hrodna, Vitebsk ve Orsha'nın durumu savaşla ilgili değil (sayım sınıfı OTHER ya da MILITARY).
6. **Moldova (bilgi):** Kişinev (LUKK) listede. 2022-02-24'te kapandı, 2022-03-22'de yeniden açıldı [S21]. Not gerekmez. Bălți (BZY) savaşla ilgili değil.

## Önerilen sınıflama

**Sınıflar:**
- **A:** Savaş öncesinde (2019–2022) tarifeli sefer vardı ve kapanış savaş nedeniyle. Resmî kaynakla kesin. Not ile eklenir.
- **B:** Savaş öncesinde yalnız charter ya da kısa süreli tarifeli sefer vardı, ama havalimanı sertifikalı bir sivil havalimanıydı. Kapanış kesin. Not ile eklenebilir (önerilir).
- **C:** Savaş kapanışı kesin, ama savaş öncesinde sivil sefer yoktu ya da ihmal edilecek kadar azdı. Eklenmesi önerilmez; kullanıcı kararı.
- **X:** Eklenmez (askerî, savaş dışı kapanış ya da kural dışı).

**Sütunlar:**
- "since": sivil uçuşların durduğu gün.
- "Güven":
  - **kesin (resmî):** UA hava sahası kapanışı için EASA CZIB, Ukrayna NOTAM'ı ve Ukrayna hükümeti; havalimanına özgü olarak da geçerli, çünkü kapanış bütün FIR'ları ve havalimanlarını kapsar.
  - **bildirilen:** haber ya da ansiklopedi.
- "Hizmet" sütunu savaş öncesi yolcu hizmetini gösterir; yolcu sayıları 2019 yılına aittir [S9].

| Sınıf | ICAO | IATA | Ad | Halka | Durum (2026-10-08) | since | Neden | Güven | Hizmet (savaş öncesi) | Kaynak |
|---|---|---|---|---|---|---|---|---|---|---|
| A | UKBB | KBP | Boryspil International | 2 | kapalı; altyapı sağlam, açılış adayı, tarih yok | 2022-02-24 | Rusya'nın tam ölçekli işgali; Ukrayna hava sahası sivil uçuşa kapalı | kesin (resmî) | 15,26 M; tarifeli | S1–S7, S9 |
| A | UKKK | IEV | Igor Sikorsky Kyiv (Zhuliany) | 2 | kapalı | 2022-02-24 | aynı | kesin (resmî) | 2,62 M; tarifeli | S1–S6, S9 |
| A | UKLL | LWO | Lviv Danylo Halytskyi | 3 | kapalı; ilk açılış adayı, tarih yok | 2022-02-24 | aynı; 2022-03-18'de havalimanındaki uçak onarım fabrikası füzeyle vuruldu | kesin (resmî) | 2,22 M; tarifeli | S1–S6, S8, S9 |
| A | UKOO | ODS | Odesa International | 2 | kapalı | 2022-02-24 | aynı; yeni pist 2022-04-30'da füzeyle tahrip edildi | kesin (resmî) | 1,69 M; tarifeli | S1–S3, S5, S8, S9 |
| A | UKHH | HRK | Kharkiv International | 2 | kapalı | 2022-02-24 | aynı (cephe hattına yakın) | kesin (resmî) | 1,34 M; LOT, Turkish, UIA, SkyUp, Pegasus | S1–S3, S5, S8, S9 |
| A | UKDE | OZH | Zaporizhzhia International | 2 | kapalı | 2022-02-24 | aynı; yeni terminal 2024-05-26'da füzeyle yıkıldı | kesin (resmî) | 434 bin; Turkish, Pegasus, LOT, Austrian, SkyUp, UIA | S1–S3, S5, S8, S9 |
| A | UKDD | DNK | Dnipro International | 2 | kapalı (yıkık) | 2022-02-24 | aynı; 2022-03-15 ve 2022-04-10'da tahrip edildi, 2025-04-05'te hangar vuruldu | kesin (resmî) | 339 bin; UIA, Windrose | S1–S3, S8, S9 |
| A | UKOH | KHE | Kherson International | 2 | kapalı; mayınlı, cephe hattında | 2022-02-24 | aynı; 2022-03-02'de işgal edildi, 2022-11-11'de geri alındı | kesin (resmî) | 154 bin; Turkish, Pegasus, UIA, SkyUp | S1–S3, S8, S9 |
| A | UKLI | IFO | Ivano-Frankivsk International | 2 | kapalı (sivil); askerî kısım kullanımda | 2022-02-24 | aynı; 2022-03-11'de hava saldırısıyla ağır hasar gördü | kesin (resmî) | 115 bin; Windrose–Boryspil tarifeli | S1–S3, S8, S9 |
| A | UKLN | CWC | Chernivtsi International | 2 | kapalı | 2022-02-24 | aynı | kesin (resmî) | 77 bin; UIA–Boryspil (2016-07-12'den beri), Windrose (2021-11-09'da durdu) | S1–S3, S8, S9, S11 |
| A | UKON | NLV | Mykolaiv International | 2 | kapalı (yıkık) | 2022-02-24 | aynı; 2022-02-27'de füzeyle vuruldu, 2022 baharında tamamen yıkıldı | kesin (resmî) | 22,7 bin; Motor Sich–Zhuliany tarifeli; SkyUp ve Windrose mevsimlik | S1–S3, S8, S9 |
| A | UKLU | UDJ | Uzhhorod International | 2 | kapalı; altyapı sağlam | 2022-02-24 | aynı; pist Slovakya sınırına 90 m | kesin (resmî) | 2,8 bin; Windrose–Boryspil 2021-06-02'den itibaren tarifeli, 2021-11 sonrasında sürdü | S1–S3, S8, S9, S11 |
| A | UKFF | SIP | Simferopol International | 1 | kapalı | 2022-02-24 | Ukrayna UKFV kapanışı ve Rosaviatsiya kısıtlaması; 2014'ten beri fiilen Rusya işletiyor | kesin (EASA, NOTAM); Rus tarafı bildirilen | 5,14 M (2019), 6,83 M (2021); tarifeli | S1, S3, S8, S14–S17 |
| B | UKDR | KWG | Kryvyi Rih International | 2 | kapalı | 2022-02-24 | aynı; 2022-09-26'da X-59 füzesiyle altyapısı hasar gördü | kesin (kapanış); hizmet bildirilen | 21,3 bin; Windrose–Boryspil 2021'de açıldı, 2021-10-08'de kapanmıştı | S1–S3, S8, S9, S12 |
| B | UKWW | VIN | Vinnytsia (Havryshivka) | 2 | kapalı (yıkık) | 2022-02-24 | aynı; 2022-03-06'da 8 Kh-101 füzesiyle vuruldu | kesin (kapanış) | 40,1 bin; tarifeli yok (2020-07), düzenli charter (Türkiye, Mısır, Karadağ, Tel Aviv) | S1–S3, S8, S9 |
| B | UKLR | RWN | Rivne International | 3 | kapalı | 2022-02-24 | aynı | kesin (kapanış); hizmet zayıf | 11,2 bin; işletmeci ve hat doğrulanamadı (muhtemelen charter) | S1–S3, S8, S9 |
| C | UKCM | MPW | Mariupol International | 2 | kapalı; 2022-03-18'den beri Rus kontrolünde | 2014-06-19 | Donbas savaşı (2014), sonra işgal (2022) | bildirilen (Wikipedia); hava sahası 2022'den beri resmî olarak kapalı | 2009'dan beri tarifeli yok | S1, S3, S8 |
| C | UKKE | CKC | Cherkasy International | 2 | kapalı | 2022-02-24 | aynı | kesin (resmî) | 1997'den beri tarifeli yok (Bakanlar Kurulu 2021-08-06) | S1–S3, S10 |
| C | UKDB | ERD | Berdyansk | 2 | kapalı; 2022-02-26'dan beri işgal altında, Rus askerî kullanımında; pist kullanılamaz (2024) | 2022-02-24 | işgal; 2022-03-24 ve 2023-10-17'de vuruldu | bildirilen | sefer bilgisi yok | S1, S3, S8 |
| C | UKKV | ZTR | Zhytomyr | 3 | kapalı | 2022-02-24 | aynı; 2022-02-27'de 2 Iskander ile vuruldu | kesin (kapanış) | tarifeli yok | S1–S3, S8 |
| X | UKHP | PLV | Poltava (Suprunovka) | 2 | kapalı | 2020 | **savaş dışı**: 2020'den beri yeniden yapım, üstüne 2022 kapanışı | bildirilen | 5 bin (2019) | S8, S9 |
| X | UKLH | HMJ | Khmelnytskyi | 2 | kapalı | 2010'lar | genel havacılık; savaş öncesinde kapanmış | bildirilen | — | S8 |
| X | UKFB | UKS | Sevastopol / Belbek Air Base | 1 | Rus askerî üssü | 2014 | sivil kullanım yalnız 2002–2007; D-107: askerî alan listelenmez | bildirilen | — | S8 |

**Sayılar:** A 13, B 3 (eklenmeye önerilen toplam 16), C 4, X 3.

**OurAirports adı:** Mykolaiv'in adı "Mykolaiv International Airport [CLOSED]". Ad tablosu (`foreign-airport-names*.ts`) bu eki göstermemeli.

### Kural dışında kalanlar (yalnız bilgi; eklenmez)

| ICAO / ident | IATA | Ad | OurAirports türü | Durum | Kaynak |
|---|---|---|---|---|---|
| UA-9862 (eski UKCC) | DOK | Donetsk | closed, kodsuz | 2014-05-26'dan beri kapalı, 2014–2015'te yıkıldı | sayım, S8 |
| UA-9863 (eski UKCW) | VSG | Luhansk | closed, kodsuz | 2014-06'dan beri kapalı | sayım, S8 |
| UA-9866 | SEV | Sievierodonetsk | closed | kapalı | sayım |
| UKLT, UKHS, UKCK, UKKG, UKLC, UKFK | TNL, UMY, KRQ, KGO, UCK, KHC | Ternopil, Sumy, Kramatorsk, Kropyvnytskyi, Lutsk, Kerç | small_airport | 2022-02-24'ten beri kapalı (NOTAM'daki FIR'lar içinde) | S1, S3 |
| UKKM | — | Hostomel | medium, IATA yok | 2022'de yıkıldı (Antonov kargo) | sayım |
| Yukarıdaki kodsuz askerî büyük/orta alanlar | — | Nizhyn, Melitopol, Saky, Belbek dışı Kırım üsleri vb. | medium | askerî | airports.csv |

### Belarus ve Moldova

| ICAO | IATA | Ad | Listede | Durum (2026-10-08) | Not | Kaynak |
|---|---|---|---|---|---|---|
| UMGG | GME | Gomel | evet | açık; Belavia (Moskova, St. Petersburg). 2022'de Rus askerî kullanımı | not gerekmez | S18, S19 |
| UMBB | BQT | Brest | evet | açık; Belavia (Moskova, St. Petersburg) | not gerekmez | S18 |
| UMOO | MVQ | Mogilev | evet | açık; Belavia (Moskova) | not gerekmez | S18 |
| UMMS | MSQ | Minsk | evet | açık | not gerekmez; AB, ABD ve Kanada işletmecilerine Minsk FIR yasağı (2021'den beri, savaş dışı neden) | S1, S20 |
| UMMG / UMII / UMIO | GNA / VTB / TXC | Hrodna / Vitebsk / Orsha | hayır | savaş kapanışı değil | — | sayım |
| LUKK | RMO | Chișinău | evet | açık; 2022-02-24 ile 2022-03-22 arası kapalıydı | not gerekmez | S21 |

## Not metni önerisi (uygulayıcı için)

**Metin.** D-090'daki "olabilir" (Sivil uçuşlara kapalı olabilir (2022’den beri)) Rus havalimanları için yazılmıştı, çünkü kaynakları canlı doğrulanamamıştı. Ukrayna için durum farklı: güncel NOTAM (A0081/26, 2026-12-21'e kadar), EASA CZIB (2027-01-31'e kadar) ve 2026-09-30 tarihli hükümet açıklaması kapanışı kesinleştiriyor. Bu yüzden A ve B için kesin bir metin önerilir:
- TR: "Savaş nedeniyle sivil uçuşlara kapalı (2022’den beri)"
- EN: "Closed to civil flights due to war (since 2022)"

Mariupol eklenirse yıl "2014’ten" olur.

**Kaldırma kuralı** D-090'daki gibi kalır: resmî açılış duyurusu gelince kayıt silinir. Resmî duyuru şunlardan biri olabilir:
- yeni bir Ukrayna NOTAM'ı,
- Devlet Havacılık Servisi ya da Bakanlık duyurusu,
- EASA CZIB revizyonu.

**İzlenecek sinyaller:**
- A0081/26 2026-12-21'de doluyor; yerine gelecek NOTAM.
- CZIB-2022-01'in yeni revizyonu (şu anki 2027-01-31'de doluyor).
- Lviv ya da Boryspil'in ilk açılış duyurusu.

Simferopol'ün kaldırılması için Ukrayna NOTAM'ı yetmez; Rosaviatsiya kısıtının da kalkması gerekir.

## Kaynaklar (hepsi 2026-10-08 okundu)

- **S1** (resmî): EASA CZIB-2022-01R14, Airspace of Ukraine.
  - Yayın 2022-02-24, revizyon 2026-07-24, 2027-01-31'e kadar geçerli.
  - Ukrayna NOTAM'ı A0021/26: FIR'lar UKLV, UKBV, UKDV, UKFV, UKOV ve UIR UKBU "closed for civil aviation flights".
  - Öneri: "including landing and departures from airports located in the affected airspace".
  - Minsk FIR (UMMV) için SD-2021-02/03 hatırlatması.
  - https://www.easa.europa.eu/en/domains/air-operations/czibs/czib-2022-01r14
- **S2** (resmî): Ukrayna Dışişleri Bakanlığı, kmu.gov.ua'da yayımlandı, 2022-02-24. Ukraerorukh, yüksek havacılık güvenliği riski nedeniyle hava sahasını sivil havacılığa geçici olarak kapattı. https://www.kmu.gov.ua/news/rekomendaciyi-mzs-gromadyanam-ukrayini-u-zvyazku-iz-zakrittyam-povitryanogo-prostoru-ukrayini
  - Saat 02:45 bilgisi arama özetinden: itc.ua, 2022-02-24. https://itc.ua/news/ukrayina-zakrila-povitryanij-prostir-dlya-vsih-czivilnih-rejsiv-ochikuyetsya-kiberataka-na-aviadispetchersku-sluzhbu/
- **S3** (NOTAM metni ikincil kaynaktan): SafeAirspace, Ukraine (son güncelleme 2026-09-22). Ukrayna NOTAM'ı UKBV A0081/26, 2026-09-22'den 2026-12-21'e kadar: "…THE USE OF AIRSPACE OF UKRAINE WITHIN UIR KYIV, FIR LVIV, FIR KYIV, FIR DNIPRO, FIR ODESA, FIR SIMFEROPOL' IS PROHIBITED FOR ALL AIRCRAFT EXCEPT STATE AIRCRAFT OF UKRAINE…". https://safeairspace.net/ukraine/
- **S4**: Obozrevatel, 2026-09-30. Bakan Mykola Kalashnyk: hava sahası sıkıyönetim nedeniyle kapalı, tarih yok, Lviv olası ilk aday. https://www.obozrevatel.com/ukr/section-ekonomika-glavnaya/economy/news-ukrayina-hotuyetsya-vidkryty-nebo-shche-do-zavershennya-viyny-koly-mozhut-povernutysya-tsyvilni-reysy-30-09-2026.html
- **S5**: Glavkom, 2025-12-17. Devlet Havacılık Servisi başkan vekili Daniil Menshikov: hava sahası 2022-02-24'ten beri kapalı; açılış kararından sonra en az 3 ay gerekiyor; Boryspil, Zhuliany, Odesa, Lviv, Kharkiv ve Zaporizhzhia'nın güncel kurtarma planı var. https://glavcom.ua/country/incidents/derzhaviasluzhba-pojasnila-koli-zapratsjujut-aeroporti-pislja-vijni-1093465.html
- **S6**:
  - UNITED24 Media, 2026-03-16/17: Topluluk ve Bölge Kalkınma Bakanlığı (Kuleba'nın emri) açılış çalışma grubunu kurdu (Boryspil, Kyiv, Lviv); hava sahası kapalı. https://united24media.com/latest-news/ukraine-forms-working-group-to-prepare-for-reopening-of-airports-16932
  - TravelMole, 2026-03-27: bütün Ukrayna havalimanları ticari yolcu seferine kapalı; Lviv ile Boryspil arasında hangisinin önce açılacağı tartışmalı; tarih yok. https://www.travelmole.com/news/ukraine-ready-to-reopen-at-least-one-airport-to-international-airlines/
- **S7**: FlySafe briefing, yayın 2026-08-18, doğrulama 2026-09-19. Bütün ticari havalimanları kapalı, açılış tarihi yok; FAA NOTAM KICZ A0004/22. https://flysafe.zone/briefings/ukraine-airspace-status-2026/
- **S8**: Wikipedia havalimanı sayfaları (savaş öncesi hizmet, kapanış, hasar):
  - https://en.wikipedia.org/wiki/Odesa_International_Airport
  - https://en.wikipedia.org/wiki/Kharkiv_International_Airport
  - https://en.wikipedia.org/wiki/Lviv_Danylo_Halytskyi_International_Airport
  - https://en.wikipedia.org/wiki/Zaporizhzhia_International_Airport
  - https://en.wikipedia.org/wiki/Dnipro_International_Airport
  - https://en.wikipedia.org/wiki/Kherson_International_Airport
  - https://en.wikipedia.org/wiki/Mykolaiv_International_Airport (2026-07-07 güncel)
  - https://en.wikipedia.org/wiki/Ivano-Frankivsk_International_Airport
  - https://en.wikipedia.org/wiki/Chernivtsi_International_Airport
  - https://en.wikipedia.org/wiki/Uzhhorod_International_Airport
  - https://en.wikipedia.org/wiki/Kryvyi_Rih_International_Airport
  - https://en.wikipedia.org/wiki/Vinnytsia_International_Airport
  - https://en.wikipedia.org/wiki/Rivne_International_Airport
  - https://en.wikipedia.org/wiki/Mariupol_International_Airport
  - https://en.wikipedia.org/wiki/Berdiansk_Airport
  - https://en.wikipedia.org/wiki/Poltava_Airport
  - https://en.wikipedia.org/wiki/Khmelnytskyi_Airport
  - https://en.wikipedia.org/wiki/Zhytomyr_Airport
  - https://en.wikipedia.org/wiki/Sevastopol_International_Airport
  - https://en.wikipedia.org/wiki/Simferopol_International_Airport
  - (ilk denemeden, bu kez yeniden açılmadı) https://en.wikipedia.org/wiki/Donetsk_International_Airport · https://en.wikipedia.org/wiki/Luhansk_International_Airport
- **S9**: Wikipedia, List of the busiest airports in Ukraine (2019 yolcu sayıları; 2020–2021 yok). https://en.wikipedia.org/wiki/List_of_the_busiest_airports_in_Ukraine
- **S10** (resmî): Ukrayna Bakanlar Kurulu, 2021-08-06. Cherkasy "1997'den beri tarifeli sefer kabul etmiyor". https://www.kmu.gov.ua/news/premyer-ministr-aeroport-u-cherkasah-maye-stati-poshtovhom-do-rozvitku-turizmu-v-misti
- **S11**: Zaxid.net, 2021-10-28 (2021-11-02 ekiyle). Windrose 2021-11-09'dan itibaren Chernivtsi ve Mykolaiv seferlerini durdurdu, Uzhhorod seferi sürdü. https://zaxid.net/aviakompaniya_windrose_vidminyaye_regulyarni_reysi_kiyiv__uzhgorod_n1529179
- **S12** (yalnız arama özeti; president.gov.ua 403 verdi): Windrose Kyiv–Kryvyi Rih ilk seferi 2021-06-08. https://www.president.gov.ua/en/news/prezident-pribuv-do-krivogo-rogu-rejsovim-litakom-68893 · https://fakty.com.ua/ua/ukraine/20210416-mizh-kyyevom-uzhgorodom-chernivtsyamy-i-kryvym-rogom-vidkryyetsya-nove-aviaspoluchennya/
- S13: kullanılmadı.
- **S14**: www1.ru, 2026-01-06. Kısıtlama Anapa, Belgorod, Bryansk, Voronej, Kursk, Lipetsk, Rostov ve Simferopol'de sürüyor; Elista, Gelencik ve Krasnodar yeniden açıldı. https://www1.ru/en/news/2026/01/06/otkrytie-iuznyx-aeroportov-v-rf-naxoditsia-pod-voprosom.amp.html
- **S15**: Absatz, 2026-01-14. Viktor Gorbachev (Rosaviatsiya Kamu Konseyi üyesi, Havalimanları Birliği direktörü): açılış anlamsız, "birkaç gün içinde yeniden kapatırlar". https://absatz.media/news/148189-v-rosaviacii-ocenili-perspektivy-vozobnovleniya-raboty-aeroporta-simferopolya
- **S16**: Vechernyaya Moskva, 2025-07-07. Aksyonov ve Rosaviatsiya başkanı Yadrov: havalimanı geçici olarak kapalı, Putin'in emriyle hemen açılabilir. https://vm.ru/news/1243337-glava-kryma-aksenov-zayavil-o-gotovnosti-otkryt-aeroport-simferopolya
- **S17** (ilk denemeden, bu kez yeniden açılmadı; aynı haber news.mail.ru'da da arama özetinde görüldü): AviaPort, 2025-07-11. Simferopol'deki yeni kontrol kulesi 2026'nın ortasında hizmete girecek. https://www.aviaport.ru/news/vvod-v-ekspluatatsiyu-aeroporta-simferopol-zaplanirovali-na-seredinu-2026-goda/ · https://news.mail.ru/society/66956695/
- **S18** (resmî, Belarus bölge yönetimi): Dubrovno/Vitebsk bölge yönetimi sitesi, 2025-11-06, "Belavia adds more flights in new winter schedule": Brest–Moskova (Sheremetyevo)/St. Petersburg, Gomel–Moskova (Vnukovo, Sheremetyevo)/St. Petersburg, Mogilev–Moskova (Sheremetyevo). https://www.dubrovno.vitebsk-region.gov.by/en/news/novosti-oblasti/belavia-adds-more-flights-in-new-winter-schedule/
- **S19**: Wikipedia, Gomel Airport. 2022'de Rus ordusu Ukrayna'ya saldırılar için kullandı; bugünkü Belavia seferleri. https://en.wikipedia.org/wiki/Gomel_Airport
- **S20** (ilk denemeden, bu kez yeniden açılmadı): SafeAirspace, Belarus (2026-09-01; Minsk FIR uyarıları, havalimanı kapanışı yok). https://safeairspace.net/belarus/
- **S21** (ilk denemeden, arama özeti): ch-aviation. Moldova hava sahasını kısmen açtı; Kişinev 2022-03-22'de yeniden çalışıyor. https://www.ch-aviation.com/news/113730-moldova-partially-reopens-airspace-to-resume-chisinau-ops
