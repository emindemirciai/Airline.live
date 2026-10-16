# Savaş nedeniyle kapalı havalimanları: sayım (2026-10-08)

Dal `p1/map-war-closures` (29d415d, v0.23.0). Veri: kalıcı kopya `C:/PROJELER/havayolu-data/ourairports-2026-10-01/airports.csv` (salt okunur). Halka ve liste hesabı deponun kendi kodudur (tsx ile içe aktarıldı): `@havayolu/providers` `parseAirports` (içe aktarım süzgeci `isImportedAirport`: 6.352 satır), `@havayolu/db` `turkishReferencePoints` (61 Türkiye referansı, askerî üsler hariç), `selectListedAirports` (bugünkü liste **1.217**, D-102 ile aynı), `ourAirportsIcao`, `nearestReference`; `@havayolu/shared` `airportRing`, `isCanonicalIcao`, `civilFlightClosure`. Sayım betiği ve sınıflama oturumun geçici klasöründeydi (depoya alınmadı); tablo `sayim-adaylar.csv`.

**Kapsam:** Türkiye dışında, `large_airport`/`medium_airport`, üç harfli IATA, dört karakterli kanonik ICAO, Türkiye'deki en yakın IATA kodlu havalimanına ≤ 5.000 km (1–4. halka) ve **bugün listelenmeyen** her havalimanı: **406** (hepsi `scheduled_service = no`; hiçbiri `tools/fixtures/ourairports`'ta değil). Ayrıca listelenen ve çatışma bölgesinde olan 58 havalimanı ayrı tabloda.

Web araştırması (2026-10-08 okundu; uçuş verisi API'si çağrılmadı): EASA CZIB'leri, Rusya Ulaştırma Bakanlığı, bölge ve haber kaynakları. Her iddianın URL'si `sayim-adaylar.csv` `evidence_urls` sütununda ve aşağıdaki kaynak listesinde.

## Özet

| Sınıf | Sayı | Anlamı |
|---|---|---|
| WAR_CLOSED_CONFIRMED | 25 | Listelenmiyor; normalde sivil seferi olan, savaş nedeniyle kapalı (kaynakla). Not ile eklenmeye aday |
| WAR_CLOSED_PLAUSIBLE | 6 | Listelenmiyor; kapalı ama savaştan önce düzenli seferi olduğu belirsiz ya da askerî ağırlıklı |
| REOPENED_DATA_LAG | 4 | Listelenmiyor; savaş kapanışından sonra yeniden açıldı, OurAirports bayrağı eski (kapanış notu gerekmez) |
| CONFLICT_UNCERTAIN | 9 | Listelenmiyor; çatışma bölgesinde, savaş kapanışı doğrulanamadı |
| LISTED_NEEDS_NOTE | 4 | Listeleniyor; kapalı, not eklenmeli |
| LISTED_PLAUSIBLE_NOTE | 5 | Listeleniyor; askıya alınmış görünüyor, resmî kaynak zayıf |
| LISTED_NOTE_KEEP | 1 | Listeleniyor; D-090 notu doğru (Voronej) |
| LISTED_NOTE_STALE | 3 | Listeleniyor; **D-090 notu artık yanlış**, havalimanı yeniden açıldı |
| LISTED_REOPENED_NO_NOTE | 1 | Listeleniyor; yeniden açıldı, not gerekmez (Hartum) |
| LISTED_CONFLICT_AREA_OK | 44 | Listeleniyor; çatışma bölgesinde ama açık ya da doğrulanmadı |
| MILITARY | 84 | Listelenmiyor; askerî ya da ortak alan (D-107 ruhu: listelenmez) |
| OTHER | 278 | Listelenmiyor; savaş dışı neden |
| RULE_EXCLUDED | 14 | Kuralın dışında (kapalı tür, kod yok ya da küçük alan); yalnız bilgi |

### Ana bulgular

1. **Ukrayna (Kırım dahil):** 23 büyük/orta havalimanı (1–3. halka), hepsi 2022-02-24'ten beri sivil uçuşa kapalı. EASA CZIB-2022-01R14 (2026-07-24'te uzatıldı, 2027-01-31'e kadar): Lviv, Kyiv, Dnipro, Simferopol ve Odesa FIR'larında "landing and departures from airports" dahil uçulmaması önerilir. 17'sinin savaş öncesi sivil seferi vardı (Boryspil, Zhuliany, Lviv, Odesa, Kharkiv, Ivano-Frankivsk, Chernivtsi, Uzhhorod, Vinnytsia, Zaporizhzhia, Kryvyi Rih, Rivne, Cherkasy, Mykolaiv, Dnipro, Kherson, Simferopol); Mariupol 2014'ten beri kapalı (18. kesin kayıt). Belirsiz 5'i: Sevastopol/Belbek (askerî ağırlıklı, eklenmemesi önerilir), Berdyansk, Poltava, Khmelnytskyi, Zhytomyr. Ukrayna yetkilileri yeniden açılış için hazır olduklarını söylüyor ama tarih yok (Ukrinform 2026-06-11).
2. **Rusya:** Rosaviatsiya'nın 2022-02-24 kısıtlamasındaki 11 havalimanından **Elista (2024-05-03), Gelencik (2025-07) ve Krasnodar (2025-09-11) yeniden açıldı**. D-090 bu üçüne "kapalı olabilir" notu yazıyor: not artık yanlış, D-090'ın kendi kaldırma kuralı (resmî açılış duyurusu) karşılanıyor (Mintrans 2025-09-11 Krasnodar; Rosaviatsiya duyuruları Gelencik ve Elista). Hâlâ kapalı 8: Anapa, Belgorod, Bryansk, Voronej, Kursk, Lipetsk, Rostov (Platov, 2026-09 hâlâ kapalı), Simferopol. Voronej listede ve notu doğru; diğer altısı tarifesiz olduğu için listelenmiyor (zaten `CIVIL_FLIGHT_CLOSURES`'ta).
3. **D-102'nin açık sorusu:** Goma (2025-01'den beri kapalı; 2026-02-12'de yalnız MONUSCO inişi), El Faşir ve Nyala (2023-04'ten beri sivil uçuş yok; RSF denetimi), Taiz (OYTZ, 2015-10'dan beri hizmet dışı; 2026'daki Taiz uçuşları yeni Mokha havalimanına) not almalı. **Hartum not almamalı:** iç hatlar 2025-10-22, Sudan Airways 2026-02-01, dış hatlar 2026-04-28'de yeniden başladı.
4. **Yeni olası notlar (listede):** San'a (pist 2026-07-13'te bombalandı, UNHAS o günden beri durdu), El Obeid (2023'ten beri ticari sefer bulunamadı), Gao ve Mopti (Sky Mali 2026-04-28'de durdurdu), Timbuktu (2023-09-11'den beri durdurulmuş; yeniden başladığı doğrulanamadı). Resmî kaynak zayıf; kullanıcı kararı.
5. **Yeniden açılanlar (listede değil, OurAirports bayrağı eski):** Musul (iç hatlar 2025-11-06; Irak Sivil Havacılık Otoritesinin sertifikası 2026-06'da hâlâ eksik), Deyrizor (2026-08-05/06, Syrian Air ve Jazeera), Sirte (2025-10-25), Roş Pina (2025-01-09). Kapanış notu gerekmez; listelenmeleri ayrı bir karardır (D-080 kuralı OurAirports bayrağını izler).
6. **Kural dışında kalan savaş kayıpları:** Donetsk, Luhansk, Sievierodonetsk, Trablus Uluslararası, Gazze Yasir Arafat OurAirports'ta `closed` ve kodsuz; Hudeyde (OYHD) ve Hocalı (UB13) IATA kodsuz; Ternopil, Sumy, Kramatorsk, Kropyvnytskyi, Lutsk, Kerç `small_airport`. Listeye girmeleri için veri düzeltme tablosu gerekir; önerilmez.
7. **İran ve Körfez:** 2026-02-28 ABD/İsrail-İran savaşı İran ve Körfez havalimanlarını kapattı; İran hava sahası 2026-04/05'te, BAE 2026-05-02'de, Kuveyt 2026-04-24'te yeniden açıldı. EASA CZIB-2026-04-R2 (İran) 2026-11-16'ya kadar geçerli ama havalimanları çalışıyor: not önerilmez.

### Uygulama için notlar (sonraki adım)

- Listeye eklemek için kural değişir: `isForeignCandidate` (shared) ve `isForeignCandidateRow` (db) tarifeli olmayı şart koşar; eklenecekler küratörlü bir tabloyla (ICAO → kapanış) aday sayılmalı. Üretim veritabanı bu satırları zaten tutar (`isImportedAirport` büyük/orta her satırı alır): migration gerekmez.
- Fixture: 406 satırın hiçbiri `tools/fixtures/ourairports`'ta değil; `scripts/make-reference-fixtures.mts` adayları `scheduled_service = yes` ile seçer. Eklenecekler ayrı bir blok olarak dosyanın sonuna eklenmeli (önceki satırların sırası değişmesin), pistleriyle.
- Ad tabloları (`foreign-airport-names*.ts`), saat dilimi ve ülke adı yerleşimi yeni pinleri gerektirir. Eklenen her havalimanı listedeki toplamı değiştirir (25 eklenirse 1.242).
- Not metni `formatSinceYear` ile yıl ekini üretir (2015’ten, 2023’ten, 2025’ten, 2026’dan); D-090 kayıtları gibi `since` tarihi taşır.

## Listelenen ve çatışma bölgesinde olanlar

LISTED_CONFLICT_AREA_OK satırlarındaki "open" bu sayımda ayrıca araştırılmadı (İran, Beyrut, Hartum hariç); "not verified" durumu bilinmeyenlerdir.

| Sınıf | Ülke | ICAO | IATA | Ad | Halka | km | D-090 | Kapanış | Not |
|---|---|---|---|---|---|---|---|---|---|
| LISTED_CONFLICT_AREA_OK | AF | OAHR | HEA | Herat - Khwaja Abdullah Ansari International Airport | 3 | 1660 |  |  | Afghanistan: open |
| LISTED_CONFLICT_AREA_OK | AF | OAMS | MZR | Mazar-i-Sharif International Airport | 4 | 2034 |  |  | Afghanistan: open |
| LISTED_CONFLICT_AREA_OK | AF | OAKN | KDH | Ahmad Shah Baba International Airport | 4 | 2085 |  |  | Afghanistan: open |
| LISTED_CONFLICT_AREA_OK | AF | OAKB | KBL | Kabul International Airport | 4 | 2263 |  |  | Afghanistan: open |
| LISTED_CONFLICT_AREA_OK | AF | OAKS | KHT | Khost International Airport | 4 | 2357 |  |  | Afghanistan: not verified |
| LISTED_CONFLICT_AREA_OK | CD | FZKA | BUX | Bunia Airport | 4 | 3868 |  |  | DRC Bunia: not verified |
| LISTED_CONFLICT_AREA_OK | CD | FZIC | FKI | Bangoka International Airport | 4 | 4044 |  |  | DRC Kisangani: not verified |
| LISTED_CONFLICT_AREA_OK | ET | HAAX | AXU | Axum Airport | 4 | 2482 |  |  | Ethiopia Tigray: not verified |
| LISTED_CONFLICT_AREA_OK | ET | HAMK | MQX | Mekele Alula Aba Nega Airport | 4 | 2566 |  |  | Ethiopia Tigray: open since Dec 2022 |
| LISTED_CONFLICT_AREA_OK | GE | UGSS | SUI | Vladislav Ardzinba Sukhum International Airport | 1 | 188 |  |  | Sukhumi (Abkhazia, occupied): open with Russian flights; not a closure |
| LISTED_CONFLICT_AREA_OK | IL | LLHA | HFA | Uri Michaeli Haifa International Airport | 1 | 411 |  |  | Israel: open |
| LISTED_CONFLICT_AREA_OK | IL | LLBG | TLV | Ben Gurion International Airport | 2 | 500 |  |  | Israel: open |
| LISTED_CONFLICT_AREA_OK | IL | LLER | ETM | Ramon International Airport | 2 | 747 |  |  | Israel: open |
| LISTED_CONFLICT_AREA_OK | IQ | ORER | EBL | Erbil International Airport | 1 | 148 |  |  | Iraq: open |
| LISTED_CONFLICT_AREA_OK | IQ | ORKK | KIK | Kirkuk International Airport | 1 | 232 |  |  | Iraq: open |
| LISTED_CONFLICT_AREA_OK | IQ | ORSJ | ISU | Jalal Talabani International Airport | 1 | 241 |  |  | Iraq: open |
| LISTED_CONFLICT_AREA_OK | IQ | ORBI | BGW | Baghdad International Airport / New Al Muthana Air Base | 1 | 477 |  |  | Iraq: open |
| LISTED_CONFLICT_AREA_OK | IR | OIIE | IKA | Imam Khomeini International Airport | 2 | 662 |  |  | Iran: airspace reopened Apr-May 2026 after the 2026-02-28 war; EASA CZIB-2026-04-R2 still advises against operating |
| LISTED_CONFLICT_AREA_OK | LB | OLBA | BEY | Beirut Rafic Hariri International Airport | 1 | 292 |  |  | Beirut: MEA operating in Sept 2026 despite EASA CZIB-2026-06 |
| LISTED_CONFLICT_AREA_OK | LY | HLLQ | LAQ | Al Abraq International Airport | 2 | 711 |  |  | Libya: not verified |
| LISTED_CONFLICT_AREA_OK | LY | HLLB | BEN | Benina International Airport | 2 | 879 |  |  | Libya: open |
| LISTED_CONFLICT_AREA_OK | LY | HLLM | MJI | Mitiga International Airport | 3 | 1386 |  |  | Libya: open |
| LISTED_CONFLICT_AREA_OK | LY | HLKF | AKF | Kufra Airport | 3 | 1489 |  |  | Libya: not verified |
| LISTED_CONFLICT_AREA_OK | LY | HLLS | SEB | Sabha Airport | 3 | 1676 |  |  | Libya: not verified |
| LISTED_CONFLICT_AREA_OK | LY | HLTD | LTD | Ghadames Airport | 3 | 1832 |  |  | Libya: not verified |
| LISTED_CONFLICT_AREA_OK | SD | HSPN | PZU | Port Sudan New International Airport | 3 | 1884 |  |  | Sudan: open (main hub) |
| LISTED_CONFLICT_AREA_OK | SD | HSDN | DOG | Dongola Airport | 3 | 1915 |  |  | Sudan: not verified |
| LISTED_CONFLICT_AREA_OK | SD | HSKA | KSL | Kassala Airport | 4 | 2332 |  |  | Sudan: not verified |
| LISTED_CONFLICT_AREA_OK | SO | HCMF | BSA | Bender Qassim International Airport | 4 | 2962 |  |  | Somalia: not verified |
| LISTED_CONFLICT_AREA_OK | SO | HCMI | BBO | Berbera Airport | 4 | 3014 |  |  | Somaliland: not verified |
| LISTED_CONFLICT_AREA_OK | SO | HCMH | HGA | Egal International Airport | 4 | 3087 |  |  | Somaliland: open |
| LISTED_CONFLICT_AREA_OK | SO | HCMM | MGQ | Aden Adde International Airport | 4 | 3930 |  |  | Somalia: open |
| LISTED_CONFLICT_AREA_OK | SS | HSSM | MAK | Malakal International Airport | 4 | 2974 |  |  | Malakal: Badr suspended over runway condition (not war) |
| LISTED_CONFLICT_AREA_OK | SS | HSWW | WUU | Wau Airport | 4 | 3207 |  |  | South Sudan: not verified |
| LISTED_CONFLICT_AREA_OK | SS | HJJJ | JUB | Juba International Airport | 4 | 3495 |  |  | South Sudan: open |
| LISTED_CONFLICT_AREA_OK | SY | OSKL | KAC | Qamishli International Airport | 1 | 55 |  |  | Syria (Qamishli): not verified |
| LISTED_CONFLICT_AREA_OK | SY | OSAP | ALP | Aleppo International Airport | 1 | 87 |  |  | Syria: open |
| LISTED_CONFLICT_AREA_OK | SY | OSLK | LTK | Latakia International Airport | 1 | 111 |  |  | Syria: open |
| LISTED_CONFLICT_AREA_OK | SY | OSDI | DAM | Damascus International Airport | 1 | 329 |  |  | Syria: open |
| LISTED_CONFLICT_AREA_OK | YE | OYSY | GXF | Seiyun Hadhramaut International Airport | 4 | 2441 |  |  | Yemen: open |
| LISTED_CONFLICT_AREA_OK | YE | OYGD | AAY | Al Ghaydah International Airport | 4 | 2499 |  |  | Yemen: open |
| LISTED_CONFLICT_AREA_OK | YE | OYRN | RIY | Riyan International Airport | 4 | 2595 |  |  | Yemen: open |
| LISTED_CONFLICT_AREA_OK | YE | OYAA | ADE | Aden International Airport | 4 | 2744 |  |  | Yemen: open |
| LISTED_CONFLICT_AREA_OK | YE | OYSQ | SCT | Socotra Airport | 4 | 2932 |  |  | Yemen: open |
| LISTED_NEEDS_NOTE | CD | FZNA | GOM | Goma International Airport | 4 | 4233 |  | 2025-01-27 | Closed since late Jan 2025 (M23 capture); only a MONUSCO landing 2026-02-12; no commercial reopening found |
| LISTED_NEEDS_NOTE | SD | HSFS | ELF | El Fasher Airport | 4 | 2591 |  | 2023-04-15 | El Fasher besieged 2024-25, fell to RSF late Oct 2025; commercial flights suspended |
| LISTED_NEEDS_NOTE | SD | HSNN | UYL | Nyala Airport | 4 | 2769 |  | 2023-04-15 | Non-operational for civil flights since 2023-04 (RSF control, military cargo, SAF strikes 2024-2026) |
| LISTED_NEEDS_NOTE | YE | OYTZ | TAI | Taiz International Airport | 4 | 2640 |  | 2015-10 | Out of service since Oct 2015 (CAMA Yemen, 2021); 2026 Taiz-governorate flights use the new Mokha airport, not OYTZ |
| LISTED_NOTE_KEEP | RU | UUOO | VOZ | Voronezh International Airport | 3 | 1134 | evet | 2022-02-24 | D-090 note still correct: Voronezh closed (Kommersant 2026-03-30; 2026-01-06 list) |
| LISTED_NOTE_STALE | RU | URKG | GDZ | Gelendzhik Airport | 1 | 371 | evet | 2022-02-24 | REOPENED July 2025 (Rosaviatsiya), first Aeroflot flight 2025-07-18; D-090 note now wrong |
| LISTED_NOTE_STALE | RU | URKK | KRR | Krasnodar Pashkovsky International Airport | 1 | 450 | evet | 2022-02-24 | REOPENED 2025-09-11 09:00 MSK (Mintrans), Aeroflot from 2025-09-17; D-090 note now wrong |
| LISTED_NOTE_STALE | RU | URWI | ESL | Elista Airport | 2 | 642 | evet | 2022-02-24 | REOPENED 2024-05-03 (Rosaviatsiya), first flight 2024-05-28; D-090 note now wrong |
| LISTED_PLAUSIBLE_NOTE | ML | GAGO | GAQ | Gao International Airport | 4 | 3574 |  | 2026-04-28 | Sky Mali suspended Bamako-Gao 2026-04-28 (JNIM/FLA offensive); resumption not found |
| LISTED_PLAUSIBLE_NOTE | ML | GATB | TOM | Tombouktou Airport | 4 | 3765 |  | 2023-09-11 | Sky Mali (only carrier) suspended Timbuktu 2023-09-11 until further notice; resumption not verified |
| LISTED_PLAUSIBLE_NOTE | ML | GAMB | MZI | Mopti Airport | 4 | 4019 |  | 2026-04-28 | Sky Mali suspended Bamako-Mopti 2026-04-28; resumption not found |
| LISTED_PLAUSIBLE_NOTE | SD | HSOB | EBD | El-Obeid Airport | 4 | 2582 |  | 2023-04-15 | No evidence of commercial service since 2023 (Badr route terminated); needs an official source |
| LISTED_PLAUSIBLE_NOTE | YE | OYSN | SAH | Sanaa International Airport | 4 | 2443 |  | 2026-07-13 | Runway bombed 2026-07-13 (Yemeni gov.), UNHAS halted since; Israeli strikes 2025; Royal Jordanian plan (2026-07-17) not started; volatile |
| LISTED_REOPENED_NO_NOTE | SD | HSSK | KRT | Khartoum International Airport | 4 | 2303 |  |  | Closed 2023-04-15; domestic 2025-10-22 (Badr), Sudan Airways 2026-02-01, full reopening 2026-03-28, intl from 2026-04-28; drone-attack interruptions |

## Listelenmeyen adaylar: savaş ve çatışma

### WAR_CLOSED_CONFIRMED

| Ülke | ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Kapanış | Not |
|---|---|---|---|---|---|---|---|---|---|---|
| CD | FZMA | BKY | Bukavu Kavumu Airport | Kamakombe | 4 | 4308 | medium | no | 2025-02-14 | M23 seized Kavumu 2025-02-14; airport effectively closed; pre-war domestic service (verify) |
| RU | URKA | AAQ | Anapa Vityazevo Airport | Krasnyi Kurgan | 1 | 379 | medium | no | 2022-02-24 | Rosaviatsiya restriction since 2022-02-24; still closed in the 2026-01-06 list (8 airports incl. Simferopol); already in CIVIL_FLIGHT_CLOSURES (D-090) |
| RU | URRP | ROV | Platov International Airport | Rostov-on-Don | 2 | 706 | large | no | 2022-02-24 | Rosaviatsiya restriction since 2022-02-24; still closed in the 2026-01-06 list (8 airports incl. Simferopol); already in CIVIL_FLIGHT_CLOSURES (D-090); Platov still closed Sept 2026 |
| RU | UUOB | EGO | Belgorod International Airport | Belgorod | 2 | 966 | medium | no | 2022-02-24 | Rosaviatsiya restriction since 2022-02-24; still closed in the 2026-01-06 list (8 airports incl. Simferopol); already in CIVIL_FLIGHT_CLOSURES (D-090) |
| RU | UUOK | URS | Kursk East Airport | Kursk | 3 | 1086 | medium | no | 2022-02-24 | Rosaviatsiya restriction since 2022-02-24; still closed in the 2026-01-06 list (8 airports incl. Simferopol); already in CIVIL_FLIGHT_CLOSURES (D-090) |
| RU | UUOL | LPK | Lipetsk Airport | Lipetsk | 3 | 1234 | medium | no | 2022-02-24 | Rosaviatsiya restriction since 2022-02-24; still closed in the 2026-01-06 list (8 airports incl. Simferopol); already in CIVIL_FLIGHT_CLOSURES (D-090) |
| RU | UUBP | BZK | Bryansk International Airport | Bryansk | 3 | 1247 | medium | no | 2022-02-24 | Rosaviatsiya restriction since 2022-02-24; still closed in the 2026-01-06 list (8 airports incl. Simferopol); already in CIVIL_FLIGHT_CLOSURES (D-090) |
| UA | UKFF | SIP | Simferopol International Airport | Simferopol | 1 | 349 | large | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes; Crimea; also Rosaviatsiya-closed since 2022-02-24 (still closed 2026-01); OurAirports codes it UA |
| UA | UKOH | KHE | Kherson International Airport | Kherson | 2 | 557 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes; destroyed/occupied 2022 (Wikipedia list) |
| UA | UKOO | ODS | Odesa International Airport | Odesa | 2 | 559 | large | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKCM | MPW | Mariupol International Airport | Mariupol | 2 | 593 | medium | no | 2014 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: no/limited; closed since 2014 (Donbas war), occupied 2022 |
| UA | UKON | NLV | Mykolaiv International Airport [CLOSED] | Mykolaiv | 2 | 613 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes; OurAirports name carries [CLOSED] |
| UA | UKDE | OZH | Zaporizhzhia International Airport | Zaporizhia | 2 | 651 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKDR | KWG | Kryvyi Rih International Airport | Kryvyi Rih | 2 | 686 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKDD | DNK | Dnipro International Airport | Dnipro | 2 | 705 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes; destroyed in 2022 (Wikipedia list) |
| UA | UKLN | CWC | Chernivtsi International Airport | Chernivtsi | 2 | 806 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKKE | CKC | Cherkasy International Airport | Cherkasy | 2 | 856 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKHH | HRK | Kharkiv International Airport | Kharkiv | 2 | 884 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKWW | VIN | Vinnytsia/Gavyryshivka International Airport | Vinnitsa | 2 | 886 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKLI | IFO | Ivano-Frankivsk International Airport | Ivano-Frankivsk | 2 | 898 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKLU | UDJ | Uzhhorod International Airport | Uzhhorod | 2 | 945 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKBB | KBP | Boryspil International Airport | Boryspil | 2 | 980 | large | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKKK | IEV | Igor Sikorsky Kyiv International Airport (Zhuliany) | Kyiv | 2 | 997 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKLL | LWO | Lviv International Airport | Lviv | 3 | 1012 | large | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |
| UA | UKLR | RWN | Rivne International Airport | Rivne | 3 | 1057 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: yes |

### WAR_CLOSED_PLAUSIBLE

| Ülke | ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Kapanış | Not |
|---|---|---|---|---|---|---|---|---|---|---|
| SD | HSMN | MWE | Merowe Airport | Merowe | 3 | 1986 | medium | no | 2023-04-15 | Sudan war: RSF seized Merowe 2023-04, later SAF; drone strikes; no evidence of resumed scheduled service found |
| UA | UKFB | UKS | Sevastopol International Airport / Belbek Air Base | Sevastopol | 1 | 321 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: no/limited; Belbek Air Base, military-dominant; de facto Russian since 2014 |
| UA | UKDB | ERD | Berdyansk Airport | Berdyansk | 2 | 550 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: no/limited; occupied since 2022; no regular service pre-war (verify) |
| UA | UKHP | PLV | Suprunovka Airport | Poltava | 2 | 841 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: no/limited; no regular service pre-war (verify) |
| UA | UKLH | HMJ | Khmelnytskyi Airport | Khmelnytskyi | 2 | 910 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: no/limited; no regular service pre-war (verify) |
| UA | UKKV | ZTR | Zhytomyr Airport | Zhytomyr | 3 | 1000 | medium | no | 2022-02-24 | Ukraine closed its airspace to civil flights 2022-02-24; EASA CZIB-2022-01R14 (valid to 2027-01-31): do not operate incl. landing/departure. Pre-war civil service: no/limited; no regular service pre-war (verify) |

### REOPENED_DATA_LAG

| Ülke | ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Kapanış | Not |
|---|---|---|---|---|---|---|---|---|---|---|
| IL | LLIB | RPN | Rosh Pina Airport | Rosh Pina | 1 | 381 | medium | no |  | Closed over a year in the 2023- war, reopened 2025-01-09; no scheduled service per OurAirports |
| IQ | ORBM | OSM | Mosul International Airport | Mosul | 1 | 153 | large | no |  | Closed 2014 (ISIS); domestic flights since 2025-11-06, first intl 2026-01-26; CAA certification still pending (2026-06-10) |
| LY | HLGD | SRX | Sirt International Airport / Ghardabiya Airbase | Sirt | 3 | 1222 | large | no |  | Closed 2013-2025 (Libya wars); reopened 2025-10-25 (MedSky, Buraq, Berniq); OurAirports flag still no |
| SY | OSDZ | DEZ | Deir ez-Zor Airport | Deir ez-Zor | 1 | 219 | medium | no |  | Closed 2012-2026 (Syrian civil war); reopened 2026-08-05/06 (Syrian Air to DAM and KWI, Jazeera to KWI); OurAirports flag still no |

### CONFLICT_UNCERTAIN

| Ülke | ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Kapanış | Not |
|---|---|---|---|---|---|---|---|---|---|---|
| AF | OAMN | MMZ | Maymana Zahiraddin Faryabi Airport | Maymana | 3 | 1834 | medium | no |  | Afghanistan; not a verified war closure |
| AF | OAUZ | UND | Kunduz Airport | Kunduz | 4 | 2184 | medium | no |  | Afghanistan; not a verified war closure |
| AF | OAJL | JAA | Jalalabad Airport | Jalalabad | 4 | 2381 | medium | no |  | Afghanistan; not a verified war closure |
| CM | FKKV | BPC | Bamenda Airport | Bamenda | 4 | 3889 | medium | no | 2020 | Cameroon Anglophone crisis: aircraft shot at 2019-12-01, ops suspended 2020; rehabilitated for the papal visit 2026-04-16; regular service not verified |
| CM | FKKC | TKC | Tiko Airport | Tiko | 4 | 4122 | medium | no |  | Cameroon SW region (Anglophone crisis) |
| LY | HLGT | GHT | Ghat Airport | Ghat | 4 | 2129 | medium | no |  | Libya (Ghat); status not verified |
| RU | XRRT | TGK | Taganrog Yuzhny Airport | Taganrog | 2 | 649 | medium | no |  | Taganrog Yuzhny: inside the restricted south but not one of the 11 Rosaviatsiya airports; civil service pre-2022 not verified |
| SY | OSPR | PMS | Palmyra Airport | Tadmur | 1 | 272 | medium | no |  | Palmyra: war-damaged, mostly military; civil service not verified |
| YE | OYAT | AXK | Ataq Airport | Ataq | 4 | 2570 | medium | no |  | Yemen (Shabwa); no evidence of a war-specific closure found |

### RULE_EXCLUDED (bilgi)

| Ülke | Kimlik | IATA | Ad | Neden |
|---|---|---|---|---|
| UA | UA-9862 | DOK | Donetsk Sergei Prokofiev | closed, kodlar silinmiş (2014-15'te yıkıldı) |
| UA | UA-9863 | VSG | Luhansk | closed, kodlar silinmiş |
| UA | UA-9866 | SEV | Sievierodonetsk | closed |
| UA | UKLT, UKHS, UKCK, UKKG, UKLC, UKFK | TNL, UMY, KRQ, KGO, UCK, KHC | Ternopil, Sumy, Kramatorsk, Kropyvnytskyi, Lutsk, Kerç | small_airport (kural büyük/orta ister); 2022'den beri kapalı |
| UA | UKKM | — | Hostomel | IATA yok; 2022'de yıkıldı |
| LY | LY-0019 | TIP | Trablus Uluslararası | closed (2014) |
| PS | PS-0006 | GZA | Yasir Arafat (Gazze) | closed (2001-02) |
| YE | OYHD | HOD | Hudeyde | IATA yok; 2015'ten beri sivil kapalı |
| AZ | UB13 | — | Hocalı (Stepanakert) | IATA yok; hiç sivil hizmete girmedi |

## Ülke ülke bütün listelenmeyen adaylar (406)

#### AE — Birleşik Arap Emirlikleri (4)

diğer (bölgesel, genel havacılık, mevsimlik): 2 · askerî / ortak: 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| OMBY | XSB | Sir Bani Yas Airport | Sir Bani Yas | 3 | 1674 | medium | no | OTHER |
| OMDM | NHD | Al Minhad Air Base | Dubai | 3 | 1746 | medium | no | MILITARY |
| OMAD | AZI | Al Bateen Executive Airport | Abu Dhabi | 3 | 1752 | large | no | OTHER |
| OMAM | DHF | Al Dhafra Air Base |  | 3 | 1774 | medium | no | MILITARY |

#### AF — Afganistan (4)

çatışma bölgesi, kapanış doğrulanamadı: 3 · askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| OAMN | MMZ | Maymana Zahiraddin Faryabi Airport | Maymana | 3 | 1834 | medium | no | CONFLICT_UNCERTAIN |
| OAUZ | UND | Kunduz Airport | Kunduz | 4 | 2184 | medium | no | CONFLICT_UNCERTAIN |
| OAIX | OAI | Bagram Airfield | Bagram | 4 | 2256 | medium | no | MILITARY |
| OAJL | JAA | Jalalabad Airport | Jalalabad | 4 | 2381 | medium | no | CONFLICT_UNCERTAIN |

#### AL — Arnavutluk (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LAKU | KFZ | Kukës International Airport | Kukës | 2 | 501 | medium | no | OTHER |

#### AZ — Azerbaycan (2)

diğer (bölgesel, genel havacılık, mevsimlik): 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| UBBY | ZTU | Zaqatala International Airport | Zaqatala | 1 | 294 | medium | no | OTHER |
| UBTT | ZXT | Zabrat Airport | Zabrat | 2 | 521 | medium | no | OTHER |

#### BD — Bangladeş (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| VGIS | IRD | Ishurdi Airport | Ishurdi | 4 | 4482 | medium | no | OTHER |

#### BE — Belçika (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| EBKT | KJK | Kortrijk-Wevelgem International Airport | Wevelgem | 4 | 2111 | medium | no | OTHER |

#### BG — Bulgaristan (2)

askerî / ortak: 1 · diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LBIA | JAM | Bezmer Air Base | Bezmer | 1 | 196 | medium | no | MILITARY |
| LBGO | GOZ | Gorna Oryahovitsa Airport | Gorna Oryahovitsa | 1 | 288 | medium | no | OTHER |

#### BT — Butan (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| VQGP | GLU | Gelephu Airport | Gelephu | 4 | 4460 | medium | no | OTHER |

#### BY — Belarus (3)

diğer (bölgesel, genel havacılık, mevsimlik): 2 · askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| UMMG | GNA | Hrodna Airport | Hrodna | 3 | 1414 | medium | no | OTHER |
| UMIO | TXC | Orsha Airport - Balbasovo Air Base | Orsha | 3 | 1425 | medium | no | MILITARY |
| UMII | VTB | Vitebsk Vostochny Airport | Vitebsk | 3 | 1498 | medium | no | OTHER |

#### CD — Kongo Demokratik Cumhuriyeti (4)

diğer (bölgesel, genel havacılık, mevsimlik): 3 · savaş: kapalı (kaynakla): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| FZKJ | BZU | Buta Zega Airport | Buta | 4 | 3791 | medium | no | OTHER |
| FZGA | LIQ | Lisala Airport | Lisala | 4 | 3913 | medium | no | OTHER |
| FZMA | BKY | Bukavu Kavumu Airport | Kamakombe | 4 | 4308 | medium | no | WAR_CLOSED_CONFIRMED |
| FZAB | NLO | Ndolo Airport | N'dolo | 4 | 4773 | medium | no | OTHER |

#### CF — Orta Afrika Cumhuriyeti (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| FEFT | BBT | Berbérati Airport | Berbérati | 4 | 3849 | medium | no | OTHER |

#### CG — Kongo Cumhuriyeti (4)

diğer (bölgesel, genel havacılık, mevsimlik): 4

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| FCOU | OUE | Ouesso Airport |  | 4 | 4117 | medium | no | OTHER |
| FCOO | FTX | Owando Airport | Owando | 4 | 4348 | medium | no | OTHER |
| FCOD | OLL | Oyo Ollombo Airport | Oyo | 4 | 4424 | medium | no | OTHER |
| FCPD | DIS | Ngot Nzoungou Airport | Dolisie | 4 | 4848 | medium | no | OTHER |

#### CH — İsviçre (4)

diğer (bölgesel, genel havacılık, mevsimlik): 2 · askerî / ortak: 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LSZS | SMV | Engadin Airport | Samedan | 3 | 1468 | medium | no | OTHER |
| LSME | EML | Emmen Air Base | Emmen | 3 | 1603 | medium | no | MILITARY |
| LSGS | SIR | Sion Airport | Sion | 3 | 1641 | medium | no | OTHER |
| LSMP | VIP | Payerne Air Base | Payerne | 3 | 1692 | medium | no | MILITARY |

#### CI — Fildişi Sahili (3)

diğer (bölgesel, genel havacılık, mevsimlik): 3

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| DIYO | ASK | Yamoussoukro International Airport | Yamoussoukro | 4 | 4738 | large | no | OTHER |
| DIDL | DJO | Daloa Airport |  | 4 | 4826 | medium | no | OTHER |
| DIMN | MJC | Man Airport |  | 4 | 4867 | medium | no | OTHER |

#### CM — Kamerun (5)

çatışma bölgesi, kapanış doğrulanamadı: 2 · diğer (bölgesel, genel havacılık, mevsimlik): 3

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| FKKV | BPC | Bamenda Airport | Bamenda | 4 | 3889 | medium | no | CONFLICT_UNCERTAIN |
| FKKM | FOM | Foumban Nkounja Airport | Foumban | 4 | 3902 | medium | no | OTHER |
| FKKU | BFX | Bafoussam Airport | Bafoussam | 4 | 3930 | medium | no | OTHER |
| FKKY | YAO | Yaoundé Ville Airport | Yaoundé | 4 | 4053 | medium | no | OTHER |
| FKKC | TKC | Tiko Airport | Tiko | 4 | 4122 | medium | no | CONFLICT_UNCERTAIN |

#### CN — Çin (4)

diğer (bölgesel, genel havacılık, mevsimlik): 4

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| ZUPL | APJ | Ali Pulan Airport | Burang Town | 4 | 3470 | medium | no | OTHER |
| ZWSS | SXJ | Shanshan Airport | Shanshan | 4 | 3830 | medium | no | OTHER |
| ZWLK | DHH | Barkol Dahe Airport | Barkol | 4 | 4040 | medium | no | OTHER |
| ZLHN | HNG | Hainanzhou Gonghe Airport | Hainan (Gonghe) | 4 | 4882 | medium | no | OTHER |

#### CY — Kıbrıs (2)

askerî / ortak: 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LCGK | GEC | Geçitkale Airbase | Lefkoniko (Geçitkale) | 1 | 175 | medium | no | MILITARY |
| LCRA | AKT | RAF Akrotiri | Akrotiri | 1 | 200 | medium | no | MILITARY |

#### CZ — Çekya (3)

diğer (bölgesel, genel havacılık, mevsimlik): 2 · askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LKKU | UHE | Kunovice Airport | Uherské Hradiště | 3 | 1186 | medium | no | OTHER |
| LKPO | PRV | Přerov Air Base | Přerov | 3 | 1222 | medium | no | MILITARY |
| LKVO | VOD | Vodochody Airport | Vodochody | 3 | 1428 | medium | no | OTHER |

#### DE — Almanya (21)

diğer (bölgesel, genel havacılık, mevsimlik): 14 · askerî / ortak: 7

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| EDMO | OBF | Oberpfaffenhofen Airport | Weßling | 3 | 1453 | medium | no | OTHER |
| ETSI | IGS | Ingolstadt Manching Airport | Manching | 3 | 1476 | medium | no | MILITARY |
| EDMA | AGB | Augsburg Airport | Augsburg | 3 | 1496 | medium | no | OTHER |
| EDQD | BYU | Bayreuth Airport | Bindlach | 3 | 1555 | medium | no | OTHER |
| EDQM | HOQ | Hof-Plauen Airport | Hof | 3 | 1565 | medium | no | OTHER |
| EDAC | AOC | Leipzig–Altenburg Airport | Nobitz | 3 | 1582 | medium | no | OTHER |
| EDGE | EIB | Eisenach-Kindel Airport | Hörselberg-Hainich | 3 | 1689 | medium | no | OTHER |
| EDTL | LHA | Lahr Airport | Lahr/Schwarzwald | 3 | 1694 | medium | no | OTHER |
| ETOU | WIE | Wiesbaden Army Airfield | Wiesbaden | 3 | 1752 | medium | no | MILITARY |
| ETAR | RMS | Ramstein Air Base | Ramstein-Miesenbach | 3 | 1763 | medium | no | MILITARY |
| ETHF | FRZ | Fritzlar Army Airfield | Fritzlar | 3 | 1763 | medium | no | MILITARY |
| EDBN | FNB | Neubrandenburg Trollenhagen Airport | Trollenhagen | 3 | 1763 | medium | no | OTHER |
| EDVE | BWE | Braunschweig-Wolfsburg Airport | Braunschweig | 3 | 1782 | medium | no | OTHER |
| EDGS | SGE | Siegerland Airport | Burbach | 3 | 1806 | medium | no | OTHER |
| ETAD | SPM | Spangdahlem Air Base | Trier | 3 | 1848 | medium | no | MILITARY |
| EDLI | BFE | Bielefeld Airport | Bielefeld | 3 | 1861 | medium | no | OTHER |
| EDHI | XFW | Hamburg-Finkenwerder Airport | Hamburg | 3 | 1911 | medium | no | OTHER |
| EDLN | MGL | Mönchengladbach Airport | Mönchengladbach | 3 | 1930 | medium | no | OTHER |
| ETNG | GKE | Geilenkirchen Air Base | Geilenkirchen | 3 | 1943 | medium | no | MILITARY |
| EDHK | KEL | Kiel-Holtenau Airport | Kiel | 3 | 1964 | medium | no | OTHER |
| ETNS | WBG | Schleswig Air Base | Jagel | 3 | 1998 | medium | no | MILITARY |

#### DK — Danimarka (6)

diğer (bölgesel, genel havacılık, mevsimlik): 5 · askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| EKMB | MRW | Lolland Falster Maribo Airport | Rødby | 3 | 1935 | medium | no | OTHER |
| EKSP | SKS | Skrydstrup Air Base | Vojens | 4 | 2070 | medium | no | MILITARY |
| EKVJ | STA | Stauning Vestjylland  Airport | Skjern | 4 | 2172 | medium | no | OTHER |
| EKSV | SQW | Skive Airport | Skive | 4 | 2180 | medium | no | OTHER |
| EKSN | CNL | Sindal Airport | Sindal | 4 | 2212 | medium | no | OTHER |
| EKTS | TED | Thisted Airport | Thisted | 4 | 2241 | medium | no | OTHER |

#### DZ — Cezayir (5)

diğer (bölgesel, genel havacılık, mevsimlik): 5

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| DAAD | BUJ | Bou Saada Airport | Ouled Sidi Brahim | 3 | 1975 | medium | no | OTHER |
| DAFH | HRM | Hassi R'Mel Airport | Hassi R'Mel | 4 | 2164 | medium | no | OTHER |
| DAOB | TID | Abdelhafid Boussouf Bou Chekif Airport | Tiaret | 4 | 2206 | medium | no | OTHER |
| DAOV | MUW | Ghriss Airport | Ghriss | 4 | 2322 | medium | no | OTHER |
| DAOL | TAF | Oran Tafraoui Airport | Tafraoui | 4 | 2366 | medium | no | OTHER |

#### EG — Mısır (4)

diğer (bölgesel, genel havacılık, mevsimlik): 3 · askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| HEGR | EGH | El Jora Airport | El Jora | 2 | 605 | medium | no | OTHER |
| HE36 | RDL | Bardawil International Airport | El Hassana | 2 | 660 | medium | no | OTHER |
| HESC | SKV | Saint Catherine International Airport | Saint Catherine | 2 | 863 | medium | no | OTHER |
| HEBR | EES | Berenice International Airport / Banas Cape Air Base | Berenice Troglodytica | 3 | 1379 | large | no | MILITARY |

#### ER — Eritre (2)

diğer (bölgesel, genel havacılık, mevsimlik): 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| HHMS | MSW | Massawa International Airport | Massawa | 4 | 2321 | medium | no | OTHER |
| HHSB | ASA | Assab International Airport | Assab | 4 | 2666 | medium | no | OTHER |

#### ES — İspanya (7)

diğer (bölgesel, genel havacılık, mevsimlik): 3 · askerî / ortak: 4

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LETL | TEV | Teruel Airport | Teruel | 4 | 2289 | medium | no | OTHER |
| LEAB | ABC | Albacete Airport / Los Llanos Air Base | Albacete | 4 | 2372 | medium | no | MILITARY |
| LEBG | RGS | Burgos Airport | Burgos | 4 | 2465 | medium | no | OTHER |
| LETO | TOJ | Madrid–Torrejón Airport / Torrejón Air Base | Madrid | 4 | 2475 | medium | no | MILITARY |
| LERL | CQM | Ciudad Real International Airport | Ciudad Real | 4 | 2553 | medium | no | OTHER |
| LEMO | OZP | Moron Air Base | Morón | 4 | 2740 | medium | no | MILITARY |
| LERT | ROZ | Rota Naval Station Airport | Rota | 4 | 2820 | medium | no | MILITARY |

#### ET — Etiyopya (1)

askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| HAHM | QHR | Harar Meda Airport | Debre Zeyit | 4 | 3086 | medium | no | MILITARY |

#### FI — Finlandiya (10)

askerî / ortak: 1 · diğer (bölgesel, genel havacılık, mevsimlik): 9

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| EFUT | UTI | Utti Air Base | Utti / Valkeala | 4 | 2170 | medium | no | MILITARY |
| EFMI | MIK | Mikkeli Airport | Mikkeli | 4 | 2249 | medium | no | OTHER |
| EFIT | KTQ | Kitee Airport | Kitee | 4 | 2265 | medium | no | OTHER |
| EFVR | VRK | Varkaus Airport | Varkaus / Joroinen | 4 | 2291 | medium | no | OTHER |
| EFHA | KEV | Halli Airport | Jämsä | 4 | 2304 | medium | no | OTHER |
| EFKJ | KHJ | Kauhajoki Airfield | Kauhajoki | 4 | 2393 | medium | no | OTHER |
| EFSI | SJY | Seinäjoki Airport | Seinäjoki / Ilmajoki | 4 | 2413 | medium | no | OTHER |
| EFKA | KAU | Kauhava Airfield | Kauhava | 4 | 2458 | medium | no | OTHER |
| EFYL | YLI | Ylivieska Airfield | Ylivieska | 4 | 2539 | medium | no | OTHER |
| EFSO | SOT | Sodankyla Airport | Sodankyla | 4 | 2868 | medium | no | OTHER |

#### FR — Fransa (56)

askerî / ortak: 7 · diğer (bölgesel, genel havacılık, mevsimlik): 49

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LFKS | SOZ | Solenzara (BA 126) Air Base | Solenzara | 3 | 1392 | medium | no | MILITARY |
| LFMD | CEQ | Cannes Mandelieu Airport | Cannes | 3 | 1607 | medium | no | OTHER |
| LFMQ | CTT | Le Castellet Airport | Le Castellet, Var | 3 | 1698 | medium | no | OTHER |
| LFGA | CMR | Colmar Houssen airport | Colmar | 3 | 1713 | medium | no | OTHER |
| LFLU | VAF | Valence-Chabeuil Airport | Chabeuil, Drôme | 3 | 1785 | medium | no | OTHER |
| LFLY | LYN | Lyon Bron Airport | Chassieu, Lyon | 3 | 1805 | medium | no | OTHER |
| LFSG | EPL | Épinal Mirecourt Airport | Épinal | 3 | 1810 | medium | no | OTHER |
| LFSN | ENC | Nancy-Essey Airport | Tomblaine, Meurthe-et-Moselle | 3 | 1815 | medium | no | OTHER |
| LFHO | OBS | Aubenas-South Ardèche Airport | Lanas, Ardèche | 3 | 1826 | medium | no | OTHER |
| LFSD | DIJ | Dijon Longvic airport | Dijon | 3 | 1838 | medium | no | OTHER |
| LFMH | EBU | Saint-Étienne-Bouthéon Airport | Andrézieux-Bouthéon, Loire | 3 | 1850 | medium | no | OTHER |
| LFLO | RNE | Roanne-Renaison Airport | Saint-Léger-sur-Roanne | 3 | 1884 | medium | no | OTHER |
| LFNB | MEN | Mende-Brenoux Airfield | Mende/Brénoux | 3 | 1891 | medium | no | OTHER |
| LFLN | SYT | Saint-Yan Airport | L'Hôpital-le-Mercier, Saône-et-Loire | 3 | 1892 | medium | no | OTHER |
| LFLV | VHY | Vichy-Charmeil Airport | Charmeil, Allier | 3 | 1931 | medium | no | OTHER |
| LFLA | AUF | Auxerre Branches airport | Auxerre | 3 | 1972 | medium | no | OTHER |
| LFQG | NVS | Nevers-Fourchambault Airport | Marzy, Nièvre | 3 | 1974 | medium | no | OTHER |
| LFCI | LBI | Albi Le Sequestre airport | Albi | 3 | 1998 | medium | no | OTHER |
| LFBK | MCU | Montluçon-Guéret Airport | Lépaud, Creuse | 4 | 2011 | medium | no | OTHER |
| LFLD | BOU | Bourges airport | Bourges | 4 | 2030 | medium | no | OTHER |
| LFCC | ZAO | Cahors Lalbenque airport | Cahors | 4 | 2052 | medium | no | OTHER |
| LFLX | CHR | Châteauroux Déols airport | Châteauroux | 4 | 2073 | medium | no | OTHER |
| LFPB | LBG | Paris-Le Bourget International Airport | Paris | 4 | 2085 | large | no | OTHER |
| LFPC | CSF | Creil Air Base | Creil | 4 | 2090 | medium | no | MILITARY |
| LFPV | VIY | Vélizy-Villacoublay Air Base | Vélizy-Villacoublay, Yvelines | 4 | 2094 | medium | no | MILITARY |
| LFPN | TNF | Toussus-le-Noble Airport | Toussus-le-Noble, Yvelines | 4 | 2100 | medium | no | OTHER |
| LFBX | PGX | Périgueux-Bassillac Airport | Périgueux/Bassillac | 4 | 2113 | medium | no | OTHER |
| LFPT | POX | Pontoise-Cormeilles Aerodrome | Cormeilles-en-Vexin, Val-d'Oise | 4 | 2117 | medium | no | OTHER |
| LFBA | AGF | Agen La Garenne airport | Agen | 4 | 2121 | medium | no | OTHER |
| LFQT | HZB | Merville-Calonne Airport | Merville, Nord | 4 | 2138 | medium | no | OTHER |
| LFBU | ANG | Angoulême Brie-Champniers airport | Angoulême | 4 | 2166 | medium | no | OTHER |
| LFOE | EVX | Évreux-Fauville (BA 105) Air Base | Fauville, Eure | 4 | 2171 | medium | no | MILITARY |
| LFOP | URO | Rouen Vallée de Seine Airport | Boos | 4 | 2186 | medium | no | OTHER |
| LFAC | CQF | Calais Marck Airport | Calais | 4 | 2198 | medium | no | OTHER |
| LFAT | LTQ | Le Touquet-Côte d'Opale Airport | Le Touquet-Paris-Plage | 4 | 2200 | medium | no | OTHER |
| LFBG | CNG | Cognac-Châteaubernard (BA 709) Air Base | Cognac/Châteaubernard | 4 | 2206 | medium | no | MILITARY |
| LFRM | LME | Le Mans-Arnage Airport | Le Mans, Sarthe | 4 | 2212 | medium | no | OTHER |
| LFBN | NIT | Niort - Marais Poitevin Airport | Niort/Souché | 4 | 2222 | medium | no | OTHER |
| LFJR | ANE | Angers Marcé airport | Angers | 4 | 2240 | medium | no | OTHER |
| LFCY | RYN | Royan-Médis Airport | Royan/Médis | 4 | 2257 | medium | no | OTHER |
| LFDN | RCO | Rochefort-Saint-Agnant (BA 721) Airport | Rochefort/Saint-Agnant | 4 | 2261 | medium | no | MILITARY |
| LFOH | LEH | Le Havre-Octeville Airport | Le Havre | 4 | 2267 | medium | no | OTHER |
| LFOV | LVA | Laval-Entrammes Airport | Laval, Mayenne | 4 | 2282 | medium | no | OTHER |
| LFRI | EDM | La Roche-sur-Yon Les Ajoncs Airport | La Roche-sur-Yon | 4 | 2303 | medium | no | OTHER |
| LFRF | GFR | Granville Airport | Bréville-sur-Mer, Manche | 4 | 2363 | medium | no | OTHER |
| LFRZ | SNR | Saint-Nazaire-Montoir Airport | Saint-Nazaire/Montoir | 4 | 2371 | medium | no | OTHER |
| LFRC | CER | Cherbourg Manche airport | Cherbourg | 4 | 2378 | medium | no | OTHER |
| LFRE | LBY | La Baule-Escoublac Airport | La Baule-Escoublac | 4 | 2385 | medium | no | OTHER |
| LFRD | DNR | Dinard Pleurtuit Saint-Malo airport | Dinard | 4 | 2392 | medium | no | OTHER |
| LFRV | VNE | Vannes-Meucon Airport | Vannes/Meucon | 4 | 2420 | medium | no | OTHER |
| LFRT | SBK | Saint-Brieuc-Armor Airport | Trémuson, Côtes-d'Armor | 4 | 2447 | medium | no | OTHER |
| LFRH | LRT | Lorient South Brittany (Bretagne Sud) Airport | Lorient/Lann/Bihoué | 4 | 2474 | medium | no | OTHER |
| LFRO | LAI | Lannion Airport | Lannion | 4 | 2496 | medium | no | OTHER |
| LFRU | MXN | Morlaix-Ploujean Airport | Morlaix/Ploujean | 4 | 2518 | medium | no | OTHER |
| LFRQ | UIP | Quimper-Cornouaille Airport | Quimper/Pluguffan | 4 | 2532 | medium | no | OTHER |
| LFRJ | LDV | Landivisiau Air Base | Landivisiau | 4 | 2540 | medium | no | MILITARY |

#### GA — Gabon (6)

diğer (bölgesel, genel havacılık, mevsimlik): 6

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| FOOB | BMM | Bitam Airport | Bitam | 4 | 4236 | medium | no | OTHER |
| FOGQ | OKN | Okondja Airport | Okondja | 4 | 4439 | medium | no | OTHER |
| FOGK | KOU | Koulamoutou Mabimbi Airport | Koulamoutou | 4 | 4540 | medium | no | OTHER |
| FOGR | LBQ | Lambarene Airport | Lambarene | 4 | 4575 | medium | no | OTHER |
| FOGM | MJL | Mouilla Ville Airport | Mouila | 4 | 4662 | medium | no | OTHER |
| FOOH | OMB | Omboue Hospital Airport | Omboue | 4 | 4705 | medium | no | OTHER |

#### GB — Birleşik Krallık (32)

diğer (bölgesel, genel havacılık, mevsimlik): 18 · askerî / ortak: 14

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| EGMD | LYX | Lydd London Ashford Airport | Romney Marsh, Kent | 4 | 2263 | medium | no | OTHER |
| EGXH | BEQ | RAF Honington | Bury Saint Edmunds, Suffolk | 4 | 2336 | medium | no | MILITARY |
| EGKB | BQH | London Biggin Hill Airport | London | 4 | 2337 | medium | no | OTHER |
| EGKA | ESH | Brighton City Airport | Brighton, East Sussex | 4 | 2339 | medium | no | OTHER |
| EGUL | LKZ | RAF Lakenheath | Brandon, Suffolk | 4 | 2352 | medium | no | MILITARY |
| EGUN | MHZ | RAF Mildenhall | Bury Saint Edmunds, Suffolk | 4 | 2354 | medium | no | MILITARY |
| EGYM | KNF | RAF Marham | King's Lynn, Norfolk | 4 | 2364 | medium | no | MILITARY |
| EGSC | CBG | Cambridge City Airport | Cambridge, Cambridgeshire | 4 | 2366 | medium | no | OTHER |
| EGWU | NHT | RAF Northolt | Northolt, Greater London | 4 | 2376 | medium | no | MILITARY |
| EGLF | FAB | Farnborough Airport | Farnborough, Hampshire | 4 | 2388 | medium | no | OTHER |
| EGLK | BBS | Blackbushe Airport | Camberley, Surrey | 4 | 2394 | medium | no | OTHER |
| EGVO | ODH | RAF Odiham | Hook, Hampshire | 4 | 2397 | medium | no | MILITARY |
| EGUB | BEX | RAF Benson | Wallingford, Oxfordshire | 4 | 2422 | medium | no | MILITARY |
| EGXC | QCY | RAF Coningsby | Lincoln, Lincolnshire | 4 | 2429 | medium | no | MILITARY |
| EGTK | OXF | London Oxford Airport | Kidlington, Oxfordshire | 4 | 2445 | medium | no | OTHER |
| EGXW | WTN | RAF Waddington | Lincoln, Lincolnshire | 4 | 2454 | medium | no | MILITARY |
| EGVN | BZZ | RAF Brize Norton | Carterton, Oxfordshire | 4 | 2458 | medium | no | MILITARY |
| EGVA | FFD | RAF Fairford | Fairford, Gloucestershire | 4 | 2469 | medium | no | MILITARY |
| EGBN | NQT | Nottingham City Airport | Nottingham, Nottinghamshire | 4 | 2476 | medium | no | OTHER |
| EGDY | YEO | RNAS Yeovilton | Yeovil, Somerset | 4 | 2501 | medium | no | MILITARY |
| EGBJ | GLO | Gloucestershire Airport | Staverton, Gloucestershire | 4 | 2502 | medium | no | OTHER |
| EGNR | CEG | Hawarden Airport | Broughton | 4 | 2604 | medium | no | OTHER |
| EGFH | SWS | Swansea Airport | Swansea | 4 | 2615 | medium | no | OTHER |
| EGNO | WRT | Warton Aerodrome | Warton | 4 | 2623 | medium | no | OTHER |
| EGNH | BLK | Blackpool Airport | Blackpool | 4 | 2633 | medium | no | OTHER |
| EGNL | BWF | Barrow Walney Island Airport | Barrow-in-Furness | 4 | 2663 | medium | no | OTHER |
| EGNC | CAX | Carlisle Lake District Airport | Carlisle, Cumbria | 4 | 2673 | medium | no | OTHER |
| EGFE | HAW | Haverfordwest Airport | Haverfordwest | 4 | 2682 | medium | no | OTHER |
| EGOV | VLY | Anglesey Airport | Angelsey | 4 | 2704 | medium | no | OTHER |
| EGQL | ADX | Leuchars Station Airfield | Leuchars, Fife | 4 | 2750 | medium | no | MILITARY |
| EGQS | LMO | RAF Lossiemouth | Lossiemouth, Moray | 4 | 2847 | medium | no | MILITARY |
| EGAB | ENK | Enniskillen/St Angelo Airport | Enniskillen, Fermanagh and Omagh | 4 | 2939 | medium | no | OTHER |

#### GR — Yunanistan (1)

askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LGAD | PYR | Andravida Air Base | Andravida | 1 | 471 | medium | no | MILITARY |

#### IE — İrlanda (2)

diğer (bölgesel, genel havacılık, mevsimlik): 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| EIWF | WAT | Waterford Airport | Waterford | 4 | 2832 | medium | no | OTHER |
| EISG | SXL | Sligo Airport | Sligo | 4 | 2993 | medium | no | OTHER |

#### IL — İsrail (3)

savaştan sonra yeniden açıldı (OurAirports bayrağı eski): 1 · diğer (bölgesel, genel havacılık, mevsimlik): 1 · askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LLIB | RPN | Rosh Pina Airport | Rosh Pina | 1 | 381 | medium | no | REOPENED_DATA_LAG |
| LLMZ | MTZ | Bar Yehuda Airfield | Masada | 2 | 566 | medium | no | OTHER |
| LLNV | VTM | Nevatim Air Base | Beersheba | 2 | 585 | medium | no | MILITARY |

#### IN — Hindistan (23)

diğer (bölgesel, genel havacılık, mevsimlik): 21 · askerî / ortak: 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| VIBK | BKB | Nal Airport | Bikaner | 4 | 2891 | medium | no | OTHER |
| VIBT | BUP | Bhatinda Air Force Station |  | 4 | 2916 | medium | no | MILITARY |
| VILD | LUH | Ludhiana Airport |  | 4 | 2995 | medium | no | OTHER |
| VARK | RAJ | Rajkot Airport | Rajkot | 4 | 3051 | medium | no | OTHER |
| VIKO | KTU | Kota Airport | Kota | 4 | 3281 | medium | no | OTHER |
| VADN | NMB | Daman Airport | Daman | 4 | 3348 | medium | no | OTHER |
| VARG | RTC | Ratnagiri Airport |  | 4 | 3644 | medium | no | OTHER |
| VAAK | AKD | Akola Airport | Akola | 4 | 3669 | medium | no | OTHER |
| VASL | SSE | Solapur Airport | Solapur | 4 | 3799 | medium | no | OTHER |
| VEKI | KBK | Kushinagar International Airport | Kushinagar | 4 | 3888 | medium | no | OTHER |
| VOBR | IXX | Bidar Airport / Bidar Air Force Station | Bidar | 4 | 3901 | medium | no | MILITARY |
| VOHY | BPM | Begumpet Airport | Hyderabad | 4 | 4013 | medium | no | OTHER |
| VEMZ | MZU | Muzaffarpur Airport | Muzaffarpur | 4 | 4047 | medium | no | OTHER |
| VOBI | BEP | Bellary Airport | Bellary | 4 | 4060 | medium | no | OTHER |
| VOSH | RQY | Rashtrakavi Kuvempu Airport | Shimoga | 4 | 4066 | medium | no | OTHER |
| VOPN | PUT | Sri Sathya Sai Airport | Puttaparthi | 4 | 4208 | medium | no | OTHER |
| VERK | RRK | Rourkela Airport | Rourkela | 4 | 4224 | medium | no | OTHER |
| VEDB | DBD | Dhanbad Airport |  | 4 | 4271 | medium | no | OTHER |
| VEJS | IXW | Sonari Airport | Jamshedpur | 4 | 4308 | medium | no | OTHER |
| VOSM | SXV | Salem Airport | Salem | 4 | 4417 | medium | no | OTHER |
| VEZO | ZER | Ziro Airport | Ziro | 4 | 4721 | medium | no | OTHER |
| VEKR | IXH | Kailashahar Airport | Kailashahar | 4 | 4733 | medium | no | OTHER |
| VEAN | IXV | Along Airport |  | 4 | 4778 | medium | no | OTHER |

#### IQ — Irak (5)

savaştan sonra yeniden açıldı (OurAirports bayrağı eski): 1 · askerî / ortak: 4

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| ORBM | OSM | Mosul International Airport | Mosul | 1 | 153 | large | no | REOPENED_DATA_LAG |
| ORQW | RQW | Qayyarah West Airport | Qayyarah | 1 | 202 | medium | no | MILITARY |
| ORAA | IQA | Al Asad Air Base | Hīt | 1 | 399 | medium | no | MILITARY |
| ORAT | TQD | Al Taqaddum Air Base | Al Habbaniyah | 1 | 469 | medium | no | MILITARY |
| ORTL | XNH | Ali Air Base | Nasiriyah | 2 | 755 | medium | no | MILITARY |

#### IR — İran (20)

diğer (bölgesel, genel havacılık, mevsimlik): 19 · askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| OITU | IMQ | Maku National Airport | Showt | 1 | 126 | medium | no | OTHER |
| OITZ | JWN | Zanjan Airport | Zanjan | 1 | 375 | medium | no | OTHER |
| OIHS | NUJ | Nojeh Air Base | Amirabad | 1 | 473 | medium | no | MILITARY |
| OICI | IIL | Ilam Airport | Ilam | 1 | 482 | medium | no | OTHER |
| OIIK | GZW | Qazvin Airport | Qazvin | 2 | 537 | medium | no | OTHER |
| OIAI | QMJ | Shahid Asiyaee Airport | Masjed Soleyman | 2 | 769 | medium | no | OTHER |
| OIFS | CQD | Shahrekord Airport | Shahrekord | 2 | 838 | medium | no | OTHER |
| OING | GBT | Gorgan Airport | Gorgan | 2 | 902 | medium | no | OTHER |
| OIAG | AKW | Aghajari Airport | Omidiyeh | 2 | 907 | medium | no | OTHER |
| OISY | YES | Yasuj Airport | Yasuj | 3 | 1015 | medium | no | OTHER |
| OIMT | TCX | Tabas Airport | Tabas | 3 | 1221 | medium | no | OTHER |
| OISF | FAZ | Fasa Airport | Fasa | 3 | 1304 | medium | no | OTHER |
| OIBJ | KNR | Jam Airport | Jam | 3 | 1320 | medium | no | OTHER |
| OIKY | SYJ | Sirjan Airport | Sirjan | 3 | 1382 | medium | no | OTHER |
| OIBV | LVP | Lavan Airport | Lavan Airport | 3 | 1469 | medium | no | OTHER |
| OIMC | CKT | Sarakhs Airport | Sarakhs | 3 | 1496 | medium | no | OTHER |
| OIKJ | JYR | Jiroft Airport | Jiroft | 3 | 1587 | medium | no | OTHER |
| OIBS | SXI | Siri Airport | Siri | 3 | 1618 | medium | no | OTHER |
| OIZB | ACZ | Zabol Airport | Zabol | 3 | 1740 | medium | no | OTHER |
| OIZI | IHR | Iranshahr Airport | Iranshahr | 3 | 1921 | medium | no | OTHER |

#### IS — İzlanda (5)

diğer (bölgesel, genel havacılık, mevsimlik): 5

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| BIRL | MVA | Mývatn Airport | Myvatn | 4 | 3888 | medium | no | OTHER |
| BIHU | HZK | Húsavík Airport | Húsavík | 4 | 3921 | medium | no | OTHER |
| BIVM | VEY | Vestmannaeyjar Airport | Vestmannaeyjar | 4 | 3949 | medium | no | OTHER |
| BISI | SIJ | Siglufjörður Airport | Siglufjörður | 4 | 3991 | medium | no | OTHER |
| BIBD | BIU | Bildudalur Airport | Bildudalur | 4 | 4174 | medium | no | OTHER |

#### IT — İtalya (6)

askerî / ortak: 4 · diğer (bölgesel, genel havacılık, mevsimlik): 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LIBN | LCC | Lecce Galatina Air Base / Galatina Fortunato Cesari Airport | Galatina (LE) | 2 | 658 | medium | no | MILITARY |
| LIBG | TAR | Taranto-Grottaglie Marcello Arlotta Airport | Grottaglie | 2 | 719 | medium | no | OTHER |
| LIPA | AVB | Aviano Air Base | Aviano (PN) | 3 | 1256 | medium | no | MILITARY |
| LIRS | GRS | Grosseto Corrado Baccarini Air Base / Grosseto Airport | Grosseto (GR) | 3 | 1264 | medium | no | MILITARY |
| LIED | DCI | Decimomannu Air Base | Decimomannu | 3 | 1446 | medium | no | MILITARY |
| LIMW | AOT | Aosta Corrado Gex Airport | Saint-Christophe (AO) | 3 | 1622 | medium | no | OTHER |

#### KE — Kenya (5)

diğer (bölgesel, genel havacılık, mevsimlik): 5

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| HKLK | LKG | Lokichogio Airport | Lokichogio | 4 | 3575 | medium | no | OTHER |
| HKLO | LOK | Lodwar Airport | Lodwar | 4 | 3697 | medium | no | OTHER |
| HKKT | KTL | Kitale Airport | Kitale | 4 | 3937 | medium | no | OTHER |
| HKNK | NUU | Nakuru Lanet Airport | Nakuru | 4 | 4076 | medium | no | OTHER |
| HKWY | KWY | Kiwayu Airport | Kiwayu | 4 | 4293 | medium | no | OTHER |

#### KW — Kuveyt (1)

askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| OKAJ | XIJ | Ahmed Al Jaber Air Base | Ahmed Al Jaber AB | 3 | 1013 | medium | no | MILITARY |

#### KZ — Kazakistan (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| UASB | EKB | Ekibastuz Airport | Ekibastuz | 4 | 2723 | medium | no | OTHER |

#### LB — Lübnan (1)

askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| OLKA | KYE | Rene Mouawad Air Base | Tripoli | 1 | 199 | medium | no | MILITARY |

#### LK — Sri Lanka (2)

diğer (bölgesel, genel havacılık, mevsimlik): 1 · askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| VCCA | ACJ | Anuradhapura Airport | Anuradhapura | 4 | 4876 | medium | no | OTHER |
| VCCH | HIM | Hingurakgoda Air Force Base | Polonnaruwa Town | 4 | 4938 | medium | no | MILITARY |

#### LT — Litvanya (2)

askerî / ortak: 1 · diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| EYPP | PNV | Panevėžys Air Base | Panevėžys | 3 | 1637 | medium | no | MILITARY |
| EYSA | SQQ | Šiauliai International Airport | Šiauliai | 3 | 1671 | medium | no | OTHER |

#### LV — Letonya (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| EVLA | LPX | Liepāja International Airport | Liepāja | 3 | 1779 | large | no | OTHER |

#### LY — Libya (3)

diğer (bölgesel, genel havacılık, mevsimlik): 1 · savaştan sonra yeniden açıldı (OurAirports bayrağı eski): 1 · çatışma bölgesi, kapanış doğrulanamadı: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| HLMB | LMQ | Marsa al Brega Airport | Marsa al Brega | 3 | 1060 | medium | no | OTHER |
| HLGD | SRX | Sirt International Airport / Ghardabiya Airbase | Sirt | 3 | 1222 | large | no | REOPENED_DATA_LAG |
| HLGT | GHT | Ghat Airport | Ghat | 4 | 2129 | medium | no | CONFLICT_UNCERTAIN |

#### MA — Fas (2)

diğer (bölgesel, genel havacılık, mevsimlik): 1 · askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| GMFM | MEK | Bassatine Airport | Meknes | 4 | 2858 | medium | no | OTHER |
| GMMP | NNA | Kenitra Air Base | Kenitra | 4 | 2931 | medium | no | MILITARY |

#### MD — Moldova (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LUBL | BZY | Bălți-Leadoveni International Airport | Bălți | 2 | 734 | medium | no | OTHER |

#### MN — Moğolistan (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| ZMUB | ULN | Buyant-Ukhaa International Airport | Ulaanbaatar | 4 | 4972 | large | no | OTHER |

#### MR — Moritanya (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| GQPA | ATR | Atar International Airport | Atar | 4 | 4281 | medium | no | OTHER |

#### NE — Nijer (3)

diğer (bölgesel, genel havacılık, mevsimlik): 3

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| DRZA | AJY | Mano Dayak International Airport | Agadez | 4 | 2958 | medium | no | OTHER |
| DRRT | THZ | Tahoua Airport | Tahoua | 4 | 3320 | medium | no | OTHER |
| DRRM | MFQ | Maradi Airport | Maradi | 4 | 3326 | medium | no | OTHER |

#### NG — Nijerya (2)

diğer (bölgesel, genel havacılık, mevsimlik): 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| DNZA | ZAR | Zaria Airport | Zaria | 4 | 3515 | medium | no | OTHER |
| DNMN | MXJ | Minna Airport | Minna | 4 | 3725 | medium | no | OTHER |

#### NL — Hollanda (7)

diğer (bölgesel, genel havacılık, mevsimlik): 2 · askerî / ortak: 5

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| EHTW | ENS | Twente Airport | Enschede | 3 | 1973 | medium | no | OTHER |
| EHVK | UDE | Volkel Air Base | Uden | 4 | 2002 | medium | no | MILITARY |
| EHGR | GLZ | Gilze Rijen Air Base | Rijen | 4 | 2043 | medium | no | MILITARY |
| EHLE | LEY | Lelystad Airport | Lelystad | 4 | 2061 | medium | no | OTHER |
| EHWO | WOE | Woensdrecht Air Base | Hoogerheide | 4 | 2072 | medium | no | MILITARY |
| EHLW | LWR | Leeuwarden Air Base | Leeuwarden | 4 | 2096 | medium | no | MILITARY |
| EHKD | DHR | De Kooy Airfield / Den Helder Naval Air Station | Den Helder | 4 | 2131 | medium | no | MILITARY |

#### NO — Norveç (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| ENNO | NTB | Notodden Airport | Notodden | 4 | 2423 | medium | no | OTHER |

#### OM — Umman (3)

diğer (bölgesel, genel havacılık, mevsimlik): 1 · askerî / ortak: 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| OOMN | MNH | Mussanah Airport | Al Masna'ah | 3 | 1996 | medium | no | OTHER |
| OOMA | MSH | RAFO Masirah | Masirah | 4 | 2349 | medium | no | MILITARY |
| OOTH | TTH | Thumrait Air Base | Thumrait | 4 | 2408 | medium | no | MILITARY |

#### PK — Pakistan (13)

diğer (bölgesel, genel havacılık, mevsimlik): 9 · askerî / ortak: 4

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| OPPG | PJG | Panjgur Airport | Panjgur | 4 | 2204 | medium | no | OTHER |
| OPPI | PSI | Pasni Airport | Pasni | 4 | 2261 | medium | no | OTHER |
| OPJA | JAG | Shahbaz Air Base | Jacobabad | 4 | 2474 | medium | no | MILITARY |
| OPMJ | MJD | Moenjodaro Airport | Moenjodaro | 4 | 2504 | medium | no | OTHER |
| OPDI | DSK | Dera Ismael Khan Airport [IN-ACTIVE] | Dera Ismael Khan | 4 | 2506 | medium | no | OTHER |
| OPSU | SUL | Sui Airport | Sui | 4 | 2515 | medium | no | OTHER |
| OPSN | SYW | Sehwan Sharif Airport | Sehwan Sharif | 4 | 2523 | medium | no | OTHER |
| OPSS | SDT | Saidu Sharif Airport | Saidu Sharif | 4 | 2532 | medium | no | OTHER |
| OPMI | MWD | Mianwali Air Base | Mianwali | 4 | 2539 | medium | no | MILITARY |
| OPMS | ATG | Minhas Air Base | Kamra | 4 | 2566 | medium | no | MILITARY |
| OPSR | SGI | Mushaf Air Base | Sargodha | 4 | 2656 | medium | no | MILITARY |
| OPRT | RAZ | Rawalakot Airport | Rawalakot | 4 | 2689 | medium | no | OTHER |
| OPMA | XJM | Mangla Airport | Mangla | 4 | 2703 | medium | no | OTHER |

#### PT — Portekiz (1)

askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LPBJ | BYJ | Beja Airport / Airbase | Beja | 4 | 2908 | medium | no | MILITARY |

#### QA — Katar (1)

askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| OTBH | XJD | Al Udeid Air Base | Ar Rayyan | 3 | 1536 | medium | no | MILITARY |

#### RO — Romanya (2)

diğer (bölgesel, genel havacılık, mevsimlik): 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LRTC | TCE | Tulcea Danube Delta Airport | Mihail Kogălniceanu | 1 | 421 | medium | no | OTHER |
| LRCS | CSB | Caransebeş Airport | Caransebeş | 2 | 651 | medium | no | OTHER |

#### RS — Sırbistan (2)

diğer (bölgesel, genel havacılık, mevsimlik): 1 · askerî / ortak: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LYUZ | UZC | Ponikve Airport | Stapari | 2 | 655 | medium | no | OTHER |
| LYBT | BJY | Batajnica Air Base | Zemun | 2 | 699 | medium | no | MILITARY |

#### RU — Rusya (28)

savaş: kapalı (kaynakla): 6 · askerî / ortak: 3 · çatışma bölgesi, kapanış doğrulanamadı: 1 · diğer (bölgesel, genel havacılık, mevsimlik): 18

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| URKA | AAQ | Anapa Vityazevo Airport | Krasnyi Kurgan | 1 | 379 | medium | no | WAR_CLOSED_CONFIRMED |
| URKE | EIK | Yeysk Airport | Yeysk | 2 | 575 | medium | no | MILITARY |
| XRRT | TGK | Taganrog Yuzhny Airport | Taganrog | 2 | 649 | medium | no | CONFLICT_UNCERTAIN |
| URRP | ROV | Platov International Airport | Rostov-on-Don | 2 | 706 | large | no | WAR_CLOSED_CONFIRMED |
| UUOB | EGO | Belgorod International Airport | Belgorod | 2 | 966 | medium | no | WAR_CLOSED_CONFIRMED |
| UUOK | URS | Kursk East Airport | Kursk | 3 | 1086 | medium | no | WAR_CLOSED_CONFIRMED |
| UUOL | LPK | Lipetsk Airport | Lipetsk | 3 | 1234 | medium | no | WAR_CLOSED_CONFIRMED |
| UUBP | BZK | Bryansk International Airport | Bryansk | 3 | 1247 | medium | no | WAR_CLOSED_CONFIRMED |
| UUOT | TBW | Donskoye Airport | Tambov | 3 | 1292 | medium | no | OTHER |
| UUBC | KLF | Grabtsevo Airport | Kaluga | 3 | 1397 | medium | no | OTHER |
| UUMU | CKL | Chkalovskiy Air Base | Moscow | 3 | 1556 | medium | no | MILITARY |
| ULOL | VLU | Velikiye Luki Airport | Velikiye Luki | 3 | 1629 | medium | no | OTHER |
| UUEM | KLD | Migalovo Air Base | Tver | 3 | 1647 | medium | no | MILITARY |
| UWKJ | JOK | Yoshkar-Ola Airport | Yoshkar-Ola | 3 | 1799 | medium | no | OTHER |
| XUBK | RYB | Staroselye Airport | Rybinsk | 3 | 1809 | medium | no | OTHER |
| ULWW | VGD | Vologda Airport | Vologda | 3 | 1949 | medium | no | OTHER |
| ULAH | VKV | Vaskovo Airport | Arkhangelsk | 4 | 2517 | medium | no | OTHER |
| UUYX | UTS | Ust-Tsylma Airport | Ust-Tsylma | 4 | 2791 | medium | no | OTHER |
| USHB | EZV | Berezovo Airport |  | 4 | 2961 | medium | no | OTHER |
| UUYI | INA | Inta Airport | Inta | 4 | 3015 | medium | no | OTHER |
| USRN | NFG | Nefteyugansk Airport | Nefteyugansk | 4 | 3035 | medium | no | OTHER |
| UNSS | SWT | Strezhevoy Airport | Strezhevoy | 4 | 3242 | medium | no | OTHER |
| UNBG | RGK | Gorno-Altaysk Airport | Gorno-Altaysk | 4 | 3447 | medium | no | OTHER |
| UNKS | ACS | Achinsk Airport | Achinsk | 4 | 3813 | medium | no | OTHER |
| UNIP | TGP | Podkamennaya Tunguska Airport | Bor | 4 | 3893 | medium | no | OTHER |
| UOIG | SES | Svetlogorsk Airport | Svetlogorsk | 4 | 4013 | medium | no | OTHER |
| UODD | DKS | Dikson Airport | Dikson | 4 | 4141 | medium | no | OTHER |
| UNIB | BKA | Baykit Airport | Baykit | 4 | 4224 | medium | no | OTHER |

#### RW — Ruanda (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| HRYG | GYI | Gisenyi Airport | Gisenyi | 4 | 4234 | medium | no | OTHER |

#### SA — Suudi Arabistan (3)

askerî / ortak: 3

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| OEDR | DHA | King Abdulaziz Air Base | Dhahran | 3 | 1373 | large | no | MILITARY |
| OEPS | AKH | Prince Sultan Air Base | Al Kharj | 3 | 1533 | medium | no | MILITARY |
| OEKM | KMX | King Khalid Air Base | Khamis Mushait | 4 | 2108 | medium | no | MILITARY |

#### SD — Sudan (1)

savaş: kapalı, normalde açık olduğu belirsiz: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| HSMN | MWE | Merowe Airport | Merowe | 3 | 1986 | medium | no | WAR_CLOSED_PLAUSIBLE |

#### SE — İsveç (7)

diğer (bölgesel, genel havacılık, mevsimlik): 7

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| ESMK | KID | Kristianstad Airport | Kristianstad | 3 | 1926 | medium | no | OTHER |
| ESGR | KVB | Skövde Airport | Skövde | 4 | 2160 | medium | no | OTHER |
| ESSU | EKT | Eskilstuna Airport | Eskilstuna | 4 | 2170 | medium | no | OTHER |
| ESGP | GSE | Säve Airport | Göteborg | 4 | 2171 | medium | no | OTHER |
| ESKK | KSK | Karlskoga Airport | Karlskoga | 4 | 2229 | medium | no | OTHER |
| ESNY | SOO | Söderhamn Airport | Söderhamn | 4 | 2354 | medium | no | OTHER |
| ESUD | SQO | Storuman Airport | Storuman | 4 | 2726 | medium | no | OTHER |

#### SI — Slovenya (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LJPZ | POW | Portorož Airport | Sečovlje | 3 | 1157 | medium | no | OTHER |

#### SK — Slovakya (2)

diğer (bölgesel, genel havacılık, mevsimlik): 2

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| LZPP | PZY | Piešťany Airport | Piešťany | 3 | 1133 | medium | no | OTHER |
| LZZI | ILZ | Žilina-Dolný Hričov Airport | Dolný Hričov | 3 | 1155 | medium | no | OTHER |

#### SN — Senegal (6)

diğer (bölgesel, genel havacılık, mevsimlik): 6

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| GOTB | BXE | Bakel Airport | Bakel | 4 | 4659 | medium | no | OTHER |
| GOSM | MAX | Ouro Sogui Airport | Ouro Sogui | 4 | 4666 | medium | no | OTHER |
| GOTK | KGG | Kédougou Airport | Kédougou | 4 | 4809 | medium | no | OTHER |
| GOTT | TUD | Tambacounda Airport | Tambacounda | 4 | 4836 | medium | no | OTHER |
| GOSS | XLS | Saint Louis Airport | Saint Louis | 4 | 4878 | medium | no | OTHER |
| GOOK | KLC | Kaolack Airport | Kaolack | 4 | 4989 | medium | no | OTHER |

#### SO — Somali (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| HCMK | KMU | Kismayo Airport | Kismayo | 4 | 4135 | medium | no | OTHER |

#### SY — Suriye (2)

savaştan sonra yeniden açıldı (OurAirports bayrağı eski): 1 · çatışma bölgesi, kapanış doğrulanamadı: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| OSDZ | DEZ | Deir ez-Zor Airport | Deir ez-Zor | 1 | 219 | medium | no | REOPENED_DATA_LAG |
| OSPR | PMS | Palmyra Airport | Tadmur | 1 | 272 | medium | no | CONFLICT_UNCERTAIN |

#### TD — Çad (3)

diğer (bölgesel, genel havacılık, mevsimlik): 3

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| FTTY | FYT | Faya-Largeau Airport | Faya-Largeau | 4 | 2295 | medium | no | OTHER |
| FTTC | AEH | Abeche Airport | Abeche | 4 | 2663 | medium | no | OTHER |
| FTTD | MQQ | Moundou Airport | Moundou | 4 | 3377 | medium | no | OTHER |

#### TG — Togo (1)

diğer (bölgesel, genel havacılık, mevsimlik): 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| DXNG | LRL | Niamtougou International Airport | Niamtougou | 4 | 4046 | large | no | OTHER |

#### TN — Tunus (3)

diğer (bölgesel, genel havacılık, mevsimlik): 3

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| DTTG | GAE | Gabès Matmata International Airport | Gabès | 3 | 1587 | medium | no | OTHER |
| DTTF | GAF | Gafsa Ksar International Airport | Gafsa | 3 | 1637 | medium | no | OTHER |
| DTTR | EBM | El Borma Airport | El Borma | 3 | 1766 | medium | no | OTHER |

#### TZ — Tanzanya (3)

diğer (bölgesel, genel havacılık, mevsimlik): 3

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| HTLM | LKY | Lake Manyara Airport | Lake Manyara National Park | 4 | 4419 | medium | no | OTHER |
| HTPE | PMA | Pemba Airport | Chake Chake | 4 | 4642 | medium | no | OTHER |
| HTIR | IRI | Iringa Airport | Nduli | 4 | 4896 | medium | no | OTHER |

#### UA — Ukrayna (23)

savaş: kapalı, normalde açık olduğu belirsiz: 5 · savaş: kapalı (kaynakla): 18

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| UKFB | UKS | Sevastopol International Airport / Belbek Air Base | Sevastopol | 1 | 321 | medium | no | WAR_CLOSED_PLAUSIBLE |
| UKFF | SIP | Simferopol International Airport | Simferopol | 1 | 349 | large | no | WAR_CLOSED_CONFIRMED |
| UKDB | ERD | Berdyansk Airport | Berdyansk | 2 | 550 | medium | no | WAR_CLOSED_PLAUSIBLE |
| UKOH | KHE | Kherson International Airport | Kherson | 2 | 557 | medium | no | WAR_CLOSED_CONFIRMED |
| UKOO | ODS | Odesa International Airport | Odesa | 2 | 559 | large | no | WAR_CLOSED_CONFIRMED |
| UKCM | MPW | Mariupol International Airport | Mariupol | 2 | 593 | medium | no | WAR_CLOSED_CONFIRMED |
| UKON | NLV | Mykolaiv International Airport [CLOSED] | Mykolaiv | 2 | 613 | medium | no | WAR_CLOSED_CONFIRMED |
| UKDE | OZH | Zaporizhzhia International Airport | Zaporizhia | 2 | 651 | medium | no | WAR_CLOSED_CONFIRMED |
| UKDR | KWG | Kryvyi Rih International Airport | Kryvyi Rih | 2 | 686 | medium | no | WAR_CLOSED_CONFIRMED |
| UKDD | DNK | Dnipro International Airport | Dnipro | 2 | 705 | medium | no | WAR_CLOSED_CONFIRMED |
| UKLN | CWC | Chernivtsi International Airport | Chernivtsi | 2 | 806 | medium | no | WAR_CLOSED_CONFIRMED |
| UKHP | PLV | Suprunovka Airport | Poltava | 2 | 841 | medium | no | WAR_CLOSED_PLAUSIBLE |
| UKKE | CKC | Cherkasy International Airport | Cherkasy | 2 | 856 | medium | no | WAR_CLOSED_CONFIRMED |
| UKHH | HRK | Kharkiv International Airport | Kharkiv | 2 | 884 | medium | no | WAR_CLOSED_CONFIRMED |
| UKWW | VIN | Vinnytsia/Gavyryshivka International Airport | Vinnitsa | 2 | 886 | medium | no | WAR_CLOSED_CONFIRMED |
| UKLI | IFO | Ivano-Frankivsk International Airport | Ivano-Frankivsk | 2 | 898 | medium | no | WAR_CLOSED_CONFIRMED |
| UKLH | HMJ | Khmelnytskyi Airport | Khmelnytskyi | 2 | 910 | medium | no | WAR_CLOSED_PLAUSIBLE |
| UKLU | UDJ | Uzhhorod International Airport | Uzhhorod | 2 | 945 | medium | no | WAR_CLOSED_CONFIRMED |
| UKBB | KBP | Boryspil International Airport | Boryspil | 2 | 980 | large | no | WAR_CLOSED_CONFIRMED |
| UKKK | IEV | Igor Sikorsky Kyiv International Airport (Zhuliany) | Kyiv | 2 | 997 | medium | no | WAR_CLOSED_CONFIRMED |
| UKKV | ZTR | Zhytomyr Airport | Zhytomyr | 3 | 1000 | medium | no | WAR_CLOSED_PLAUSIBLE |
| UKLL | LWO | Lviv International Airport | Lviv | 3 | 1012 | large | no | WAR_CLOSED_CONFIRMED |
| UKLR | RWN | Rivne International Airport | Rivne | 3 | 1057 | medium | no | WAR_CLOSED_CONFIRMED |

#### YE — Yemen (1)

çatışma bölgesi, kapanış doğrulanamadı: 1

| ICAO | IATA | Ad | Şehir | Halka | km | Tür | sched | Sınıf |
|---|---|---|---|---|---|---|---|---|
| OYAT | AXK | Ataq Airport | Ataq | 4 | 2570 | medium | no | CONFLICT_UNCERTAIN |

## Kaynaklar (hepsi 2026-10-08 okundu)

- EASA CZIB-2022-01R14, Ukrayna hava sahası (2027-01-31'e kadar): https://www.easa.europa.eu/en/node/136057
- Ukrinform, 2026-06-11, Ukrayna hava trafiğini güvenli olunca açmaya hazır: https://ukrinform.net/rubric-economy/4132859-ukraine-ready-to-resume-air-traffic-as-soon-as-it-becomes-safe-official.html
- Wikipedia, List of airports in Ukraine (savaş öncesi hizmet, yaklaşık): https://en.wikipedia.org/wiki/List_of_airports_in_Ukraine
- www1.ru, 2026-01-06, Rosaviatsiya: 8 havalimanı kısıtlı, Elista/Gelencik/Krasnodar açıldı: https://www1.ru/en/news/2026/01/06/otkrytie-iuznyx-aeroportov-v-rf-naxoditsia-pod-voprosom.amp.html
- Halva Media, 2025-11-21, kapalı ve açılan havalimanları: https://media.halvacard.ru/news/zakrytye-aeroporty-spisok
- Mintrans (Rusya Ulaştırma Bakanlığı), 2025-09-11, Krasnodar 09:00'dan itibaren açık: https://mintrans.gov.ru/eye/press-center/news/12108
- Kavkaz-uzel, 2025-07-19, Gelencik ilk yolcu uçuşu 2025-07-18: https://amp.eng.kavkaz-uzel.eu/articles/66640
- The Moscow Times, 2024-04-26, Elista 2024-05-03'te açılıyor: https://themoscowtimes.com/2024/04/26/russia-to-reopen-first-airport-shuttered-since-ukraine-invasion-a84964
- Kommersant, 2026-03-30, Voronej hâlâ kapalı: https://www.kommersant.ru/doc/8550864
- travelto.ru, 2026-09-17, Rostov Platov hâlâ kapalı: https://travelto.ru/blog/aeroport-rostov-rabotaet/
- People Daily, 2026-03-28, Hartum tamamen açıldı: https://peopledaily.digital/news/khartoum-airport-reopens-fully-after-years-of-war-disruption
- Sudan War Monitor, 2024-09-26, Nyala 2023-04'ten beri sivil uçuşa kapalı: https://sudanwarmonitor.com/p/nyala-airport-destroyed-in-airstrike
- CBS News, El Faşir'in düşüşü ve Hartum'un açılışı: https://www.cbsnews.com/amp/news/sudan-civil-war-drone-attack-khartoum-airport-reopening-delayed
- Wikipedia, El Obeid Airport (Badr seferi sona erdi): https://en.wikipedia.org/wiki/El_Obeid_Airport
- KT Press, 2026-02-12, Goma 2025-01'den beri kapalı, yalnız MONUSCO inişi: https://www.ktpress.rw/2026/02/goma-international-airport-sees-first-aircraft-in-over-a-year/
- Africanews, 2025-02-14, M23 Kavumu'yu (Bukavu) aldı: https://www.africanews.com/amp/2025/02/14/m23-rebels-seize-key-airport-in-eastern-congo/
- CAMA Yemen, 2021-07-31, Taiz 2015-10'dan beri hizmet dışı: https://cama.gov.ye/en/news/meeting-headed-by-al-sami-i-discusses-attacks-on-taiz-airport-s-campus
- Yemen Monitor, 2026-01-29, Mokha havalimanı ticari uçuşlara açılıyor: https://www.yemenmonitor.com/?p=162930
- Yemen Online, 2026-07-23, San'a'ya UNHAS uçuşları 2026-07-13'ten beri durdu: https://yemenonline.info/special-reports/13192
- Al Jazeera, 2026-07-13, Yemen hükümeti San'a pistini vurdu: https://www.aljazeera.com/news/2026/7/13/yemen-govt-says-its-forces-attacked-sanaa-airport
- ch-aviation, 2026-05-12, Sky Mali Gao ve Mopti'yi durdurdu: https://www.ch-aviation.com/news/167046-sky-mali-halts-flights-amid-security-crisis
- Reuters/Yahoo, 2023-09-11, Sky Mali Timbuktu'yu durdurdu: https://au.news.yahoo.com/commercial-flights-halted-malis-timbuktu-153508024.html
- The Peninsula, 2025-10-26, Sirte 12 yıl sonra açıldı: https://s.thepeninsula.qa/article/26/10/2025/airport-in-libyas-sirte-reopens-after-12-years-closure
- The National, 2026-08-06, Deyrizor 14 yıl sonra açıldı: https://thenationalnews.com/news/mena/2026/08/06/syrias-deir-ezzor-airport-reopens-after-14-years
- Shafaq, 2026-06-10, Musul: sınırlı seferler, açılış töreni ertelendi: https://shafaq.com/en/society/Aviation-Authority-Operational-gaps-push-back-Mosul-Airport-opening
- Tribune India, Roş Pina 2025-01-09'da açıldı: https://www.tribuneindia.com/news/world/rosh-pina-airport-reopens
- Wikipedia, Bamenda Airport (2020'de durdu, 2026-04 papa ziyareti): https://en.wikipedia.org/wiki/Bamenda_Airport
- EASA CZIB-2026-04-R2, İran (2026-02-28 savaşı; 2026-11-16'ya kadar): https://www.easa.europa.eu/en/domains/air-operations/czibs/czib-2026-04-r2
- South Asian Herald, 2026-04-26, İran dış hatları 2026-04-25'te yeniden başladı: https://southasianherald.com/iran-resumes-international-air-travel-after-suspension-since-february-28/
