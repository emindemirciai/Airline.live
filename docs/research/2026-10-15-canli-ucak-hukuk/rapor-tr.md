# Canlı uçakları göstermek: ceza yememek için yapılacaklar

- **Tarih:** 2026-10-15
- **Site:** Airline.live (airline.live; eski alan adı havayolu.live 308 ile buraya yönleniyor)
- **Dayanak:** Beş araştırma kolu (`legal/track1.md` … `track5.md`), sentez (`legal/synthesis.md`) ve şüpheci bir hukukçu gözüyle yazılmış eleştiri (`legal/critique.md`). Bu rapor için web'e yeniden çıkılmadı. Kaynaklar araştırma kollarında okundu. En kritik maddeler yerel kopyalardan yeniden okundu: TCK 136, 329, 336 ve 338; 5651 md. 8/A ve 9/A (`legal/src/`). Repo yalnız okundu.
- **Uyarı: Bu bir araştırmadır, hukuki görüş değildir.** Yayından önce bilişim ve ceza hukuku bilen bir avukat incelemelidir. "Zorunlu" dediğim maddeler de avukat onayından geçmelidir.
- **İşaretler:**
  - [BELİRSİZ]: kaynak eksik ya da çelişkili
  - [TAHMİN]: hesaplanmış tutar ya da tahmin
  - [İKİNCİL]: resmî metin değil, ikincil kaynak
- **"Kim" etiketleri:** **Sen** = kendin yaparsın · **Kod** = ajan yazar, sen onaylarsın · **Avukat** = avukat bakar.

---

## 1. Kısa sonuç

1. **DHMİ ve SHGM'nin bir web sitesine ceza kesme yetkisi görünmüyor.** Uçuş takip sitesine özgü bir izin ya da lisans bulunamadı. 2920 sayılı Kanun "havacılık sahasındaki faaliyetleri" kapsıyor; bir uçuş takip sitesi bunlardan biri değil (yorum). Bu "izin gerekmez" kesinliği değildir, "bulunamadı" demektir. Asıl muhataplar başkaları: savcılık, Siber Güvenlik Başkanlığı (5651'deki yetki 7590 sayılı Kanunla BTK'dan buraya geçti; kabul 24.07.2026, yürürlük 31.07.2026), KVK Kurumu, sulh ceza hâkimliği, suç duyurusu yoluyla MSB ve MİT.
2. **En büyük risk, askerî, devlet ya da VIP uçağın görünmesi.** Bugün bunu engelleyen tek şey adsb.lol'ün askerî biti. Bit yoksa uçak görünür. Gizli bilgiyi taksirle açıklamanın cezası 6 ay–2 yıl. Fiil askerî hareketleri tehlikeye sokarsa 3–8 yıl (TCK 329/3, 336/3). Mahkûmiyet olasılığı düşük. Ama kriz anında soruşturma olasılığı gerçek, ve soruşturmanın kendisi ağır bir yük (gözaltı, bilgisayara el koyma).
3. **En olası yaptırım erişim engeli ve para cezası.** 5651 md. 8/A kararı 4 saat içinde uygulanmalı; uygulanmazsa 50.000–500.000 TL. Canlı veri tek bir API/WS ucundan aktığı için engel bütün alan adına ya da IP'ye gelebilir. VPS başka projelerle paylaşıldığı için onlar da etkilenebilir.
4. **Özel uçaklar KVKK ve TCK 136 konusudur.** Hukuki dayanak "meşru menfaat"tir ve yazılı bir denge testi ister. En güvenli başlangıç: ticari olmayan uçaklarda kimlik, takip ve bildirim kapalı. Kolay bir gizleme talebi yolu şart. Yoksa uçak sahibi 5651 md. 9/A ile 4 saatte URL engeli aldırabilir.
5. **Bazı işler canlı veriden bağımsız, bugünden geçerli:** künye, `/gizlilik` sayfası, yurt dışı aktarım ve kullanım koşullarındaki mutlak "askerî uçaklar gösterilmez" sözü. Canlı katman, Dokploy'a `CONTACT_EMAIL` girilince açılır. Bölüm 2.3'teki kapı tamamlanmadan girme.

---

## 2. Yayından önce yapılması gerekenler

### 2.1 Şimdi: bir sonraki küçük sürüm (canlı katmandan bağımsız)

**Ş1. Kullanım koşullarındaki mutlak sözü düzelt**
- **Ne:** Bugün dört yerde "Askeri uçaklar haritada, aramada ve API'de gösterilmez." yazıyor: `packages/i18n/src/messages/tr.ts:816` ve `:1350`, `en.ts:670` ve `:1144`. Kod bu sözü yalnız adsb.lol'ün askerî bitiyle tutuyor. Açık kendi belgelerimizde yazılı.
- **Yeni metin örneği:** "Askerî ve devlet uçaklarını tespit kurallarımızla gizleriz. Bu kurallar kusursuz değildir. Görünmemesi gereken bir uçak görürseniz bize bildirin."
- **Dayanak ve risk:**
  - Bilinen bir açığa rağmen verilen mutlak söz, soruşturmada "açığı biliyordu" kanıtına dönüşebilir. Bilinçli taksirde ceza üçte birden yarıya kadar artar (TCK 22/3).
  - Kullanıcıyı yanıltan bir beyandır.
- **Kim:** Kod.

**Ş2. Künye (İletişim) sayfası**
- **Ne:**
  - Ana sayfadan tek tıkla ulaşılan "İletişim" sayfası: ad soyad, yerleşim yeri adresi, e-posta, telefon.
  - Hostinger'ın unvanı ve adresi her sayfanın alt bilgisinde de dursun, ana sayfa dahil. Bir okumaya göre Yönetmelik yer sağlayıcı bilgisini ana sayfada istiyor; alt bilgi iki okumayı da karşılar.
  - Harita atıf satırından ve alt bilgiden bağlantı. TR ve EN.
- **Dayanak:** 5651 md. 3/2; Usul ve Esaslar Yönetmeliği md. 5 [İKİNCİL yayıncı].
- **Ceza:** 2.000–50.000 TL (kanundaki tutar) [TAHMİN 2026: ≈39.694–993.503 TL].
- **Belirsiz noktalar** [BELİRSİZ]:
  - Yönetmelik "ticari veya ekonomik amaçlı" siteleri sayıyor; bugün gelir yok. Ücretli plan geleceği için şimdi yapmak güvenli.
  - Gerçek kişi için VKN'nin zorunlu olduğu açık değil.
  - Ev adresi yerine sanal ofis adresinin yetip yetmediği belli değil.
- **Kim:** Sen (bilgiler; adres türünü avukatla seç); Kod (sayfa ve bağlantılar).

**Ş3. Resmî bildirim kanallarını telefondan izle**
- **Neden:** 8/A'daki 4 saat bildirim anında başlar. Bildirim sitede görünen herhangi bir e-postaya, alan adının WHOIS adresine ya da IP'den bulunan adrese gelebilir.
- **Yapılacaklar:**
  - info@airline.live ve sitede görünen her adres için telefonda anlık bildirim
  - hukuk@ ve abuse@ takma adları aynı kutuya düşsün
  - WHOIS adresi (gizlilik vekili varsa yönlendirmesi) çalışıyor mu, kontrol et
  - Hostinger hesap e-postası ve abuse kanalı (Hostinger bir şikâyet üzerine VPS'i askıya alabilir)
  - Alarm kuralı: gönderen `gov.tr` ya da `esb.org.tr` ise, ya da metinde "8/A", "erişimin engellenmesi" veya "karar" geçiyorsa telefon çalsın.
- **Yapma:** E-posta gelince canlı katmanı otomatik kapatma. Sahte bir e-postayla siteyi durdurmak kolaylaşır.
- **Dayanak:** 5651 md. 3/3 ve md. 6/A-11.
- **Kim:** Sen.

**Ş4. `/gizlilik` ve çerez aydınlatması (site ziyaretçileri için)**
- **Neden:** Site bugün de ziyaretçi verisi işliyor: loglar, onaylı analiz, admin.
- **İçerik:**
  - veri sorumlusunun kimliği (gerçek kişi olarak sen)
  - amaçlar ve hukuki sebepler
  - aktarımlar: Hostinger; Esri ve OpenFreeMap karoları (OpenFreeMap tarafında Cloudflare); push servisleri
  - haklar ve başvuru yolu: 30 gün içinde, ücretsiz
  - her çerez ve yerel depolama öğesinin adı, amacı, süresi ve birinci ya da üçüncü taraf olduğu (Çerez Rehberi, Temmuz 2025)
- **Kurallar:** Aydınlatma metni "kabul" ettirilmez; rıza ayrı alınır. Başka bir sitenin metni kopyalanmaz (Kurul ilke kararı 2026/347).
- **Dayanak:** KVKK md. 10; Aydınlatma Tebliği.
- **Ceza:** 85.437–1.709.200 TL (2026) [İKİNCİL].
- **Kim:** Kod (taslak ve sayfa); Avukat (onay).

**Ş5. Yurt dışı aktarım için bir yol seç (KVKK md. 9)**
- **Durum:** Hostinger'ın Türkiye'de VPS veri merkezi yok. Kurum, yurt dışındaki sunucuda depolamayı "aktarım" sayıyor.
- **Seçenekler:**
  - Hostinger ile Kurulun standart sözleşmesi, hiç değiştirilmeden. İmzalar tamamlanınca 5 iş günü içinde Kuruma bildirilir. Push, Expo, SMTP, Turnstile ve Sentry için de aynısı.
  - Kişisel veriyi Türkiye'de tutmak. Bu mimari bir değişiklik; senin onayın gerekir (DUR-SOR 5).
  - Açık rıza yalnız arızi aktarımda geçer, sürekli aktarıma dayanak olmaz (Yönetmelik md. 16).
- **Dikkat:**
  - Canlı katman aktarılan verinin kapsamını büyütür. Türk tescilli özel uçakların izleri de yurt dışındaki sunucuya yazılır.
  - Hostinger'ın metni değiştirmeden imzalaması belirsiz [TAHMİN]. B planını şimdiden düşün.
  - "Süreci başlattım" uyum sayılmaz.
- **Ceza:** Standart sözleşmeyi bildirmemek 90.308–1.806.377 TL [İKİNCİL]. Güvencesiz aktarımın hangi bende düşeceği [BELİRSİZ].
- **Kim:** Sen ve Avukat.

**Ş6. VERBİS muafiyetini yazıya geçir**
- **Ne:** Yarım sayfalık not: çalışan sayısı, bilanço, ana faaliyetin özel nitelikli veri işlemek olmadığı. Kurul kararına göre yıllık çalışanı 50'den, bilançosu 100 milyon TL'den az olanlar muaf (RG 01.10.2025/33034) [İKİNCİL].
- **Neden:**
  - Kayıt yükümlüsü olup kaydolmamanın cezası 2026'da 341.809 TL'den başlıyor [İKİNCİL].
  - Muafsan saklama ve imha politikası zorunlu değil (İmha Yönetmeliği md. 5). Süresi dolan veriyi silme yükümlülüğü ise sürer.
- **Kim:** Kod (taslak); Sen (onay).

### 2.2 Canlı katman açılmadan önce

**K1. Süzmeyi worker'a taşı ve kuralları çoğalt**
- **Neden:**
  - adsb.lol kendini "unfiltered" (süzgeçsiz) olarak tanımlıyor. Yanıtta `dbFlags` yoksa değer 0 sayılıyor ve uçak görünüyor (`packages/providers/src/live/response.ts:12` ve `:122`; `packages/providers/src/aircraft.ts:120-122`).
  - Süzme bugün yalnız API'de yapılıyor (`apps/api/src/live/record.ts`). Worker askerî uçağı da redis-live'a ve iz tablolarına yazıyor; iz tablosunda `dbFlags` yok (`docs/DECISIONS.md:399`).
  - İçerik sağlayıcı her içerikten sorumludur (5651 md. 4/1). "adsb.lol'ün verisini yalnızca aktarıyoruz" savunması yok.
- **Ceza riski:**
  - TCK 329/3 ve 336/3: taksirle açıklama 6 ay–2 yıl; askerî hareketleri tehlikeye sokarsa 3–8 yıl.
  - TCK 338: Özen eksikliği yüzünden bu bölümdeki suçlar (ör. casusluk) "mümkün olmuş veya kolaylaşmış" ise 6 ay–3 yıl; askerî hareketlerde 3–8 yıl. Örnek senaryo: yabancı biri API'mizden ya da geçmiş oynatmadan askerî uçuş bilgisi toplar. "İlgili kişiler" ifadesi yalnız bilgiyi korumakla yükümlüleri kapsayacak biçimde dar okunabilir [BELİRSİZ].
  - MİT Kanunu md. 27/3: MİT'in faaliyetlerini internetten ifşa etmek 3–9 yıl. MİT uçaklarının hareketi "faaliyet" sayılabilir [BELİRSİZ].
  - Sunucunun yurt dışında olması korumaz (TCK 8 ve 13/1-b).
- **Kurallar.** Hepsi her kanalda geçerli: harita, API, WS, arama, takip (`/v2/hex`), bildirim, OG görseli, uçuş sayfası, geçmiş, oynatma.
  1. **adsb.lol askerî biti** (var).
  2. **VRS code-blocks askerî aralıkları.** Kaynak CC0 ve zaten izinli. Yaklaşık 414 aralık var; Türkiye'nin askerî bloğu 4B8200–4B82FF.
  3. **Askerî çağrı kodu önekleri:** HVK, TUAF, ASENA. Öbür ülkelerinkiler VRS'ten alınır. TRK aday [BELİRSİZ]: VRS'te "Turkish Airlines General Aviation" olarak geçiyor (`tools/fixtures/vrs/airlines.csv:5288`).
  4. **Devlet ve VIP listesi:** Cumhurbaşkanlığı ve VIP filo, MİT, EGM, Jandarma, Sahil Güvenlik, gümrük.
     - Engel tescile ve hex'e birlikte uygulanır.
     - Çağrı koduna güvenilmez: TC-ATA 2016'da THY çağrı koduyla uçtu.
     - Aday tescil listesi basından, doğrulanmadı. Listeyi sen onaylarsın.
     - Orman yangını uçaklarının durumu avukata sorulur.
  5. **MLAT ve TIS-B:** Sivil kimliği doğrulanmayan, havayolu dışı uçağın hesaplanmış konumu gösterilmez. Kendi konumunu yayımlamayan bir uçağın konumunu göstermek, "gizli bilgi" tartışmasında en zayıf noktamızdır.
  6. **Yayıcı kategorileri:** Yer araçları ve engeller (C1–C5) ile İHA (B6) gizlenir [BELİRSİZ: kodlar DO-260B ve readsb belgelerinden doğrulanmalı].
  7. **Ambulans helikopterleri ve hasta taşıyan uçuşlar gizlenir.** Hasta taşıması sağlık verisine dönüşebilir (KVKK md. 6).
  8. **Coğrafi süzgeç:** Askerî alanların çevresinde alçakta ya da yerde görünen havayolu dışı uçak gizlenir.
     - D-107'deki beş üs yetmez; onlar yalnız IATA kodlu olanlar. Liste OurAirports'un askerî satırlarından (kamu malı) ve ortak kullanımlı ana üslerden çıkarılır.
     - LTP yasak sahaları irtifaya bağlanır. LTP2 8.000 ft'in altında bütün trafiğe kapalı, üstünde IFR'ye açık. LTP6 (Ankara) ve LTP7 (İmralı) ambulans helikopterleri ve TUSAŞ eğitim uçakları için muaf (AIP ENR 5.1, 01 OCT 26).
     - Bilinen açık: Üsse inen, askerî biti olmayan uçak "İnişte AOE" olarak görünüyor (`docs/spec/domain.md:90`).
  9. **Kaynakta süzme:** Askerî, devlet ve engel listesindeki uçaklar redis-live'a ve iz tablolarına yazılmaz; bildirimi ve geçmişi tutulmaz. Kapsama raporu için yalnız kimliksiz sayı tutulur. Engel listesine eklenen uçağın geçmişi silinir.
- **Listelerin yeri:** Veritabanında ya da yalnız çalışma anında okunan yapılandırmada. Koda gömülmez: GHCR paketleri herkese açık (D-068), koda giren liste imajla birlikte yayımlanmış olur. İstemciye de gitmez.
- **Testler:** HVK çağrı kodu, VRS askerî aralığı, LTP içinde alçak uçak, askerî biti olmayan üs inişi. Kurallar DECISIONS'a yazılır; bu özenin kanıtıdır.
- **Kim:** Kod; listeler ve kapsam için Sen.

**K2. Kapatma düğmesi, kriz modu ve runbook**
- **Dayanak ve ceza:**
  - **5651 md. 8/A:** Millî güvenlik, kamu düzeni gibi gerekçelerle kaldırma ya da erişim engeli.
    - 4 saatte uygulanmazsa 50.000–500.000 TL [TAHMİN 2026: ≈0,9–9,0 milyon TL].
    - URL bazında engelleme teknik olarak yapılamazsa bütün site engellenebilir.
    - İçerik suç oluşturuyorsa Başkan savcılığa suç duyurusunda bulunur (fıkra 4).
    - Hâkim kararıyla istenen fail bilgisini vermemek 3.000–10.000 gün adli para cezası.
  - **5651 md. 9/A:** Özel hayat gerekçesiyle URL engeli, 4 saat içinde.
  - **7545 md. 16/1:** Yetkili mercinin istediği bilgi, belge veya veriyi vermemek 1–3 yıl.
  - **MİT Kanunu md. 28:** MİT'in taleplerini yerine getirmemek 2–4 yıl.
  - **Yayın yasakları ve olağanüstü dönem:** mahkeme yayın yasakları (pratikte 5651 yoluyla kaldırma ve engel gelir); OHAL tedbirleri (2935 md. 11/e-f, ihlali 1–6 ay); seferberlik ve savaş (2941 md. 3 ve 18; cezalar seferberlikte iki, savaşta üç katına çıkar).
- **Admin'de olması gerekenler** (telefondan, dakikalar içinde):
  - canlı katmanı tek dokunuşla kapatma
  - hex ve tescil engeli
  - bölge karartma (çokgen ya da yarıçap, süreli)
  - çağrı kodu desenini gizleme
  - havayolu dışındaki bütün uçakları gizleme
  - bildirimleri durdurma
  - geçmişten silme
  - işlem kaydı: kim, ne zaman, hangi karar üzerine
- **İkinci kişi:** Güvenilir birine yalnız kapatma yetkisi ver ve birlikte bir kez dene. Uyurken, uçakta ya da hastayken 4 saati tek başına tutturamazsın.
- **Kriz modunu açan durumlar yazılı olsun:** terör saldırısı, darbe girişimi, askerî uçak kazası, sınır ötesi harekât, OHAL, seferberlik, mahkeme yayın yasağı.
- **Varsayılan eylem önceden seçilsin:** Türkiye hava sahasında havayolu dışı bütün uçakları gizlemek ya da canlı katmanı kapatmak. Böylece karar anında tartışma çıkmaz.
- **Runbook (`docs/RUNBOOK.md`) bölümleri:**
  - 8/A ya da 9/A kararı geldi
  - mahkeme kararı ya da yayın yasağı
  - Siber Güvenlik Başkanlığı ya da MİT'ten bilgi talebi
  - KVKK veri ihlali: Kurula ve ilgililere bildirim; Kurul bu süreyi 72 saat olarak yorumluyor [BELİRSİZ: karar metni açılamadı]
- **Delil kuralı:**
  - Silme işleri önceden yazılı ve otomatik olur.
  - Resmî talep gelince yalnız ilgili kayıtlar dondurulur. Talep silmeyi istiyorsa silinir. Hangisi yapıldıysa kaydedilir.
  - Soruşturmadan sonra seçerek silmek TCK 281 (delil yok etme) riski taşır.
- **Kim:** Kod (admin, API, worker, runbook taslağı); Sen (ikinci kişiyi seçer, deneme yapar).

**K3. Özel uçaklarda temkinli varsayılanlar**
- **Önerim:** Ticari olmayan uçaklarda, en azından TC- tescilli özel uçaklarla LADD ve PIA uçaklarında:
  - tescil, sahip ve hex gösterilmez (adreste opak bir kimlik kullanılır)
  - takip ve bildirim kapalı
  - ince iz tutulmaz; uçuş sayfası ve geçmiş kapalı
  - yalnız tip ve konum görünür. FlightAware Avrupa'da buna benzer bir kural uyguluyor.
- **Dayanak:**
  - KVKK md. 4 (ölçülülük) ve md. 5/2-f (meşru menfaat). Madde "zorunlu olması" ve "temel hak ve özgürlüklere zarar vermemek" şartı koyuyor; GDPR'dan serttir. Yarım sayfalık yazılı denge testi gerekir.
  - TCK 136: kişisel veriyi hukuka aykırı yaymak 2–4 yıl. TCK 135: hukuka aykırı kaydetmek 1–3 yıl. İkisi de şikâyete bağlı değil (TCK 139).
  - İsveç IMY'nin Flightradar24 kararı (DI-2021-3397, 2025-06-30): meşru menfaati kabul etti. Yine de şikâyetçilerin uçaklarının yayından kaldırılmasını emretti ve rutin tescil belgesi istemeyi kınadı. Türk Kurulu bu karara bağlı değil.
  - Uçak sicili alenidir (2920 md. 51). Ama bu, "ilgilinin kendisinin alenileştirmesi" (KVKK md. 5/2-d) sayılmaz. Yalnız denge testinde işe yarar.
- **Uçak verisi aydınlatma metni:** Veri uçak sahiplerinden alınmadığı için herkese açık bir metin, en geç ilk yayımda (Aydınlatma Tebliği md. 6). Bunun yeterli olup olmadığı [BELİRSİZ].
- **Not:** Bu bir ürün kararıdır ve senin onayın gerekir. Takip ve bildirimi kapatmak ürünü daraltır. Avukat görüşünden sonra kademeli açılabilir.
- **Kim:** Sen (karar); Kod (uygulama, aydınlatma ve denge testi taslağı); Avukat (onay).

**K4. Gizleme talebi yolu**
- **Ne:**
  - Form ve e-posta; ücretsiz.
  - Tescil belgesi rutin olarak istenmez. Kurumsal e-posta ya da şirket belgesi yeter.
  - Engel hex'e ve tescile birlikte uygulanır, geçmişe de işler.
  - Hedef: birkaç saat.
- **Dayanak:**
  - 5651 md. 9/A: Uçak sahibi doğrudan Başkanlığa başvurabilir. Erişim sağlayıcılar 4 saatte URL engeli uygular; `/?hex=…` ve `/ucus/<id>` adresleri hedef olabilir. Talebi o noktaya varmadan karşılamak gerekir.
  - KVKK md. 11 ve 13: başvuru 30 gün içinde, ücretsiz sonuçlandırılır.
- **Kim:** Kod (form ve admin akışı); Sen (talepleri işlersin).

**K5. ODbL: `/acik-veri` sayfası ve lisans bildirimi her yerde**
- **Ne:**
  - `/acik-veri`: Türetilmiş veritabanının (canlı önbellek, iz tabloları, geçmiş) nasıl üretildiğini anlatan yöntem belgesi. Engel listesindeki hex'ler yayımlanmaz, yalnız kural anlatılır. Haritadan bağlantı verilir.
  - API ve WS (`/v1/live`, `/v1/search`, WS `snapshot`): `license`, `licenseUrl` ve `attribution` alanları. OpenAPI `info.license` ODbL'yi anar. Bugün bu bildirim yok.
  - Atıf ("ADSB.lol · ODbL 1.0", bağlantılı): uçuş sayfası, pano, geçmiş oynatma, OG ve paylaşım görselleri, bildirimin açtığı sayfa, mobil ekran, dışa aktarma dosyaları.
- **Dayanak:**
  - ODbL md. 4.2, 4.3 ve 4.6.
  - İhlalde lisans kendiliğinden sona erer (md. 9.1). İhlal durunca hak geçici olarak geri gelir; lisans veren aksini bildirmezse 60. günde kalıcı olur. İlk bildirimden sonra 30 gün içinde düzeltmek de hakkı geri getirir (md. 9.4).
  - Türkiye'de dayanak FSEK ek md. 8 (veritabanı hakkı). Yaptırımı [BELİRSİZ].
- **Kim:** Kod; yöntem belgesinin yetip yetmediğine Avukat bakar.

**K6. adsb.lol: bilgilendirme e-postası ve User-Agent**
- **Ne:**
  - UA: `airline.live/<sürüm> (+https://airline.live; info@airline.live)`.
  - info@adsb.lol'e e-posta: yeni marka, ücretli özellik planı, istek bütçesi (0,1–0,2 istek/sn), yeni UA, ODbL uyum planı. Gelen yanıtı sakla.
  - adsb.lol'ün OpenAPI açıklaması ileride API anahtarı isteneceğini söylüyor. Bunun için `docs/ACTIVATION.md`'ye bir adım eklenmeli.
- **Not:** "İletişim bilgisi olmayan UA'ya 403 dönüyor" iddiasının kaynağı olarak gösterilen bugünkü kaynak kodunda böyle bir denetim yok. Kural önündeki bir katmanda olabilir [BELİRSİZ]. İletişim bilgili UA yine de iyi uygulama.
- **Risk:** Erişimin kesilmesi; adsb.lol şartlarındaki tazminat maddesi.
- **Kim:** Sen (e-posta); Kod (UA).

**K7. Saklama üst sınırı ve otomatik silme**
- **Ne:**
  - `flights` ve `events` için bugün yalnız "en az 365 gün" yazıyor (`docs/spec/domain.md:210`). Bir üst sınır koy; öneri: 365 gün, sonra silme ya da anonimleştirme.
  - Kişisel loglar en çok 30 gün.
  - Silme işi otomatik ve testli olsun.
- **Ayrı tut:** Özeni kanıtlayan kayıtlar kişisel veri değildir ve uzun tutulur: filtre kurallarının sürüm geçmişi, yayın kayıtları (Dokploy, GitHub Release), admin işlem kaydı. Dava zamanaşımı 8 ya da 15 yıl (TCK 66).
- **Dayanak:** KVKK md. 4/2-d ve 7. Süresi dolan veriyi silmemek suçtur: TCK 138, 1–2 yıl (KVKK md. 17/2).
- **Kim:** Kod; süreleri Sen onaylarsın.

**K8. Kullanım koşullarını güncelle**
- **Eklenecekler:**
  - "Resmî havacılık bilgi kaynağı değildir; seyrüsefer ve operasyonel kararda kullanılamaz. Resmî kaynaklar DHMİ AIS ve MGM'dir."
  - "DHMİ, SHGM, MGM ve NOAA ile bağlantılı değildir."
  - Askerî, istihbarat ya da hedefleme amaçlı kullanım yasağı. Bu yasak yalnız *hizmete* (sitenin ve API'nin kullanımına) yazılır. `/acik-veri`'deki veri koşulsuz kalır; yoksa ODbL md. 4.7a ile çatışır.
  - Uygulanacak hukuk ve yetkili mahkeme.
  - TBK 115'e uygun sorumluluk sınırı. Ağır kusurdan sorumsuzluk anlaşması geçersizdir.
  - Kabul yöntemi (TBK 20–25); iletişim ve gizleme talebi bağlantıları.
  - Yürürlük tarihinin güncellenmesi.
- **Kim:** Kod (taslak); Avukat (onay).

**K9. Yazılı avukat görüşü**
- **Ne:** En az bölüm 6'daki "Öncelik 1" soruları. Ş4, K3, K5 ve K8'deki metin taslakları da birlikte gönderilir.
- **Kim:** Sen.

**K10. Ayrı IP kararı**
- **Neden:** Türkiye'deki erişim engelleri DNS, IP ya da SNI düzeyinde uygulanabilir. IP engeli aynı VPS'teki öbür projeleri de düşürür. Alan adı engellenirse `api.` ve `analiz.` alt alan adları da gider.
- **Seçenekler:** airline.live için ayrı bir IP ya da VPS; analiz uygulaması için ayrı bir alan adı. Ya da riski yazılı olarak kabul etmek.
- **Not:** Bu bir mimari ve maliyet kararı (DUR-SOR 5). Kapı için "karar verildi" yeter.
- **Kim:** Sen.

### 2.3 Açılış kapısı

Hepsi işaretlenmeden Dokploy'a `CONTACT_EMAIL` girme.

- [ ] Ş1: mutlak söz düzeltildi
- [ ] Ş2 ve Ş3: künye yayında; bütün bildirim kanalları telefonda
- [ ] Ş4: `/gizlilik` ve çerez aydınlatması yayında, avukattan geçti
- [ ] Ş5: yurt dışı aktarım yolu seçildi ve uygulanıyor
- [ ] Ş6: VERBİS notu yazıldı
- [ ] K1: worker'da süzme ve bütün kurallar testli; listeler imajda ve istemcide yok
- [ ] K2: kapatma düğmesi ikinci kişiyle denendi; runbook yazıldı
- [ ] K3: özel uçak varsayılanlarına karar verildi ve uygulandı; uçak verisi aydınlatması yayında
- [ ] K4: gizleme talebi yolu yayında
- [ ] K5: `/acik-veri` yayında; API, WS ve OG atfı tamam
- [ ] K6: adsb.lol e-postası gönderildi; UA yeni markada
- [ ] K7: saklama üst sınırı ve silme işi çalışıyor
- [ ] K8: kullanım koşulları güncellendi
- [ ] K9: Öncelik 1 soruları yazılı yanıtlandı
- [ ] K10: ayrı IP kararı verildi

**Son adım:** Dokploy'da `CONTACT_EMAIL=info@airline.live` girilir ve yeniden deploy edilir. hy-worker-rt çekime başlar. Admin'de Servisler ekranındaki "Canlı veri · adsb.lol" satırı "Çalışıyor" olmalı.

### 2.4 Daha sonra, kendi eşiğinde zorunlu olanlar

- **Ücretli plandan önce:**
  - vergi ve işletme kaydı (mali müşavir); KEP adresi
  - ETBİS kaydı, satıştan önce; e-ticaret künyesi
  - ön bilgilendirme formu, mesafeli hizmet sözleşmesi, abonelik sözleşmesi; cayma istisnası için ayrı onay
  - iptal yolu kayıttan zor olamaz; fiyatlar vergiler dahil gösterilir
  - kullanım koşullarındaki "ücretsiz" ifadesi değişir
  - ücret veriye değil özelliğe bağlanır (ODbL, D-011)
  - Ceza tutarları 6563 md. 12 ve 6502'de; her yıl değişiyor. Güncel tutarlar bu araştırmada doğrulanmadı; mali müşavirle teyit edilmeli.
- **Tanıtım iletisi göndereceksen:** önceden onay (kutu işaretli gelmez), onayların İYS'ye aktarılması, her iletide ret yolu. Yaklaşma ve iniş bildirimleri tanıtım içermedikçe hizmet bildirimidir (Ticari İletişim Yönetmeliği md. 6/2).
- **Kendi alıcıdan önce:**
  - BTK'dan yazılı görüş (5809 md. 37 ve 51/2).
  - Alıcı askerî yasak ya da güvenlik bölgesine kurulmaz. 2565 md. 7/1-e "cihaz kullanılması"nı da yasaklıyor.
  - Anten bir hava alanının yakınındaysa DHMİ mânia onayı gerekebilir [BELİRSİZ].
- **Parça 5'ten (ticari veri) önce:** ADS-B verisi ile ticari veri ayrı katmanda ya da ayrı veritabanında tutulur. ODbL'nin paylaşım şartı ile ticari sağlayıcıların yasakları çatışır.

---

## 3. Yapılması iyi olanlar

| # | Öneri | Not |
|---|---|---|
| İ1 | Türk ICAO bloğunda TC- ile başlamayan ya da tescili olmayan kayıtları varsayılan olarak gizlemek | Bloğun 4B8000–4BFFFF olduğu doğrulanmadı [BELİRSİZ]; önce VRS'ten çevrimdışı kontrol |
| İ2 | Savunma sanayii test uçuşlarını (TUSAŞ, Baykar) gizlemek | ICAO tanıtıcıları doğrulanmadı |
| İ3 | Herkese açık "Gizlilik ve güvenlik filtreleri" sayfası | Kurallar anlatılır, liste yayımlanmaz; taksir değerlendirmesinde özenin kanıtı olur |
| İ4 | Kriz modunda havayolu dışı uçakları N dakika gecikmeli göstermek | Senin kararın |
| İ5 | 7500, 7600 ve 7700'ü tarafsız dille göstermek; 7500 için anlık bildirim yapmamak | |
| İ6 | Analiz: IP maskeleme, ziyaretçi kimliğinin ömrünü sınırlama, onayın tarih ve sürümünü kaydetme | |
| İ7 | Uydu katmanını yalnız kullanıcı açınca yüklemek; karo isteklerini aydınlatmada yazmak | Senin kararın |
| İ8 | OpenFreeMap yedek altlığında `aerodrome_label` ve `landuse` katmanlarının `military` sınıfını süzmek | D-107 ile tutarlılık |
| İ9 | Askerî üslerin ICAO kodlarını istemci paketinden de çıkarmak | D-107'de adlar temizlendi, kodlar hâlâ istemcide. Bilgi kamuya açık, ama "hiçbir yerde" kuralıyla çelişiyor |
| İ10 | Erişim engeli durumunu haftada bir sorgulamak | Sorgu adresi 7590'dan sonra değişebilir [BELİRSİZ] |
| İ11 | `docs/spec/data-sources.md`'yi güncellemek | OpenFreeMap şartları 14.10.2026'da değişti: Cloudflare onayı, Macar hukuku, Budapeşte'de tahkim. Natural Earth: kamu malı |
| İ12 | Periyodik ODbL dökümü (md. 4.6a) | Avukat yöntem belgesini yetersiz bulursa ya da ücretli API açılırsa |
| İ13 | CLDR (Unicode License v3) bildirimini ATTRIBUTION.md'ye eklemek | |
| İ14 | AWC ve NOAA: logo yok, onay iması yok, dakikada 100 istek sınırı aşılmaz | Bugün istekler arasında 700 ms var |
| İ15 | Limited şirket kurmayı değerlendirmek | Hukuki ve idari sorumluluk kısmen şirkete geçer; ceza sorumluluğu şahsidir (TCK 20). Künyede işyeri adresi yazılabilir |
| İ16 | Kendi alıcı kurmak (adsb.lol bağımlılığını azaltır) | Önce BTK görüşü (2.4) |

---

## 4. Zaten yaptıklarımız

- **Askerî uçaklar:** Askerî bitli uçak API, WS ve aramada dönmüyor (`isHiddenByDefault`). **Sınır:** Yalnız adsb.lol'ün biti kullanılıyor; bit yoksa uçak görünür (K1).
- **Biti bilinmeyen uçak:** Gizli, ama yalnız yerel alıcıda (D-071). adsb.lol'de bu durum 0 sayılıyor.
- **PIA ve LADD:** Tescil ve tescile eşit çağrı kodu gizli. `ownOp` alanı kayıt aracında siliniyor (D-094); canlı modelde görünmediği doğrulanmalı.
- **Hex engel listesi:** Her kanalda uygulanıyor; liste okunamazsa API canlı veriyi açmıyor (D-074). Geçmiş izlere de uygulandığı doğrulanmadı.
- **Askerî üsler:** Sitede yok (D-107). **Sınır:** ICAO kodları istemci paketinde (İ9).
- **Veri kaynakları:**
  - Harici servislere yalnız worker gidiyor.
  - FR24 kazınmıyor; adsb.lol `routeset` ve `route` uç noktaları ve yasaklı kaynaklar kullanılmıyor.
  - Zorunlu UA ve AIMD hız denetimi var; 401 ya da 403 gelince çekim duruyor.
- **Atıflar:**
  - Haritada ADSB.lol ve ODbL 1.0 atfı bağlantılı; küçük ekranda katlanmıyor.
  - OpenFreeMap, OpenMapTiles, OSM ve Esri atıfları var.
  - ATTRIBUTION.md her kaynağı listeliyor. Hakkında sayfası türetilmiş veritabanının ODbL altında kaldığını yazıyor.
- **Kullanım koşulları:** Geçici metin yürürlükte (2026-10-07; `apps/web/src/lib/terms.ts`). İçeriği: hizmet "olduğu gibi" ve bilgi amaçlı, seyrüsefer için değil; ODbL hakları kısıtlanmaz; Esri maddeleri. **Sınır:** mutlak askerî söz (Ş1).
- **Lisans kaydı:** 7 alanlı kayıt ve `DATA_USAGE_MODE` kapısı çalışıyor.
- **Hava durumu:** Atıf var, logo yok, "resmî brifing değildir" uyarısı var.
- **DHMİ adları:** Kaynak yazılarak elle derlendi; AIP yalnız referans.
- **Karolar:** Tarayıcı doğrudan çekiyor; proxy ve sunucu önbelleği yok.
- **Analiz:** Onaydan sonra yükleniyor; onay geri alınabiliyor (D-028).
- **Çerezler:** Dil adreste tutuluyor, çerezde değil (D-076). Yönetici çerezi httpOnly, `SameSite=Strict` ve yalnız `/admin` yolunda (D-056).
- **Loglar:** authorization, cookie, token ve password alanları gizleniyor.
- **Saklama:** İnce iz 30 gün, örneklenmiş iz 7 gün, hava durumu 30 gün. İz tabloları yedeğe girmiyor.
- **Kullanıcı verisi:** Ayrı şemada; ODbL dökümüne girmez (D-011).
- **Canlı çekim üretimde kapalı:** `CONTACT_EMAIL` boş (ACTIVATION 2. adım). Açıklar canlı veri gelmeden kapatılabilir.

---

## 5. Kırmızı çizgiler

1. **Askerî, devlet ya da VIP uçak hiçbir kanalda gösterilmez:** harita, arama, takip, bildirim, geçmiş, OG görseli, API.
2. **Askerî üsler geri gelmez:** pin, ad, sayfa, arama sonucu ya da uzaklık referansı olarak bile.
3. **Askerî yasak ve güvenlik bölgelerinin görüntüsü ya da haritası üretilmez.** Fotoğraf, film, web kamerası, kullanıcı fotoğrafı ve dron görüntüsü dahil (2565 md. 7, 9, 21). İncirlik'te bir üssün canlı yayını yüzünden 5 kişi gözaltına alındı ve adli kontrol uygulandı (NTV, 02.03.2026).
4. **Yasak sahalar (LTP) haritaya çizilmez.** AIP sayfaları, tabloları ve NOTAM listeleri kopyalanmaz (AIP GEN 0.1 §5).
5. **Resmî bağ izlenimi verilmez.** DHMİ, SHGM, MGM, NOAA ya da NWS logosu kullanılmaz; onayları ima edilmez.
6. **Mutlak güvenlik sözü verilmez:** "asla gösterilmez" gibi.
7. **Yayın yasağı altındaki bir olayla ilgili içerik açık tutulmaz.** Kriz anında operasyon bölgesi gösterilmez; 4 saatlik süre aşılmaz.
8. **7500 sansasyonel gösterilmez.** "Kaçırıldı" gibi yorum yapılmaz.
9. **Haber ya da blog bölümü açılmaz.** Açılırsa site 5187 md. 2/m'ye göre "internet haber sitesi" sayılabilir. Yenilikler sayfası ürün günlüğüdür ve kalabilir.
10. **Sosyal özellik eklenmez:** yorum, paylaşılan takip listesi, fotoğraf yükleme. Site "sosyal ağ sağlayıcı" sayılabilir; 7578 sayılı Kanun (yürürlük 1.11.2026) bu sağlayıcılara yeni yükler getiriyor.
11. **ATC sesi, web kamerası ya da canlı video eklenmez** (5809 md. 51/2; RTÜK devreye girer).
12. **Gizleme talebi zorlaştırılmaz.** Ücretli "hızlı engelleme" kurulmaz; tescil belgesi rutin olarak istenmez.
13. **Askerî izler saklanmaz ya da dökülmez.** Engel ve VIP listeleri ile coğrafi çokgenler yayımlanmaz; koda, imaja ya da istemciye girmez.
14. **Yasak kaynaklar kullanılmaz:** airplanes.live, adsb.fi, OpenSky, ADS-B Exchange; FR24 ve FlightAware'den kazıma; FR24 resmî API'si; adsb.lol `routeset` ve `route`. Karolar için proxy ya da önbellek kurulmaz. İstemciler adsb.lol'e doğrudan gitmez.
15. **ODbL kısıtlanmaz.** Kullanım koşulları veri haklarını daraltmaz; ücret veri münhasırlığına bağlanmaz; ADS-B verisi ticari veriyle aynı veritabanında karışmaz.
16. **Ücretli dönemde de yok:** otomatik yenilenen yıllık abonelik, önceden işaretli onay kutusu, onaysız tanıtım iletisi.
17. **Soruşturma ya da talep geldikten sonra seçerek silme yapılmaz.** Yalnız önceden yazılı, otomatik kurallar çalışır (TCK 281).
18. **Ajanın yapmayacakları:** canlı araç çalıştırmak (`smoke:live`, `record`, `coverage:probe`), e-posta göndermek, sır üretmek, kurumlara başvurmak.

---

## 6. Avukata sorulacaklar

### Öncelik 1: açılıştan önce yazılı yanıt

1. **Gizli bilgi:** Herkese açık ADS-B ya da MLAT yayınından gelen konum, TCK 329 ve 336 anlamında "niteliği itibarıyla gizli" bilgi sayılabilir mi? "Gizliliğini yitirmiş bilgi" savunması ne kadar güçlü? Süzgeç bir uçağı kaçırırsa taksirli hâl (329/3, 336/3) ya da TCK 338 doğar mı? TCK 338'deki "ilgili kişiler" bizi kapsar mı? K1'deki kurallar yeterli özen sayılır mı?
2. **Bilinçli taksir:** Açıkları belgeleyen iç kayıtlar (DECISIONS, bu araştırma) bir soruşturmada TCK 22/3 kanıtı olur mu? Nasıl tutulmalı?
3. **Devlet uçakları:** Askerî ya da devlet uçaklarının hareketini açıklamayı yasaklayan, yayımlanmış ya da yayımlanmamış bir düzenleme var mı? Cumhurbaşkanlığı uçakları 2920 md. 3/c'ye göre devlet hava aracı mı? Polis, jandarma, gümrük, Sahil Güvenlik, MİT ve OGM yangın uçaklarından hangileri gizli olmalı? MİT Kanunu md. 27/3 bizim için risk mi?
4. **Özel uçaklar:** Özel uçak izini yayımlamak hangi koşulda TCK 136 anlamında "hukuka aykırı yayma" olur? Kurul KVKK md. 5/2-f'yi IMY'den ne kadar sert uyguluyor? K3'teki varsayılanlar yeterli mi? Uçak sahipleri için herkese açık aydınlatma metni Tebliğ md. 6'yı karşılar mı? Hex, tescil ve konum izi ne zaman kişisel veri sayılır?
5. **5651 süreci:** 7590'dan sonra 8/A ve 9/A kararlarını kim veriyor; bildirim hangi kanaldan gelir (e-posta, KEP)? VPS yurt dışındayken tebligat ve itiraz nasıl işler? 8/A(4)'teki suç duyuruları uygulamada nasıl ilerliyor?
6. **Künye:** Gelir yokken site "ticari veya ekonomik amaçlı" sayılır mı? Gerçek kişi için ev adresi yerine sanal ofis ya da işyeri adresi yeter mi; VKN ve telefon zorunlu mu? Hostinger'ın hangi tüzel kişisi yazılmalı? 2007 tarihli Yönetmelik 7590'dan sonra da geçerli mi?
7. **Yurt dışı aktarım:** Hostinger, push servisleri, Expo, SMTP, Turnstile ve Sentry için hangi md. 9 yolu kullanılmalı? Firmalar standart sözleşmeyi imzalamazsa veriyi Türkiye'ye taşımak gerekir mi? Esri ve OpenFreeMap karo istekleri ile adsb.lol'e giden `/v2/hex` istekleri aktarım sayılır mı?
8. **Yayın yasakları:** Mahkeme yayın yasakları ve OHAL ya da seferberlik tedbirleri otomatik veri yayımlayan bir siteyi bağlar mı? Bunlardan haberdar olmanın resmî bir kanalı var mı?
9. **Resmî talepler:** 7545 md. 16/1 ve MİT Kanunu md. 28 kapsamında bir gerçek kişiye hangi bilgi talepleri gelebilir; biçimi, süresi ve doğrulanması nasıl olur? Silme yükümlülüğü (TCK 138) ile delilin korunması (TCK 281, CMK) çatışırsa ne yapılmalı?
10. **Metinler:** Kullanım koşulları, `/gizlilik`, uçak verisi aydınlatması, denge testi ve analiz bandı tek seferde incelenebilir mi? Bağlanma yöntemi (TBK 20–25) ve sorumluluk sınırı (TBK 115) nasıl kurulmalı?

### Öncelik 2: açılıştan sonra da olur

11. 2565'teki "harita" yasağı Esri uydu altlığına ve askerî bölge çevresindeki uçak izlerine uygulanır mı? İncirlik soruşturmasındaki "yayın, çekimin devamıdır" yaklaşımı haritadaki konuma uzanır mı? Genelkurmay izni bugün kimden alınır?
12. SHGM, DHMİ ya da MSB'den proaktif yazılı görüş istemek güvence mi sağlar, yoksa dikkat mi çeker?
13. VPS başka projelerle paylaşılıyor. 5651 md. 5'teki yer sağlayıcı yükümlülükleri bize düşer mi?
14. **ODbL:** Canlı kaynaktan türeyen veritabanında yöntem belgesi (md. 4.6b) yeter mi, döküm mü gerekir? Hız limiti ve ücretli anahtar md. 4.7 ile uyumlu mu? Engel listesi ve PIA/LADD maskelemesi ayrıntısız anlatılabilir mi? FSEK ek md. 8 ihlalinin yaptırımı ve adsb.lol tazminat maddesinin kapsamı nedir?
15. AIP olgularını yalnız iç süzgeçte kullanmak ve DHMİ adlarını kullanmak izin ister mi?
16. MGM'nin METAR ve TAF'larını AWC üzerinden ticari bir sitede göstermenin bir kısıtı var mı? Esri E204 §3.1b.5 (rakip ürün) ve §3.1c.1'in güncel metni nedir (PDF açılamadı)?
17. **KVKK, diğer:** Savunulabilir en uzun saklama süreleri; analizdeki `localStorage` kimliğinin dayanağı; gizleme talebinde orantılı kimlik doğrulaması; ücretli uzun geçmiş denge testini değiştirir mi; İngilizce sürüm ve AB havalimanı sayfaları GDPR md. 3(2) bakımından AB'yi hedeflemek sayılır mı?
18. **Ücretli plan:** Cayma istisnası SaaS aboneliğine uygulanır mı, onay nasıl alınır? Aylık planda kısmi iade gerekir mi? Ücretsiz denemeden ücretliye geçiş nasıl kurulur? Push ile tanıtım ticari elektronik ileti sayılır mı?
19. **İşletme:** Şahıs işletmesi mi, limited şirket mi? "airline" genel bir sözcük: marka tescili ve haksız rekabet riski nedir?
20. **Kendi alıcı:** BTK'nın yazılı görüşü 5809 md. 51/2 bakımından yeterli mi?

---

## 7. Kaynaklar

Aksi yazılmadıkça hepsi 2026-10-15'te okundu. Bu rapor yazılırken yerel kopyadan yeniden okunanlar: TCK md. 136, 329, 336, 338; 5651 md. 8/A ve 9/A (`legal/src/5237-tck.txt`, `legal/src/5651.txt`).

### Mevzuat
- 5651 (7590 işlenmiş güncel metin; md. 2, 3, 4, 5, 6/A, 8, 8/A, 9/A): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5651.pdf
- 5237 TCK (md. 8, 13, 20, 22, 66, 135–139, 217/A, 281, 285, 329–339): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5237.pdf
- 2920 Sivil Havacılık Kanunu (md. 2, 3, 43, 51): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2920.pdf
- 2565 Askerî Yasak Bölgeler ve Güvenlik Bölgeleri Kanunu (md. 7, 9, 21, 25, 26): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2565.pdf
- 2937 MİT Kanunu (md. 27, 28): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2937.pdf
- 2935 Olağanüstü Hal Kanunu (md. 11, 25): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2935.pdf
- 2941 Seferberlik ve Savaş Hali Kanunu (md. 3, 18): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2941.pdf
- 7545 Siber Güvenlik Kanunu (md. 3, 16; 7590 değişiklikleri): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.7545.pdf
- 6698 KVKK (md. 4, 5, 6, 7, 9, 10, 11, 13, 16, 17, 18, 28): https://www.mevzuat.gov.tr/mevzuatmetin/1.5.6698.pdf
- 3713 Terörle Mücadele Kanunu (md. 6): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.3713.pdf
- 5809 Elektronik Haberleşme Kanunu (md. 37, 51): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5809.pdf
- 5187 Basın Kanunu (md. 2): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5187.pdf
- 5846 FSEK (ek md. 8): https://www.mevzuat.gov.tr/MevzuatMetin/1.3.5846.pdf
- 6563 Elektronik Ticaret Kanunu (md. 12): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6563.pdf
- 6502 Tüketicinin Korunması Hakkında Kanun: https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6502.pdf
- 7578, RG 01.05.2026/33240: https://www.resmigazete.gov.tr/eskiler/2026/05/20260501-1.htm
- Aydınlatma Tebliği, RG 10.03.2018: https://www.resmigazete.gov.tr/eskiler/2018/03/20180310-5.htm
- Başvuru Tebliği, RG 10.03.2018: https://www.resmigazete.gov.tr/eskiler/2018/03/20180310-6.htm
- Silme, Yok Etme veya Anonim Hale Getirme Yönetmeliği, RG 28.10.2017 (md. 5, 7, 11, 12): https://www.resmigazete.gov.tr/eskiler/2017/10/20171028-10.htm
- Yurt dışına aktarım Yönetmeliği, RG 10.07.2024 (md. 16): https://www.resmigazete.gov.tr/eskiler/2024/07/20240710-2.htm
- Mesafeli Sözleşmeler Yönetmeliği, RG 27.11.2014: https://www.resmigazete.gov.tr/eskiler/2014/11/20141127-6.htm
- Abonelik Sözleşmeleri Yönetmeliği, RG 29.12.2022: https://www.resmigazete.gov.tr/eskiler/2022/12/20221229-5.htm
- Ticari İletişim ve Ticari Elektronik İletiler Yönetmeliği, RG 15.07.2015 (md. 6/2): https://www.resmigazete.gov.tr/eskiler/2015/07/20150715-4.htm
- 5651 Usul ve Esaslar Yönetmeliği, md. 5 [İKİNCİL yayıncı]: https://www.lexpera.com.tr/mevzuat/yonetmelikler/internet-ortaminda-yapilan-yayinlarin-duzenlenmesine-dair-usul-ve-esaslar-hakkinda-yonetmelik

### KVKK ve veri koruma
- Kurul ilke kararı 2026/347 duyurusu: https://www.kvkk.gov.tr/Icerik/8710/veri-sorumlulari-tarafindan-acik-riza-ve-aydinlatma-metinlerinin-ayri-ayri-duzenlenmesi-gerektigi-hakkinda-kisisel-verileri-koruma-kurulunun-18-02-2026-tarihli-ve-2026-347-sayili-ilke-kararina-iliskin-kamuoyu-duyurusu
- Yurt Dışına Aktarım Rehberi: https://www.kvkk.gov.tr/Icerik/8142/Kisisel-Verilerin-Yurt-Disina-Aktarilmasi-Rehberi
- KVKK yayını (PDF; aydınlatma ve çerez maddesinde kullanıldı): https://www.kvkk.gov.tr/SharedFolderServer/CMSFiles/fb193dbb-b159-4221-8a7b-3addc083d33f.pdf
- 2026 KVKK idari para cezaları [İKİNCİL]: https://cottgroup.com/tr/mevzuat/item/yeniden-degerleme-oranina-gore-2026-yili-kvkk-idari-para-cezalari
- VERBİS istisnası, RG 01.10.2025/33034 [İKİNCİL]: https://cottgroup.com/tr/blog/kvkk-gdpr/item/verbise-kayit-zorunlulugu-istisnalarinda-degisiklik
- IMY, Flightradar24 kararı DI-2021-3397, 2025-06-30: https://www.edpb.europa.eu/system/files/2025-08/se-2025-06-decision-public_0.pdf

### Havacılık
- DHMİ AIP ENR 5.1 (01 OCT 26): https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_5_1_en.pdf
- DHMİ AIP GEN 0.1 §5 (telif): https://www.dhmi.gov.tr/AIPDocuments/LT_GEN_0_1_en.pdf
- DHMİ AIP GEN 3.1: https://www.dhmi.gov.tr/AIPDocuments/LT_GEN_3_1_en.pdf
- DHMİ AIP Türkiye abonelik sayfası: https://www.dhmi.gov.tr/Sayfalar/aipturkey.aspx
- VRS standing-data code-blocks: https://raw.githubusercontent.com/vradarserver/standing-data/main/code-blocks/schema-01/code-blocks.csv
- BTK, frekans tahsisinden muaf cihazlar: https://btk.gov.tr/en/frekans-tahsisinden-muaf-telsiz-cihaz-ve-sistemleri

### Veri kaynakları ve lisanslar
- ODbL 1.0 (md. 4.2, 4.3, 4.6, 4.7, 9.1, 9.4, 10.4): https://opendatacommons.org/licenses/odbl/1-0/
- adsb.lol ana sayfa ("unfiltered"): https://www.adsb.lol/
- adsb.lol gizlilik ve lisans (tazminat, "as is"): https://www.adsb.lol/privacy-license/
- adsb.lol API belgesi (ODbL 1.0): https://www.adsb.lol/docs/open-data/api/
- adsb.lol tarihsel veri: https://www.adsb.lol/docs/open-data/historical/
- adsb.lol API kaynak kodu (OpenAPI açıklaması; UA denetimi görünmüyor): https://raw.githubusercontent.com/adsblol/api/main/src/adsb_api/app.py
- Hostinger veri merkezleri: https://www.hostinger.com/support/1583267-where-are-hostinger-servers-located/
- OpenFreeMap şartları (14.10.2026): https://openfreemap.org/tos
- OpenMapTiles şeması: https://openmaptiles.org/schema/
- Unicode License: https://www.unicode.org/license.txt
- AWC Data API: https://aviationweather.gov/data/api
- NWS sorumluluk reddi: https://www.weather.gov/disclaimer
- FlightAware engelleme: https://www.flightaware.com/blocked
- Flightradar24 sınırlı veri açıklaması: https://support.fr24.com/support/solutions/articles/3000117426-why-is-some-aircraft-information-limited-or-not-visible-

### Emsaller ve haberler
- NTV, İncirlik soruşturması, 02.03.2026: https://www.ntv.com.tr/turkiye/incirlik-hava-ussunden-canli-yayin-sorusturmasi-5-kisiye-adli-kontrol-1714231
- The Aviationist, 15 Temmuz 2016: https://theaviationist.com/2016/07/18/exclusive-all-the-details-about-the-aerial-battle-over-turkey-during-the-military-coup/
- TC-ATA'nın THY çağrı koduyla uçması: https://www.dawn.com/news/amp/1271625 ve https://www.diken.com.tr/?p=1297343
- C-130 kazası (TUAF543): https://ankahaber.net/haber/detay/tskya_ait_c130_kargo_ucagi_dustu_20_sehidin_kimliklerinin_belli_oldugu_kazayla_ilgili_incelemeler_suruyor_akinci_tiha_destek_icin_gonderildi_272997
- TUSAŞ saldırısı sonrası yayın yasağı, 23.10.2024: https://www.evrensel.net/haber/531799
- 2026'da erişim engeli örnekleri: https://www.evrensel.net/haber/6002815/t24-e-kapatma-karari ve https://bianet.org/haber/engelliwebe-erisim-engellendi-323992
- MİT tırları (TCK 328, 330) ve C-130 sonrası MSB suç duyurusu: 2. araştırma kolu, `legal/track2.md` §3 (bu raporda yeniden açılmadı)

### Repo (salt okunur, 2026-10-15)
- `packages/i18n/src/messages/tr.ts:816`, `:1350`; `packages/i18n/src/messages/en.ts:670`, `:1144`
- `packages/providers/src/live/response.ts:12`, `:122`; `packages/providers/src/aircraft.ts:120-122`
- `apps/api/src/live/record.ts`
- `apps/web/src/lib/terms.ts`
- `docs/DECISIONS.md` (D-011, D-028, D-056, D-068, D-071, D-074, D-075, D-076, D-094, D-107; satır 399)
- `docs/spec/domain.md:90`, `:210`
- `docs/spec/data-sources.md`, `docs/ACTIVATION.md`
- `tools/fixtures/vrs/airlines.csv:2394`, `:5288`

### Doğrulanamayanlar
- VIP filo tescil listesi (basından; kaynaklar çelişkili)
- Türk sivil ICAO bloğu (4B8000–4BFFFF); repodaki 22 TC- kaydı bununla tutarlı, ama bu kanıt değil
- TRK önekinin VIP uçuşlarda kullanılıp kullanılmadığı
- TUSAŞ ve Baykar ICAO tanıtıcıları; IATA kodu olmayan askerî alanlar ve ortak kullanımlı üslerin tam listesi
- Yayıcı kategori kodları (DO-260B)
- Okunamayan metinler: 1402 sayılı Sıkıyönetim Kanunu (404), 2024 Seferberlik Yönetmeliği, KVKK karar 2019/10, FAA LADD/PIA sayfaları (403), Esri E204 PDF'i (şifreli), AYM 2015/18567 kararının resmî metni
- Yalnız arama özetinden okunanlar: SHY-Gözetim, 7590'daki devir süresi, İYS ayrıntıları; 7590'ın RG sayısı (33326) yalnız ikincil anlatımda
- 5651 için yayımlanmış 2026 tutar tablosu yok; tutarlar [TAHMİN]. KVKK 2026 tutarları [İKİNCİL]
- Flightradar24'e Türkiye'de erişim engeli getirildiğine dair kayıt bulunamadı. EngelliWeb arşivi taranamadı; bu, engelin olmadığını kanıtlamaz.

---

## Ek: Eleştiriye yanıt

| Eleştiri | Karar | Rapora etkisi |
|---|---|---|
| DHMİ ve SHGM'nin ceza yetkisi görünmüyor; gerçek muhataplar başka | Kabul | Sonuç 1 |
| Y1: TCK 329/2 ve 336/2'nin taksirli hâli 3–8 yıl | Kabul; yerel metinde doğrulandı | Sonuç 2, K1 |
| Y2: 3–5 yıl 334 değil 336'dır; yayın yasağı kendiliğinden 336'ya girmez | Kabul | K2'de dayanak düzeltildi |
| Y3: TCK 338 | Kısmen | Risk listesine [BELİRSİZ] olarak eklendi. Metin "ilgili kişilerin dikkat ve özen yükümlülüğü" diyor; yalnız bilgiyi korumakla yükümlüleri anlatıyor olabilir. Worker'da süzmeyi kapıya almak için 329/3, 336/3 ve KVKK zaten yeterli |
| Y4: "En olası yaptırım ceza davası değildir" yanıltıcı | Kısmen | Çerçeve "mahkûmiyet düşük, kriz anında soruşturma gerçek" oldu. Ama 8/A(4) suç duyurusunu yalnız "suça konu" içerik için öngörüyor. İncirlik ve MİT tırları emsalleri görüntü ve haber içeriğiydi, süzülmüş sivil trafik değil. Süzgeçler çalışırken olağan işleyişte soruşturma olasılığı düşük |
| Y5: Bütün sitenin engellenmesi bir yaptırım değil, teknik bir sonuç | Kabul | Sonuç 3, K2; tek uç yüzünden alan adı veya IP engeli olasılığı yazıldı |
| Y6: KVKK md. 10 adres değil kimlik ister | Kabul | Ş4 |
| Y7: Gerçek kişi için VKN belirsiz; yer sağlayıcı bilgisi ana sayfada | Kabul | Ş2: Hostinger satırı alt bilgiye; ucuz ve iki okumayı da karşılar |
| Y8: 403 iddiasının kaynağı yanlış; API anahtarı geliyor | Kabul | K6 |
| Y9: LTP sahaları irtifaya bağlı; ambulans helikopterleri muaf | Kabul | K1 kural 7 ve 8; ambulans kuralı "iyi olanlar"dan zorunluya çıktı |
| Y10: Beş üs yetmez | Kabul | K1 kural 8 |
| Y11: İmha politikası VERBİS'e bağlı; VERBİS sentezde yok | Kabul | Ş6, K7 |
| Y12: Canlı katman aktarımı büyütür; "süreç başladı" yetmez | Kabul | Ş5, kapı |
| Y13: ODbL md. 9.4 daha yumuşak | Kabul | K5 |
| Y14: Kullanım yasağı ODbL'li veriye değil hizmete yazılmalı | Kabul | K8 |
| Y15 ve P1: Tek kişi 4 saati tutturamaz; otomatik kapatma olmasın | Kabul | K2 (ikinci kişi), Ş3 (otomatik kapatma yok) |
| Y16: IMY kararı güvence değil; temkinli varsayılan güçlü seçenek | Kabul | K3 |
| Y17: Ücretli dönem tutarları kaynaksız | Kabul | 2.4'te tutar verilmedi |
| Y18: Sicil alenidir, ama bu alenileştirme değildir | Kabul | K3 |
| Y19: 5651 md. 9/A yürürlükte | Kabul | Gizleme talebi yolu (K4) kapıya alındı |
| Y20: Bazı işler bugünden geçerli | Kabul | 2.1 "Şimdi" bölümü |
| Y21: Kullanım koşullarındaki mutlak söz | Kabul; repoda doğrulandı (4 yer) | Ş1, kırmızı çizgi 6 |
| §3: TCK 135/136, 5651 md. 4/1, 7545 md. 16/1, MİT md. 27/3 ve 28, TCK 22/3 ve 281, TBK | Kabul | K1, K2, K3, K7, K8 |
| §3: TMK md. 6 | Kabul; düşük risk | Güvenlik helikopterleri K1 kural 4 ile zaten gizli |
| §3: KVKK md. 28/1-c | Kabul | Yalnız yan dayanak; ana dayanak yapılmadı |
| §3: 7578, RTÜK, 5187 | Kabul | Kırmızı çizgi 9, 10, 11 |
| §3: DHMİ mânia onayı | Kabul [BELİRSİZ] | 2.4, kendi alıcı |
| P2: Ayrı IP | Kısmen | Risk yazıldı. Kapıda "ayrı IP zorunlu" değil, "karar verildi" yeter; maliyet ve mimari kararı senin (DUR-SOR 5) |
| P3: Bildirim kanalları yalnız info@ değil | Kabul | Ş3 |
| P4: Özel uçak takibi ve bildirimi | Kısmen | Önerim kapalı başlamak. Ürünü daralttığı için son karar senin (K3) |
| P5: Kullanım koşulları eksikleri | Kabul | K8 |
| P6: Özen kanıtı ayrı ve uzun tutulmalı | Kabul | K7 |
| P7: Listeler herkese açık imaja girmesin | Kabul | K1, kırmızı çizgi 13, İ9 |
| P8: MLAT/TIS-B, yayıcı kategorileri, TRK öneki | Kabul | K1 kural 3, 5, 6 [BELİRSİZ] |
| P9: Kriz tetikleyicileri yazılı olsun | Kabul | K2 |
| P10: Silme ile delilin korunması | Kabul | K2, kırmızı çizgi 17 |
| P11: Şirket | Kabul | İ15; avukat sorusu 19 |

---

*Bu rapor araştırmadır, hukuki görüş değildir. Yayından önce bir avukat incelemelidir.*
