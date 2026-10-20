# Canlı uçakları göstermek: ceza yememek için kontrol listesi (sentez)

- **Tarih:** 2026-10-15
- **Kapsam:** Airline.live (airline.live, eski adı havayolu.live) sitesinin canlı uçak katmanı.
- **Dayanak:** Beş araştırma kolu (`legal/track1.md` … `track5.md`; ham metinler `legal/src/`) ve repo kodunun salt okunur incelemesi.
- **Okuma tarihi:** Aksi yazmadıkça bütün kaynaklar ve repo satırları 2026-10-15'te okundu.
- **Bu bir araştırmadır, hukuki görüş değildir.** "Zorunlu" denen maddeler de avukat onayından geçmelidir.
- **İşaretler:**
  - [BELİRSİZ]: kaynak çelişkili ya da eksik
  - [TAHMİN]: hesaplanmış tutar
  - [İKİNCİL]: resmî metin değil, ikincil kaynak

## Özet

1. **Uçuş takip sitesine özgü bir izin bulunamadı.** SHGM ya da DHMİ'nin böyle bir site için koyduğu bir izin, lisans ya da yayın kuralına rastlanmadı. Bu "bulunamadı" demektir, "izin gerekmez" kesinliği değildir. 2920 md. 43 uçuş bilgisi dağıtma görevini Bakanlığa veriyor, ama üçüncü kişilerin yayınını yasaklamıyor. https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2920.pdf
2. **Asıl riskler havacılık mevzuatı dışında:**

   | Kaynak | Konu | Yaptırım |
   |---|---|---|
   | 5651 md. 8/A | Millî güvenlik ya da kamu düzeni gerekçesiyle içerik kaldırma | 4 saatte uygulanmazsa 50.000–500.000 TL ve bütün siteye erişim engeli |
   | 5651 md. 3 | Sitede künye bulunmaması | 2.000–50.000 TL |
   | TCK 329 ve 336 | Gizli kalması gereken bilgiyi açıklamak | Taksirli hâli de cezalı: 6 ay–2 yıl |
   | 2565 | Askerî bölgelerin haritası ya da fotoğrafı | md. 25–26 |
   | KVKK | Özel uçak verisi kişisel veri olabilir; yurt dışı aktarım | Bkz. A7–A10 |
   | ODbL | `/acik-veri` sayfası olmadan lisans kendiliğinden düşer | Lisans sona erer |

3. **En olası yaptırım ceza davası değildir.** Daha olası olan, 8/A ile erişim engeli ve idari para cezasıdır. Flightradar24'e ya da başka bir takip sitesine Türkiye'de engel getirildiğine dair kayıt bulunamadı. Bu, böyle bir kararın olmadığını kanıtlamaz.
4. **5651'deki yetki BTK'dan Siber Güvenlik Başkanlığı'na (SGB) geçti.** Dayanak 7590 sayılı Kanun: kabul 24.07.2026, RG 31.07.2026 sayı 33326. 1. kol kabul tarihini, 2. ve 3. kol yayım tarihini yazmış; iki tarih de doğru. https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5651.pdf (md. 2 dipnotu)
5. **Canlı çekim üretimde henüz açık değil.** `docs/ACTIVATION.md`'nin 2. adımında `CONTACT_EMAIL` boş. Bu yüzden açıklar canlı veri gelmeden kapatılabilir; açılış, `CONTACT_EMAIL`'in Dokploy'a girilmesiyle olur.
6. **1. ve 4. kolun bir bulgusu repo koduyla çelişiyor.** İki kol da "bayrağı bilinmeyen uçak gizli" diyor. Bu yalnızca yerel alıcı için doğru:
   - adsb.lol yanıtında `dbFlags` alanı yoksa değer 0 sayılıyor ve uçak görünüyor (`packages/providers/src/live/response.ts:12` ve `:122`, `packages/providers/src/aircraft.ts:120-122`).
   - adsb.lol kendini "unfiltered" (süzgeçsiz) olarak tanımlıyor: https://www.adsb.lol/privacy-license/
   - Sonuç: Bugün askerî uçağı gizleyen tek şey adsb.lol'ün askerî biti. Bu biti taşımayan askerî ya da devlet uçağı görünür.
7. **Süzme yalnız API'de yapılıyor** (`apps/api/src/live/record.ts`). Worker askerî uçakları da redis-live'a ve iz tablolarına yazıyor; iz tablosunda `dbFlags` sütunu yok (`docs/DECISIONS.md:399`).
8. **Ceza tutarlarının iki biçimi var:**
   - Kanundaki taban tutar.
   - 3. kolun 2026 tahmini [TAHMİN], Kabahatler Kanunu md. 17/7 yeniden değerleme oranıyla hesaplandı. 5651 için yayımlanmış bir 2026 tablosu bulunamadı.
   - KVKK'nın 2026 tutarları ikincil kaynaktan: https://cottgroup.com/tr/mevzuat/item/yeniden-degerleme-oranina-gore-2026-yili-kvkk-idari-para-cezalari

---

## A. Canlı uçakları açmadan önce yapılması zorunlu olanlar

### A-I. Açık yasal yükümlülükler

**A1. Künye ve İletişim sayfası**
- **İçerik:**
  - ad soyad, yerleşim yeri (adres), e-posta, telefon
  - 1. kola göre vergi kimlik numarası
  - yer sağlayıcının (Hostinger) tüzel kişi adı ve adresi
- **Yer:** Ana sayfadan tek tıkla ulaşılan "İletişim" başlığı.
- **Dayanak:** 5651 md. 3; Yönetmelik md. 5 (RG 30.11.2007/26716).
- **Yaptırım:** 2.000–50.000 TL [TAHMİN 2026: ≈39.694–993.503 TL].
- **Bugünkü durum:** Sayfa yok. D-075'e göre "İletişim satırı yoktur" (`docs/DECISIONS.md:1554`).
- **Kapsam belirsizliği [BELİRSİZ]:** Yönetmelik "ticari veya ekonomik amaçlı" siteleri sayıyor, sitenin bugün geliri yok. Ücretli plan planlandığı için şimdiden uygulamak güvenlidir.
- **KVKK bağı:** KVKK md. 10/1-a da veri sorumlusunun adını ve adresini istiyor (bkz. A7).
- **Kim:**
  - Kullanıcı: bilgileri verir; ev adresi mi sanal ofis ya da KEP mi kullanılacağına avukatla karar verir (E7).
  - Kod: sayfayı, alt bilgi bağlantısını ve harita atıf satırındaki bağlantıyı ekler. Marka geçişiyle aynı sürümde yayımlanır.
- **Kaynaklar:**
  - https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5651.pdf
  - https://www.lexpera.com.tr/mevzuat/yonetmelikler/internet-ortaminda-yapilan-yayinlarin-duzenlenmesine-dair-usul-ve-esaslar-hakkinda-yonetmelik [İKİNCİL yayıncı]

**A2. Künyedeki e-posta resmî bildirim kanalıdır**
- **Kural:** SGB ve Erişim Sağlayıcıları Birliği kararları sitedeki adrese e-postayla gelebilir. 8/A'daki 4 saatlik süre bildirim anında başlar.
- **Dayanak:** 5651 md. 3/3 ve md. 6/A-11.
- **Kim:** Kullanıcı şunları kurar:
  - info@airline.live için telefonda anlık bildirim
  - aynı kutuya düşen hukuk@ ve abuse@ takma adları
  - yedek bir adrese yönlendirme
- **Uyarı:** Sitede yazan her adres izlenmelidir.

**A3. 8/A kararını 4 saat içinde uygulayabilmek (müdahale kiti ve kriz modu)**
- **Dayanak:** 5651 md. 8/A(1), (3), (5). Katalog suçlarında (md. 8) da 4 saat kuralı geçerli; listede MİT Kanunu md. 27 suçları da var.
- **Yaptırım:**
  - 50.000–500.000 TL [TAHMİN 2026: ≈0,9–9,0 milyon TL].
  - Karar URL bazında uygulanamazsa bütün siteye erişim engeli.
  - Hâkim kararıyla istenen fail bilgisi verilmezse 3.000–10.000 gün adli para cezası (md. 8/A(4)).
- **Admin'de olması gerekenler** (telefondan, dakikalar içinde kullanılabilmeli):
  - hex engeli (zaten var)
  - tescil ile engel
  - bölge karartma (çokgen ya da yarıçap) ve zaman penceresi
  - çağrı kodu desenini gizleme
  - havayolu dışındaki bütün uçakları gizleme
  - canlı katmanı tamamen durdurma
  - bildirimleri durdurma
  - kayıtlı geçmişten silme
- **Kayıt:** Her işlem kaydedilir: kim yaptı, ne zaman, hangi karar üzerine.
- **Runbook:** `docs/RUNBOOK.md`'ye "8/A, mahkeme ya da yayın yasağı bildirimi geldi" bölümü eklenir.
- **Kim:**
  - Kod: admin, API ve worker.
  - Kullanıcı: runbook'u okur ve admin'e telefondan bir kez dener.
- **Kaynaklar:** 5651 PDF'i (yukarıda). Erişim engeli 2026'da da aktif kullanılıyor:
  - https://www.evrensel.net/haber/6002815/t24-e-kapatma-karari
  - https://bianet.org/haber/engelliwebe-erisim-engellendi-323992

**A4. ODbL md. 4.6: `/acik-veri` sayfası**
- **Gereken:**
  - Canlı önbellek, iz tabloları ve geçmiş ODbL anlamında türetilmiş veritabanıdır.
  - Haritayı gören herkese bunun ya kopyası ya da türetme yöntemi ücretsiz sunulur ve haritadan bağlantı verilir.
  - Yöntem belgesinde engel listesindeki hex'ler yayımlanmaz; yalnız kural anlatılır.
- **Bugünkü durum:** `apps/web/src/app` altında `acik-veri` yok (5. kol).
- **Yaptırım:**
  - Lisans kendiliğinden düşer (md. 9.1) ve veriyi kullanma hakkı kalkar.
  - İlk bildirimden sonra 30 gün içinde düzeltilirse hak geri gelir (md. 9.4c).
  - Türkiye'deki dayanak FSEK ek md. 8 (veritabanı hakkı, 15 yıl); hangi yaptırımın uygulanacağı [BELİRSİZ].
- **Kim:** Kod; metni ajan yazar, avukat bakar.
- **Kaynaklar:**
  - https://opendatacommons.org/licenses/odbl/1-0/
  - https://www.adsb.lol/docs/open-data/historical/
  - https://www.mevzuat.gov.tr/MevzuatMetin/1.3.5846.pdf

**A5. ODbL md. 4.2 ve 4.3: lisans bildirimi ve atıf her yerde**
- **API ve WS:** `/v1/live`, `/v1/search` ve WS `snapshot` yanıtlarına `license`, `licenseUrl` ve `attribution` alanları eklenir. OpenAPI `info.license` ODbL'yi anar.
- **Bugünkü durum:** Bildirim `app.ts` 125–141, `routes.ts` 155–161 ve `ws-protocol.ts` 222'de yok (5. kol).
- **Atıf** ("ADSB.lol · ODbL 1.0", bağlantılı) şu yerlerde de bulunur:
  - uçuş sayfası, pano, geçmiş oynatma
  - OG ve paylaşım görselleri
  - bildirimin açtığı sayfa
  - mobil ekran
  - ileride her dışa aktarma dosyası
- **Yaptırım:** A4'teki gibi lisans ihlali.
- **Kim:** Kod.

**A6. adsb.lol: iletişim bilgili User-Agent ve bilgilendirme e-postası**
- **UA biçimi:** `airline.live/<sürüm> (+https://airline.live; info@airline.live)`. adsb.lol iletişim bilgisi olmayan UA'ya 403 döndürüyor (repodaki 2026-09-25 araştırması; https://raw.githubusercontent.com/adsblol/api/main/src/adsb_api/app.py).
- **E-posta:** info@airline.live'tan info@adsb.lol'e, `CONTACT_EMAIL` girilmeden önce (ACTIVATION 1. adım).
  - Mevcut taslağa eklenecekler: yeni marka, ücretli özellik planı, istek bütçesi (0,1–0,2 istek/sn), yeni UA ve ODbL uyum planı.
  - Gelen yanıt saklanır.
- **Zorunluluk [BELİRSİZ]:** "Üretimden önce yazın" cümlesi 2026-09-25'te yayındaki OpenAPI açıklamasında vardı, bugünkü kaynak kodunda yok. Yine de DUR-SOR 3 ve iş riski nedeniyle gönderilmeli.
- **Risk:** Erişimin kesilmesi ve adsb.lol'ün tazminat maddesi (https://www.adsb.lol/privacy-license/).
- **Kim:**
  - Kullanıcı: e-postayı kendisi gönderir.
  - Kod: UA biçimini yeni markaya göre günceller.

**A7. KVKK aydınlatması (site kullanıcıları ve uçak sahipleri)**
- **`/gizlilik` sayfası şunları içerir:**
  - veri sorumlusunun kimliği: gerçek kişi olarak ad ve adres
  - amaçlar ve hukuki sebepler
  - aktarımlar: Hostinger; Esri ve OpenFreeMap karoları (OpenFreeMap tarafında Cloudflare); adsb.lol'e giden `/v2/hex` takip istekleri; push servisleri
  - haklar ve başvuru yolu
- **Çerez ve yerel depolama aydınlatması:** Her öğenin adı, amacı, süresi ve birinci ya da üçüncü taraf olduğu yazılır (Çerez Rehberi, Temmuz 2025).
- **Uçak verisi aydınlatma metni** (herkese açık):
  - Veri uçak sahiplerinden alınmadığı için aydınlatma en geç ilk yayımda yapılır (Aydınlatma Tebliği md. 6).
  - Kişilere tek tek ulaşılamadığından metin herkese açık olur; bunun yeterli olup olmadığı [BELİRSİZ].
- **Aydınlatma ile rıza ayrı tutulur.** Aydınlatma metni "kabul" ettirilmez. Başka bir sitenin metnini aynen kullanmak da hukuka aykırı sayılıyor (ilke kararı 2026/347).
- **Hukuki sebep:** Meşru menfaat (md. 5/2-f), yarım sayfalık yazılı bir denge testiyle.
  - IMY'nin Flightradar24 kararı (DI-2021-3397, 2025-06-30) aynı faaliyette bu sebebi kabul etti.
  - "Veri zaten alenî" sebebine (md. 5/2-d) ve md. 28/2-b istisnasına güvenilmez.
- **Yaptırım:** Aydınlatma yükümlülüğüne aykırılık 85.437–1.709.200 TL (2026) [İKİNCİL].
- **Kim:** Ajan metin taslağını yazar, avukat onaylar, kod sayfaları ekler.
- **Kaynaklar:**
  - https://www.mevzuat.gov.tr/mevzuatmetin/1.5.6698.pdf
  - https://www.resmigazete.gov.tr/eskiler/2018/03/20180310-5.htm
  - https://www.kvkk.gov.tr/Icerik/8710/veri-sorumlulari-tarafindan-acik-riza-ve-aydinlatma-metinlerinin-ayri-ayri-duzenlenmesi-gerektigi-hakkinda-kisisel-verileri-koruma-kurulunun-18-02-2026-tarihli-ve-2026-347-sayili-ilke-kararina-iliskin-kamuoyu-duyurusu
  - https://www.kvkk.gov.tr/SharedFolderServer/CMSFiles/fb193dbb-b159-4221-8a7b-3addc083d33f.pdf
  - https://www.edpb.europa.eu/system/files/2025-08/se-2025-06-decision-public_0.pdf

**A8. KVKK md. 9: yurt dışı aktarım güvencesi**
- **Durum:**
  - Hostinger'ın Türkiye'de VPS veri merkezi yok: https://www.hostinger.com/support/1583267-where-are-hostinger-servers-located/
  - Kurum, yurt dışındaki bir bulutta depolamayı "aktarım" sayıyor (Yurt Dışına Aktarım Rehberi s.16).
- **Gereken:**
  - Hostinger ile Kurulun standart sözleşmesi, hiç değiştirilmeden imzalanır.
  - İmzalar tamamlandıktan sonra 5 iş günü içinde Kuruma bildirilir.
  - Aynı işlem Web Push servisleri, Expo, SMTP, Turnstile ve Sentry için de gerekir.
  - Açık rıza yalnız arızi aktarımda geçerli; sürekli aktarıma dayanak olamaz (Yönetmelik md. 16).
- **Yaptırım:**
  - Standart sözleşmeyi bildirmemek: 90.308–1.806.377 TL [İKİNCİL].
  - Güvencesiz aktarım için Kurulun hangi bende dayanacağı [BELİRSİZ].
- **Kapsam notu:** Canlı uçaktan bağımsızdır. VPS'te log ya da analiz verisi varsa bugün de geçerlidir.
- **Kim:**
  - Kullanıcı: sözleşmeyi talep eder, imzalar ve bildirir.
  - Avukat: aktarım mekanizmasını seçer (E13).
  - Alternatif: kullanıcı verisini Türkiye'de tutmak. Bu bir mimari değişikliktir ve kullanıcı onayı ister (DUR-SOR 5).
- **Kaynaklar:**
  - https://www.resmigazete.gov.tr/eskiler/2024/07/20240710-2.htm
  - https://www.kvkk.gov.tr/Icerik/8142/Kisisel-Verilerin-Yurt-Disina-Aktarilmasi-Rehberi

**A9. KVKK: saklama süresinin üst sınırı ve imha**
- **Bugünkü durum:** `flights` ve `events` için yalnız "en az 365 gün" yazıyor (`docs/spec/domain.md:210`).
- **Gereken:**
  - Bir üst sınır, öneri: 365 gün, sonra silme ya da anonimleştirme.
  - Loglar en çok 30 gün.
  - Periyodik imha en çok 6 ay arayla.
  - İmha kaydı en az 3 yıl.
- **Dayanak:** KVKK md. 4/2-d ve 7; İmha Yönetmeliği md. 7/3 ve 11.
- **Yaptırım:** Süresi dolan veriyi silmemek TCK 138 kapsamında suçtur (KVKK md. 17/2). Hapis süresi tam metinden doğrulanmalı.
- **Kim:**
  - Kod: imha işi ve testleri.
  - Kullanıcı: süreleri onaylar.
- **Kaynak:** https://www.resmigazete.gov.tr/eskiler/2017/10/20171028-10.htm

**A10. KVKK: başvuru ve veri ihlali süreçleri**
- **Başvuru:** En geç 30 gün içinde, ücretsiz sonuçlandırılır (md. 11, 13; Başvuru Tebliği: https://www.resmigazete.gov.tr/eskiler/2018/03/20180310-6.htm).
- **Veri ihlali:** Kurula ve ilgililere bildirilir. Kurul bu süreyi 72 saat olarak yorumluyor (karar 2019/10; [BELİRSİZ]: karar metni açılamadı).
- **Yaptırım:** Veri güvenliği yükümlülüğüne aykırılık 256.357–17.092.242 TL [İKİNCİL].
- **Kim:**
  - Kullanıcı: süreci yürütür.
  - Kod ve ajan: aydınlatma metnine başvuru adresini ekler, runbook'a ihlal bölümünü yazar.

**A11. Yayın yasakları ve olağanüstü dönem tedbirleri**
- **Kural:** Yetkili makamın açıklanmasını yasakladığı bilgi yayımlanmaz.
  - TCK 334 ve 336: 3–5 yıl; taksirle işlenirse 6 ay–2 yıl.
  - Mahkeme yayın yasaklarına uyulur. Örnek: TUSAŞ saldırısından sonra mahkeme yayın yasağı getirdi, RTÜK uymayan kanallara ceza verdi (https://www.evrensel.net/haber/531799, 23.10.2024).
  - OHAL tedbirleri: 2935 md. 11/e-f; ihlali 1–6 ay hapis (md. 25).
  - Seferberlik ve savaş: 2941 md. 3 ve 18; cezalar seferberlikte iki, savaşta üç katına çıkar.
- **Uygulama:** A3'teki kriz modu kullanılır.
- **Kim:** Kullanıcı haberleri izler ve kriz modunu açar.
- **Okunamayanlar [BELİRSİZ]:** 1402 sayılı Sıkıyönetim Kanunu ve 2024 Seferberlik Yönetmeliği.

### A-II. Açık hüküm yok, ama özen gereği açılıştan önce yapılmalı

Neden gerekli:
- TCK 329/3 ve 336/3 taksirli hâli de cezalandırıyor (6 ay–2 yıl). Gizli bilgiyi açıklamanın temel cezası 5–10 yıl.
- Sunucunun yurt dışında olması korumaz: TCK 8 ve 13/1-b. https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5237.pdf
- adsb.lol süzgeçsiz; süzme sorumluluğu bizde.

Emsaller:
- **15 Temmuz 2016:** Cumhurbaşkanını taşıyan TC-ATA ve MLAT'la izlenen F-16'lar takip sitelerinde göründü. https://theaviationist.com/2016/07/18/exclusive-all-the-details-about-the-aerial-battle-over-turkey-during-the-military-coup/
- **İncirlik, 2026:** Üssün canlı yayını 2565 md. 7 ve 25/a ile soruşturuldu, gazeteciler dahil 5 kişiye adli kontrol uygulandı (ntv.com.tr, haber 1714231, 02.03.2026).

**A12. İkinci katman askerî tespit**
- **VRS code-blocks askerî aralıkları:** Kaynak CC0 ve zaten izinli. Dosyada yaklaşık 414 askerî aralık var; Türkiye'nin askerî bloğu 4B8200–4B82FF. https://raw.githubusercontent.com/vradarserver/standing-data/main/code-blocks/schema-01/code-blocks.csv
- **Askerî çağrı kodu önekleri:**
  - HVK: `tools/fixtures/vrs/airlines.csv:2394`'te "Turkish Air Force".
  - TUAF: Flightradar24 Kasım 2025'te TUAF543 çağrı kodlu C-130'u gösterdi. https://ankahaber.net/haber/detay/tskya_ait_c130_kargo_ucagi_dustu_20_sehidin_kimliklerinin_belli_oldugu_kazayla_ilgili_incelemeler_suruyor_akinci_tiha_destek_icin_gonderildi_272997
  - ASENA: 2016'da tanker uçakların çağrı koduydu.
  - Liste eksik; başka ülkelerin askerî önekleri VRS'ten alınmalı.
- **Uygulama:** Kural her kanalda geçerlidir: API, WS, arama, takip (`/v2/hex`), bildirim, OG görseli, uçuş sayfası, geçmiş ve oynatma.
- **Kim:** Kod.

**A13. Devlet hava araçları ve VIP filosu**
- **Tanım:** 2920 md. 3/c'ye göre devlet hava aracı askerlik, güvenlik, gümrük ve orman yangını hizmetlerindeki uçaklardır.
- **Varsayılan gizli olacaklar:** Cumhurbaşkanlığı ve VIP filo, MİT, EGM, Jandarma, Sahil Güvenlik, gümrük. Orman yangını uçakları avukata sorulur (E3).
- **Aday tescil listesi:** repoya alınmadı (D-115: tescil ve hex listeleri repoda, imajda ve istemcide tutulmaz; liste kullanıcıdadır).
- **Engel nasıl kurulur:**
  - Hex'ler VRS standing-data'dan çevrimdışı eşleştirilir. (Repo kopyasına not, 2026-10-19: projenin VRS verisinde tescil–hex eşlemesi yoktur; uygulanan yöntem ACTIVATION 2. adım (e)'dedir.)
  - Engel hem tescile hem hex'e uygulanır.
  - Bu uçaklar için geçmiş iz ve bildirim tutulmaz.
- **Çağrı koduna güvenilmez:** TC-ATA 2016'da THY çağrı koduyla uçtu.
  - https://www.dawn.com/news/amp/1271625
  - https://www.diken.com.tr/?p=1297343
- **Emsal politika:** Flightradar24 askerî ve devlet uçaklarını tamamen engelleyebiliyor. https://support.fr24.com/support/solutions/articles/3000117426-why-is-some-aircraft-information-limited-or-not-visible-
- **Kim:**
  - Kod: kuralı ve listeyi yazar.
  - Kullanıcı: listeyi onaylar.

**A14. Coğrafi süzgeç**
- **Alanlar:**
  - beş askerî üssün çevresi: LTAG, LTAH, LTBG, LTBI, LTBL
  - AIP ENR 5.1 yasak sahaları: LTP1 ve LTP2 (Çanakkale), LTP6 (Ankara), LTP7 (İmralı). Buralarda sivil uçuşa izin yok; oradaki uçak devlet uçağıdır.
- **Kural:** Bu alanlarda alçakta ya da yerde görünen havayolu dışı uçaklar sunucuda gizlenir.
- **Repodaki bilinen açık:** Üsse inen, askerî bayrağı olmayan uçak "İnişte AOE" olarak görünüyor (`docs/spec/domain.md:90`).
- **Doğrulanacak:** Ortak kullanımlı havalimanlarının askerî tarafı. Liste AIP AD 2'den çıkarılmalı.
- **Gizlilik:** Koordinatlar yalnız sunucuda kalır; yayımlanmaz, istemciye gitmez.
- **Kaynaklar:**
  - https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_5_1_en.pdf
  - 2565 md. 7(1)(e), 9(h), 21(e), 25, 26: https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2565.pdf
- **Açık soru:** AIP olgularını iç süzgeçte kullanmak izin ister mi? (E16)

**A15. Süzmeyi kaynağa taşımak**
- Askerî, devlet ve engel listesindeki uçaklar worker'da süzülür: redis-live'a ve iz tablolarına yazılmaz. Kapsama raporu için yalnız kimliksiz sayılar tutulur.
- Geçmiş, uçuş sayfası, oynatma ve bildirimler de okunurken süzülür.
- Engel listesine eklenen uçağın geçmişi silinir.
- **Gerekçe:** Saklanan askerî izler sızabilir ya da el konabilir (TCK 339, KVKK; E14).
- **Kim:** Kod.

### A-III. Sonraki eşikler (canlı uçak için değil, ama zorunlu)

**Ücretli plandan önce:**
- işletme ve vergi kaydı (mali müşavir)
- KEP adresi
- ETBİS kaydı satıştan önce; bildirim yapılmazsa 143.102–715.516 TL (2026)
- e-ticaret künyesi
- ön bilgilendirme formu, mesafeli hizmet sözleşmesi ve abonelik sözleşmesi
- cayma istisnası için ayrı onay
- yıllık plan kendiliğinden yenilenmez
- iptal yolu kayıttan zor olamaz; fesih 7 günde uygulanır, kalan ücret 15 günde iade edilir
- fiyatlar vergiler dahil gösterilir; ödeme düğmesi ödeme yükümlülüğünü açıkça söyler
- kullanım koşullarındaki "ücretsiz" ifadesi güncellenir
- tüketici hukukuna aykırılıkta ceza işlem ya da sözleşme başına 3.973 TL (2026)

Kaynaklar:
- https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6563.pdf
- https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6502.pdf
- https://www.resmigazete.gov.tr/eskiler/2014/11/20141127-6.htm
- https://www.resmigazete.gov.tr/eskiler/2022/12/20221229-5.htm

ODbL açısından ücret veriye değil özelliğe bağlanır (D-011).

**Tanıtım iletisi gönderilirse:**
- önceden onay; onay kutusu önceden işaretli olamaz
- onayların İYS'ye aktarılması
- her iletide ret yolu; ret gelince 3 iş günü içinde gönderim durur
- ceza 2.859–14.309 TL; toplu gönderimde 10 katına kadar
- Yaklaşma ve iniş bildirimleri tanıtım içermedikçe hizmet bildirimidir (Ticari İletişim Yönetmeliği md. 6/2: https://www.resmigazete.gov.tr/eskiler/2015/07/20150715-4.htm).

**Kendi alıcıdan önce:**
- BTK'dan yazılı görüş alınır (5809 md. 37 ve 51/2). Taslak `legal/track3.md` §9'da.
  - https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5809.pdf
  - https://btk.gov.tr/en/frekans-tahsisinden-muaf-telsiz-cihaz-ve-sistemleri
- ATC sesi dinlenmez.

**Parça 5'ten önce (ticari veri):** ADS-B verisi ile ticari veri ayrı katman ya da ayrı veritabanı olarak tasarlanır. ODbL'nin paylaşım şartı ile ticari sağlayıcıların yasakları çatışır.

---

## B. Yapılması önerilenler

| # | Öneri | Kaynak ve not |
|---|---|---|
| B1 | Türk ICAO bloğunda tescili TC- ile başlamayan ya da tescili olmayan kayıtları varsayılan olarak gizlemek | Türk bloğunun 4B8000–4BFFFF olduğu varsayım [BELİRSİZ]; önce VRS code-blocks'tan çevrimdışı doğrulanır (1. kol S2) |
| B2 | Türk bloğunda bayrağı belirsiz uçakların MLAT ve TIS-B konumunu göstermemek | Askerî uçak çoğu zaman yalnız Mode S yayımlar, konumunu MLAT ortaya çıkarır (1. kol S4) |
| B3 | Savunma sanayii test uçuşlarını (TUSAŞ, Baykar) gizlemek | ICAO tanıtıcıları doğrulanmadı (2. kol S7) |
| B4 | Ücretsiz gizleme talebi yolu (form ve e-posta) | Tescil belgesi rutin olarak istenmez (IMY Flightradar24'ü bu yüzden kınadı); kurumsal e-posta ya da şirket belgesi yeter. Engel hex'e ve tescile birlikte uygulanır, geçmişe de işler. Hedef birkaç saat, KVKK sınırı 30 gün. Parça 3 M6a'dan öne alınır |
| B5 | Herkese açık "Gizlilik ve güvenlik filtreleri" sayfası | Kurallar anlatılır, liste yayımlanmaz; taksir değerlendirmesinde özenin kanıtı olur |
| B6 | LADD ve PIA uçaklarında hex'i de gizlemek (adreste ve arayüzde opak kimlik); geçmiş iz ve uçuş sayfasını kapatmak | 4. kol Ö3 |
| B7 | Ticari olmayan uçaklarda varsayılan olarak yalnız tip ve konum göstermek | FlightAware Avrupa'da bunu yapıyor: https://www.flightaware.com/blocked. **Ürün kararı, kullanıcı onayı gerekir** |
| B8 | Kriz modunda havayolu dışı uçakları N dakika gecikmeli göstermek | Kullanıcı kararı |
| B9 | 7500, 7600 ve 7700 kodlarını tarafsız dille göstermek; 7500 için anlık bildirim yapmamak | TCK 217/A özel kast ister, risk çok düşük |
| B10 | Kullanım koşullarına ve haritaya eklemeler (ODbL haklarını kısıtlamadan) | Askerî, istihbarat ya da hedefleme amaçlı kullanım yasağı; "Resmî havacılık bilgi kaynağı değildir, seyrüsefer ve operasyonel karar için kullanılamaz; resmî kaynaklar DHMİ AIS ve MGM'dir"; "DHMİ, SHGM, MGM ve NOAA ile bağlantılı değildir". Kaynaklar: https://www.dhmi.gov.tr/AIPDocuments/LT_GEN_3_1_en.pdf ve https://www.weather.gov/disclaimer |
| B11 | Özen kaydı: filtre kurallarını DECISIONS'a yazmak ve testlerle korumak | Test örnekleri: HVK çağrı kodu, VRS askerî aralığı, LTP içinde alçak uçak |
| B12 | Analiz: IP maskeleme, ziyaretçi kimliğinin ömrünü sınırlama, onayın tarih ve sürümünü kaydetme | 4. kol Ö6 |
| B13 | Karo isteklerini aydınlatmada yazmak; temkinli seçenek olarak uydu katmanını yalnız kullanıcı açınca yüklemek | Kullanıcı kararı |
| B14 | OpenFreeMap yedek altlığında `aerodrome_label` ve `landuse` katmanlarının `military` sınıfını süzmek | D-107 ile tutarlılık; https://openmaptiles.org/schema/ |
| B15 | Ambulans ya da hac uçuşu gibi hassas uçuşları belirli bir kişiyle ilişkilendirmemek | KVKK md. 6 |
| B16 | data-sources.md'yi güncellemek | OpenFreeMap şartları 2026-10-14'te değişti: Cloudflare onayı, Macar hukuku, Budapeşte'de tahkim (https://openfreemap.org/tos). Natural Earth: kamu malı, atıf gerekmez |
| B17 | Erişim engeli durumunu ara ara sorgulamak | erisim.btk.gov.tr; adres 7590'dan sonra değişebilir [BELİRSİZ] |
| B18 | Periyodik ODbL dökümü (md. 4.6a) | Avukat yöntem belgesini yetersiz bulursa ya da ücretli API açılırsa |
| B19 | CLDR (Unicode License v3) bildirimini ATTRIBUTION.md'ye eklemek | https://www.unicode.org/license.txt |
| B20 | NWS ve NOAA verisi: logo kullanmamak, onay ima etmemek, dakikada 100 istek sınırını aşmamak | https://aviationweather.gov/data/api |
| B21 | adsb.lol bağımlılığını azaltmak: kendi alıcı | Önce BTK görüşü alınır (A-III) |

---

## C. Zaten yapılanlar (repo salt okunur incelendi)

- **Askerî uçaklar:** Askerî bayraklı uçak API, WS ve aramada dönmüyor (`isHiddenByDefault`, `apps/api/src/live/record.ts`). **Sınır:** Yalnız adsb.lol'ün askerî biti kullanılıyor; bayrağı eksik uçak görünür (bkz. A12).
- **Bayrağı bilinmeyen uçak (`null`):** Gizli, ama yalnız yerel alıcıda (D-071). adsb.lol'de bu durum 0 sayılıyor.
- **PIA ve LADD:** Tescil ve tescile eşit çağrı kodu gizli (`withPrivacy`). `ownOp` alanı kayıt aracında siliniyor (D-094); canlı modelde görünmediği doğrulanmalı.
- **Hex engel listesi:** Admin listesi (`hy:blocklist:hex`) her kanalda uygulanıyor; liste okunamazsa API canlı veriyi açmıyor (D-074). Geçmiş izlere de uygulanıp uygulanmadığı doğrulanmadı.
- **Askerî üsler:** Sitenin hiçbir yerinde yok (D-107). Yurt dışındaki yalnız askerî alanlar da listelenmiyor.
- **Veri kaynakları:**
  - Harici servislere yalnız worker erişiyor.
  - FR24 kazınmıyor; adsb.lol `routeset` ve `route` uç noktaları kullanılmıyor; yasak kaynaklar yok.
  - adsb.lol için zorunlu UA, AIMD hız denetimi var; 401/403 gelince çekim duruyor.
- **Atıflar:**
  - Haritada ADSB.lol ve ODbL 1.0 atfı bağlantılı; küçük ekranda katlanmıyor.
  - OpenFreeMap, OpenMapTiles ve OSM atıfları var.
  - Esri atfı üretimde 2026-09-30'da doğrulandı.
- **Kullanım koşulları:** Geçici metin yürürlükte (D-075; yürürlük tarihi 2026-10-07, `apps/web/src/lib/terms.ts`). İçeriği:
  - hizmet "olduğu gibi" ve "bilgi amaçlı"; operasyonel ve seyrüsefer kararları için değil
  - ODbL hakları kısıtlanmaz maddesi
  - Esri §3.1c.5 maddesi ve karo yasakları
- **Hakkında sayfası** türetilmiş veritabanının ODbL altında kaldığını yazıyor. ATTRIBUTION.md her kaynağı listeliyor.
- **Lisans kaydı:** 7 alanlı kayıt ve `DATA_USAGE_MODE` kapısı çalışıyor.
- **Hava durumu (AWC):** Atıf var, logo yok; "resmî brifing değildir" uyarısı var; istekler arasında 700 ms.
- **DHMİ:** Adlar kaynağı yazılarak elle derlendi; AIP yalnız referans.
- **Karolar:** Tarayıcı aracısız çekiyor; service worker önbelleği yok.
- **Analiz:** Kullanıcının kendi uygulaması; onaydan sonra yükleniyor ve onay geri alınabiliyor (D-028).
- **Çerezler:** Dil adreste tutuluyor, çerezde değil (D-076). Yönetici çerezi httpOnly, `SameSite=Strict` ve yalnız `/admin` yolunda (D-056).
- **Loglar:** authorization, cookie, token ve password alanları gizleniyor.
- **Saklama:** İnce iz 30 gün, örneklenmiş iz 7 gün, hava durumu 30 gün. İz tabloları yedeğe girmiyor.
- **Kullanıcı verisi:** Ayrı şemada; ODbL dökümüne girmiyor (D-011).

**Eksikler** (A ve B'de ele alındı):
- görünür künye
- `/gizlilik` sayfası ve çerez aydınlatması
- `/acik-veri` sayfası
- API ve WS lisans alanları
- ikinci katman askerî süzgeç
- VIP ve devlet filosu listesi (boş)
- coğrafi süzgeç
- kriz modu ve 8/A runbook'u
- worker'da süzme
- saklama süresinin üst sınırı
- yurt dışı aktarım sözleşmeleri
- gizleme talebi yolu

---

## D. Yapılmayacaklar (kırmızı çizgiler)

1. **Askerî, devlet ya da VIP uçak gösterilmez.** Hiçbir kanalda: harita, arama, takip, bildirim, geçmiş, OG görseli, API. Bayrak eksikse bile ikinci katman kurallar (A12–A14) uygulanır.
2. **Askerî üsler geri getirilmez.** Pin, ad, sayfa, arama sonucu ya da uzaklık referansı olarak hiçbir yerde görünmezler (D-107).
3. **Askerî yasak ve güvenlik bölgelerinin görüntüsü ya da haritası üretilmez.** Bu fotoğraf, film, web kamerası, kullanıcı fotoğrafı ve dron görüntüsünü de kapsar (2565 md. 7, 9, 21).
4. **Yasak sahalar haritaya çizilmez.** LTP koordinatları ya da AIP'den türeyen bir katman DHMİ'nin yazılı izni olmadan yayımlanmaz.
5. **DHMİ ve AIP malzemesi kopyalanmaz.** AIP sayfaları, tabloları ve NOTAM listeleri kopyalanmaz (AIP GEN 0.1 §5: https://www.dhmi.gov.tr/AIPDocuments/LT_GEN_0_1_en.pdf). AIP Türkiye abonelikli bir üründür: https://www.dhmi.gov.tr/Sayfalar/aipturkey.aspx
6. **Resmî bağ izlenimi verilmez.** DHMİ, SHGM, MGM, NOAA ya da NWS logosu kullanılmaz; bu kurumların onayı ima edilmez.
7. **Yayın yasağı altındaki bir olayla ilgili içerik açık tutulmaz.** Kriz anında operasyon bölgesi gösterilmez; 4 saatlik süre aşılmaz.
8. **7500 sansasyonel gösterilmez.** "Kaçırıldı" gibi yorumlar yapılmaz.
9. **Haber ya da blog bölümü açılmaz.** Açılırsa site 5187 md. 2/m'ye göre "internet haber sitesi" sayılabilir (https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5187.pdf). Yenilikler sayfası ürün değişiklik günlüğüdür ve kalabilir (3. kolun değerlendirmesi).
10. **Gizleme talebi zorlaştırılmaz.**
    - Ücretli "hızlı engelleme" hizmeti kurulmaz.
    - Tescil belgesi rutin olarak istenmez.
11. **Askerî izler saklanmaz ya da dökülmez.** Engel listesindeki hex'ler yayımlanmaz.
12. **Yasak kaynaklar kullanılmaz:**
    - airplanes.live, adsb.fi, OpenSky, ADS-B Exchange
    - FR24 ve FlightAware'den kazıma; FR24 resmî API'si
    - adsb.lol `routeset` ve `route` uç noktaları
    - Karolar için proxy ya da önbellek kurulmaz.
    - İstemciler adsb.lol'e doğrudan istek atmaz.
13. **ODbL kısıtlanmaz.**
    - Kullanım koşullarıyla ODbL hakları daraltılmaz.
    - Ücret veri münhasırlığına bağlanmaz.
    - ADS-B verisi ticari veriyle aynı veritabanında karıştırılmaz.
14. **ATC sesi dinlenmez ve kaydedilmez** (5809 md. 51/2; v1 kapsamı dışında).
15. **Ücretli dönemde de yapılmayacaklar:**
    - otomatik yenilenen yıllık abonelik
    - önceden işaretli onay kutusu
    - onaysız tanıtım iletisi
16. **Ajanın yapmayacakları:**
    - canlı araç çalıştırmak (`smoke:live`, `record`, `coverage:probe`)
    - e-posta göndermek
    - sır üretmek
    - kurumlara başvurmak
    - avukat görüşü olmadan proaktif resmî yazışma başlatmak

---

## E. Avukata sorular (birleştirilmiş, önceliğe göre)

**Ceza hukuku ve devlet güvenliği**
1. Herkese açık ADS-B ya da MLAT yayınından elde edilen konum, TCK 329 ve 336 anlamında "niteliği itibarıyla gizli" bilgi sayılabilir mi? Gizliliğini yitirmiş bilgi savunması ne kadar güçlü? (Doktrin: Askerî Yargıtay 2. D., 9.12.1987, E. 1987/762, K. 747.) Süzgeç bir uçağı kaçırırsa taksirli hâl (329/3, 336/3, 338) doğar mı? A12–A15 yeterli özen sayılır mı?
2. Askerî ya da devlet uçaklarının hareketlerini açıklamayı yasaklayan, yayımlanmış ya da yayımlanmamış bir düzenleme var mı? Yayımlanmamış bir yasak herkesi bağlar mı? TC- tescilli Cumhurbaşkanlığı uçakları 2920 md. 3/c'ye göre devlet hava aracı mı?
3. Polis, jandarma, gümrük, Sahil Güvenlik, MİT ve OGM yangın uçaklarından hangileri varsayılan gizli olmalı? Yangın uçaklarında kamu yararı ağır basar mı? MİT Kanunu md. 27 bizim için risk mi?
4. 2565'teki "harita uygulaması" yasağı Esri uydu altlığına ve askerî bölge çevresindeki uçak izlerine uygulanır mı? İncirlik soruşturmasındaki "yayın, çekimin devamıdır" yaklaşımı haritadaki konum gösterimine uzanır mı? Genelkurmay izni bugün kimden alınır?
5. Mahkeme yayın yasakları ve OHAL ya da seferberlik tedbirleri otomatik veri yayımlayan bir siteyi bağlar mı? Bunlardan haberdar olmanın resmî bir kanalı var mı, KEP gerekir mi?
6. SHGM, DHMİ ya da MSB'den proaktif yazılı görüş istemek güvence mi sağlar, yoksa dikkat mi çeker?

**5651**

7. Gelir yokken site "ticari veya ekonomik amaçlı" sayılır mı? Gerçek kişi için asgari künye ne? Ev adresi yerine sanal ofis ya da KEP adresi yeter mi; VKN ve telefon zorunlu mu? Hostinger'ın hangi tüzel kişisi yazılmalı? 2007 tarihli Yönetmelik 7590'dan sonra da geçerli mi?
8. 7590'dan sonra 8/A kararını kim veriyor? Bildirim hangi kanaldan gelir (e-posta, KEP)? VPS yurt dışındayken tebligat nasıl işler, itiraz yolu ne? Yorumlar çelişiyor (euronews ve BirGün, Temmuz 2026).
9. 5651 md. 9 iptal edildikten sonra uçak sahibinin kaldırma talebinde bugünkü yol ne (TMK 24–25, ihtiyati tedbir, 7571)? Kaç saat içinde yanıt vermeliyiz?
10. VPS başka projelerle paylaşılıyor. 5651 md. 5/6'daki yer sağlayıcı yükümlülüğü bize düşer mi? (3. kolun R11 riski: [TAHMİN] ≈0,95–9,5 milyon TL.)

**KVKK**

11. Hex, tescil ve konum izi ne zaman kişisel veri sayılır? Türk sivil hava aracı sicili kamuya açık mı? Mevzuat gereği yapılan ADS-B yayını alenileştirme (md. 5/2-d, 28/2-b) sayılır mı?
12. Uçak sahipleri için herkese açık bir aydınlatma metni Aydınlatma Tebliği md. 6'yı karşılar mı?
13. Yurt dışı aktarım:
    - Hostinger, Web Push servisleri, Expo, SMTP, Turnstile ve Sentry için hangi md. 9 mekanizması kullanılmalı?
    - Bu firmalar standart sözleşmeyi imzalamazsa veriyi Türkiye'ye taşımak mı gerekir?
    - Esri ve OpenFreeMap karo istekleri ile adsb.lol'e giden `/v2/hex` takip istekleri aktarım mı sayılır?
14. Diğer KVKK soruları:
    - Savunulabilir en uzun saklama süreleri neler?
    - Askerî izleri hiç tutmama ya da silme yükümlülüğü var mı (TCK 339)?
    - Analizdeki `localStorage` kimliği için dayanak ne olmalı?
    - Gizleme talebinde hangi kimlik doğrulaması orantılı sayılır?
    - Ücretli uzun geçmiş özelliği denge testini değiştirir mi?
    - İngilizce sürüm ve AB havalimanı sayfaları GDPR açısından AB'yi hedeflemek sayılır mı (md. 3(2)(a) ve md. 27)?

**ODbL, telif ve üçüncü taraf şartları**

15. ODbL:
    - Canlı ve geçici bir kaynaktan türeyen veritabanı için md. 4.6(b)'deki yöntem belgesi yeterli mi, yoksa döküm mü gerekir?
    - Hız limiti ve ücretli anahtar md. 4.7c'deki erişim denetimi mi, yoksa 4.7b'deki kısıtsız kopyayı gerektiren teknik önlem mi?
    - Engel listesi ve PIA/LADD maskelemesi yöntem belgesinde ayrıntısız anlatılabilir mi?
    - Kullanım koşullarındaki kötüye kullanım kuralları ODbL'yi kısıtlamadan nasıl yazılır?
    - FSEK ek md. 8 ihlalinin bugünkü yaptırımı ne?
    - adsb.lol'ün tazminat maddesinin kapsamı ne?
16. AIP olgularını yalnız iç süzgeçte kullanmak (GEN 0.1 §5, FSEK ek md. 8) ve DHMİ adlarını kullanmak izin ister mi?
17. Hava durumu ve Esri:
    - MGM'nin ürettiği METAR ve TAF'ları AWC üzerinden ticari bir sitede göstermenin MGM, ICAO ya da WMO tarafında bir kısıtı var mı?
    - Esri E204 §3.1b.5 (rakip ürün) ve §3.1c.1'in güncel metni teyit edilsin; PDF bugün açılamadı.

**Ticari dönem ve işletme**

18. Ücretli plan:
    - Cayma istisnası bir SaaS aboneliğine uygulanır mı; onay nasıl alınır?
    - Aylık ödemede kullanılmayan günler için kısmi iade gerekir mi?
    - Ücretsiz denemeden ücretliye geçiş nasıl kurulmalı?
    - Push ile tanıtım ticari elektronik ileti sayılır mı; yalnız hizmet bildirimi gönderirken İYS kaydı gerekir mi?
19. İşletme:
    - Şahıs işletmesi mi, limited şirket mi: sorumluluk açısından fark ne? Vergi tarafı mali müşavire.
    - "airline" genel bir sözcük: marka tescili ve haksız rekabet riski ne?
    - Kendi alıcı için 5809 md. 51/2 bakımından BTK'nın yazılı görüşü yeterli mi?
20. Kullanım koşulları, gizlilik metni, uçak verisi aydınlatması ve analiz bandı tek seferde incelenebilir mi?

---

## F. Operasyon adımları (kim, ne zaman)

### F1. Marka geçişiyle birlikte (şimdi; SSL kurulumu sürerken)

| Adım | Kim |
|---|---|
| info@airline.live kutusu: telefonda anlık bildirim, hukuk@ ve abuse@ takma adları, yedek adrese yönlendirme | Kullanıcı |
| Künye bilgilerine karar: ad soyad, adres türü (ev, sanal ofis ya da KEP; E7), telefon, VKN; Hostinger tüzel kişisinin adı ve adresi (Hostinger sözleşmesinden) | Kullanıcı |
| `/iletisim` (künye) sayfası: ana sayfadan tek tık, alt bilgide ve harita atıf satırında bağlantı, TR/EN | Kod |
| Esri: location.arcgis.com'da anahtarın referrer listesine `https://airline.live/*` ve `https://www.airline.live/*` eklenir; eklenmezse uydu yeni alan adında çalışmaz | Kullanıcı |
| Yeni markaya göre değişenler: UA, `CONTACT_EMAIL` değeri, ATTRIBUTION.md, kullanım koşullarındaki site adı, OpenAPI başlığı ("havayolu API"). Atıf metinleri değişmez | Kod; env değerini kullanıcı Dokploy'a girer |

### F2. Canlı katman açılmadan önce: kod işleri (tek ya da iki küçük sürüm)

1. **Süzgeçler:**
   - İkinci katman askerî süzgeç (A12)
   - Devlet ve VIP listesi; engel listesine tescil ile ekleme (A13)
   - Coğrafi süzgeç (A14)
   - Worker'da süzme ve geçmişten silme (A15)
2. **Admin kriz modu ve işlem kaydı** (A3). `docs/RUNBOOK.md`'ye iki bölüm: "8/A, mahkeme ya da yayın yasağı bildirimi" ve "KVKK veri ihlali".
3. **ODbL:** `/acik-veri` (A4); API ve WS lisans alanları; OpenAPI `info.license`; OG görsellerine atıf (A5).
4. **KVKK sayfaları:** `/gizlilik`, çerez aydınlatması ve uçak verisi aydınlatma metni; denge testi belgesi (A7). Taslakları ajan yazar, yayından önce avukat onaylar.
5. **Saklama:** Üst sınır ve imha işi (A9).
6. **Kullanım koşulları:** B10 maddeleri eklenir ve yürürlük tarihi güncellenir.
7. **Kayıt ve testler:** Kararlar DECISIONS'a, filtre testleri koda (B11).

### F3. Canlı katman açılmadan önce: kullanıcının dış adımları

1. **Avukat görüşmesi:** E'deki sorular ve F2'deki metin taslakları.
2. **Hostinger:** Destek kanalından KVKK standart sözleşmesi istenir ve imzalanır. İmzalar tamamlandıktan sonra 5 iş günü içinde Kuruma bildirilir; bildirim kanalı Kurumun sitesinden teyit edilir. Push, SMTP, Turnstile ve Sentry kullanılıyorsa aynısı yapılır (A8).
3. **adsb.lol e-postası:** info@adsb.lol'e gönderilir, yanıt saklanır (A6; ACTIVATION 1. adım).
4. **Son adım, açılış:** Dokploy'da `CONTACT_EMAIL=info@airline.live` girilir ve yeniden deploy edilir. hy-worker-rt çekime başlar (ACTIVATION 2. adım). Admin'de Servisler ekranındaki "Canlı veri · adsb.lol" satırı "Çalışıyor" olmalı.

### F4. Yayındayken (sürekli)

- **Günlük:** info@airline.live izlenir. 8/A ve mahkeme kararlarında 4 saat içinde uygulanır ve işlem kaydedilir.
- **Kriz anında** (darbe girişimi, saldırı, kaza, OHAL, yayın yasağı): kriz modu açılır, ilgili bölge ya da canlı katman kapatılır, haberler izlenir.
- **Gizleme talepleri:** Birkaç saat içinde işlenir; KVKK başvurularının yasal sınırı 30 gündür.
- **Haftalık:** Erişim engeli durumu sorgulanır (B17). adsb.lol'ün şartları ve 401/403 yanıtları izlenir; şart değişirse DUR-SOR 3.
- **Veri ihlali:** 72 saat içinde Kurula ve ilgililere bildirilir (A10).

### F5. info@airline.live'tan gönderilecek e-postalar

| # | Kime | Ne zaman | Zorunlu mu | Konu |
|---|---|---|---|---|
| 1 | info@adsb.lol | `CONTACT_EMAIL`'den önce | Evet (pratikte) | Uygulamanın tanımı, istek bütçesi, yeni UA, ücretli özellik planı, ODbL uyum planı. Sorular: ücretli özelliklere itiraz var mı, anahtar planları ve zamanı, tercih ettikleri atıf biçimi |
| 2 | Hostinger desteği (bilet ya da e-posta) | Açılıştan önce | Evet (KVKK md. 9) | KVKK standart sözleşmesi (veri sorumlusundan veri işleyene) talebi |
| 3 | KVK Kurumu | İmzadan sonra 5 iş günü içinde | Evet | Standart sözleşme bildirimi; kanal Kurumun sitesinden teyit edilir |
| 4 | Avukat | Açılıştan önce | Önerilir | E'deki sorular ve metin taslakları |
| 5 | BTK | Yalnız kendi alıcıdan önce | İsteğe bağlı | Yalnız alıcı ADS-B cihazı için izin ve 5809 md. 51/2 görüşü (taslak `track3.md` §9). Adres BTK'nın resmî iletişim sayfasından alınır |
| 6 | DHMİ | Yalnız AIP türevi bir özellik planlanırsa | İsteğe bağlı | Yazılı izin |
| 7 | SHGM, DHMİ, MSB | Avukat önerirse | Şimdilik gönderilmez | Proaktif görüş (E6) |
| 8 | info@openfreemap.org, sdm@noaa.gov | Gerekmez | Hayır | Yalnız toplu çevrimdışı indirme ya da AWC engeli olursa |

Esri referrer ayarı e-posta değildir; konsolda yapılır (F1).

### F6. Kullanıcının karar vermesi gerekenler

- Künyede hangi adresin yazılacağı (avukatla).
- VIP ve devlet listesinin onayı; orman yangını uçaklarının gösterilip gösterilmeyeceği.
- B7: ticari olmayan uçaklarda varsayılan olarak yalnız tip ve konum.
- B8: kriz modunda gecikme süresi.
- B13: uydu katmanının yalnız kullanıcı açınca yüklenmesi.
- Saklama süreleri (A9).
- Kullanıcı verisini Türkiye'de tutmak (A8 alternatifi; DUR-SOR 5).
- Proaktif resmî görüş istenip istenmeyeceği (E6).

### F7. Açılış kapısı (hepsi işaretlenmeden `CONTACT_EMAIL` girilmez)

- [ ] Künye yayında; info@airline.live telefonda izleniyor (A1, A2)
- [ ] Kriz modu ve 8/A runbook'u hazır; admin telefondan denendi (A3)
- [ ] `/acik-veri` yayında; API, WS ve OG atfı tamam (A4, A5)
- [ ] adsb.lol e-postası gönderildi; UA yeni markada (A6)
- [ ] `/gizlilik`, çerez aydınlatması ve uçak verisi aydınlatması yayında, avukattan geçti (A7)
- [ ] Hostinger standart sözleşmesi imzalandı ya da süreci başladı; avukat aktarım yolunu seçti (A8)
- [ ] Saklama üst sınırı ve imha işi çalışıyor (A9)
- [ ] İkinci katman askerî süzgeç, VIP ve devlet listesi ile coğrafi süzgeç testli; worker'da süzme açık (A12–A15)
- [ ] Kullanım koşulları güncellendi (B10)

## Doğrulanamayanlar (özet)

- **VIP filo listesi:** Basından; kaynaklar çelişkili.
- **Türk sivil ICAO bloğu (4B8000–4BFFFF):** Doğrulanmadı. Repodaki 22 TC- kaydı 4b87…–4bb8… arasında; bu tutarlı, ama kanıt değil.
- **TRK çağrı kodu öneki:** VIP uçuşlarda kullanılıp kullanılmadığı bilinmiyor.
- **TUSAŞ ve Baykar:** ICAO tanıtıcıları doğrulanmadı.
- **Ortak kullanımlı havalimanları:** AIP AD 2 listesi çıkarılmadı.
- **Okunamayan metinler:**
  - 1402 sayılı Kanun (mevzuat.gov.tr 404 verdi)
  - 2024 Seferberlik Yönetmeliği
  - KVKK karar 2019/10
  - FAA LADD/PIA sayfaları (403)
  - Esri E204 PDF'i (şifreli)
  - AYM 2015/18567 kararının resmî metni
- **Yalnız arama özetinden okunanlar:** SHY-Gözetim; 7590'daki üç aylık devir süresi; İYS ayrıntıları.
- **Ceza tutarları:** 5651 için 2026 tutarları [TAHMİN]; KVKK 2026 tutarları [İKİNCİL].
- **Erişim engeli emsali:** Flightradar24'e Türkiye'de erişim engeli getirildiğine dair kayıt bulunamadı. EngelliWeb arşivi taranamadığı için bu, engelin olmadığını kanıtlamaz.
