# Eleştiri: "Canlı uçakları göstermek" sentezi

- **Tarih:** 2026-10-15
- **Bakış açısı:** Şüpheci bir Türk teknoloji hukukçusu. Bu metin de araştırmadır, hukuki görüş değildir.
- **Yöntem:**
  - Sentezdeki iddialar kaynak metinleri açılarak denetlendi.
  - Yerel kopyalar: `legal/src/`. Bu eleştiri için indirilenler: `legal/crit/` (2935, 2937, 2941, 3713, 6698, 7545 ve IMY kararı).
  - Repo yalnız okundu.
  - Kaynak kısaltmaları (K1…) en sonda; hepsi 2026-10-15'te okundu.
- **İşaretler:**
  - [YANLIŞ]: kaynak metinle çelişiyor
  - [EKSİK]: konuyla ilgili bir hüküm, makam ya da önlem atlanmış
  - [ABARTILI] veya [HAFİF]: risk ya da yaptırım olduğundan büyük veya küçük anlatılmış
  - [BELİRSİZ]: doğrulanamadı
  - [İKİNCİL]: resmî metin değil

---

## 0. Hüküm

1. **Genel çerçeve doğru.** Uçuş takip sitesine özgü bir izin bulunamadı, asıl riskler havacılık mevzuatının dışında. Bir şey açıkça yazılmalı: DHMİ ve SHGM'nin bir web sitesine ceza kesme yetkisi görünmüyor.
   - 2920 md. 2'ye göre kanun "havacılık sahasındaki faaliyetleri" kapsıyor [K4]. Uçuş takip sitesi bu faaliyetlerden biri değil (yorum).
   - Kullanıcının "DHMİ'den ceza" endişesinin gerçek muhatapları şunlar: savcılık, Siber Güvenlik Başkanlığı (5651 ve 7545), KVK Kurumu, MSB (suç duyurusu), MİT ve sulh ceza hâkimlikleri.
2. **Ceza riski olduğundan küçük gösterilmiş.** Atlananlar:
   - TCK 329/2 ve 336/2'nin ağırlaştırılmış hâli. "Askerî hareketleri tehlikeye koyma"da taksirli hâlin cezası bile 3–8 yıl.
   - TCK 338: taksirle casusluğa imkân vermek.
   - MİT Kanunu md. 27/3: internetten yayımda 3–9 yıl; madde içerik sağlayıcıyı açıkça sayıyor.
   - TCK 135 ve 136: kişisel veriyi kaydetmek ve yaymak. Bu suçlar şikâyete bağlı değil.
   - Kamu araçlarının hareketini yayımlayanlara casusluk maddeleriyle (TCK 328, 330) soruşturma açıldı (MİT tırları emsali, 2. kol H5).

   "En olası yaptırım ceza davası değildir" cümlesi bu yüzden yanıltıcı (bkz. Y4).
3. **Atlanan hükümler:**
   - 5651: md. 4/1 ve md. 9/A
   - 7545 md. 16/1
   - 2937 md. 27/3-4 ve md. 28
   - 2920 md. 51
   - KVKK: md. 16 (VERBİS) ve md. 28/1-c
   - TCK: md. 22/3 (bilinçli taksir) ve md. 281
   - TBK: md. 20–25 ve md. 115
   - 1.11.2026'da yürürlüğe girecek 7578

   Ayrıntı: §3.
4. **Pratikte en tehlikeli açıklar:**
   - Kullanım koşullarında bugün "Askeri uçaklar … gösterilmez" diye mutlak bir söz var.
   - Engel listeleri ve koordinatlar sunucu imajına girerse, herkese açık GHCR paketleriyle yayımlanmış olur.
   - VPS başka projelerle paylaşılıyor. IP düzeyinde bir erişim engeli o projeleri de düşürür.
   - Bildirim kanalı olarak yalnız info@ düşünülmüş. WHOIS ve Hostinger kanalları atlanmış.
   - 4 saatlik süre tek kişiyle tutturulamaz.
   - Coğrafi süzgeç yalnız beş üsü kapsıyor.
   - Özel uçakları takip etmek ve bildirim almak engelsiz.

   Ayrıntı: §4.
5. **Zamanlama hatası.** Sentez bütün işleri `CONTACT_EMAIL` açılış kapısına bağlıyor. Oysa bazı yükümlülükler canlı katmandan bağımsız olarak bugün de geçerli:
   - ziyaretçi verisi için KVKK aydınlatması
   - künye (site "ticari ya da ekonomik amaçlı" sayılırsa)
   - KVKK md. 9: VPS'teki loglar ve analiz verisi

   Bkz. Y20.

---

## 1. Doğrulananlar (kaynak açıldı)

| Sentezdeki iddia | Sonuç |
|---|---|
| 5651 md. 3: künye; ceza 2.000–50.000 TL | Doğru, ama hüküm **md. 3/2**'dir. Tutar 6552 (2014) ile konmuş [K1] |
| md. 3/3 ve md. 6/A-11: e-postayla bildirim | Doğru. 6/A-11'e göre Birlik, sitenin sayfalarında **bulunabilen herhangi bir e-posta adresine** bildirebilir. md. 3/3'e göre alan adı ve IP'den bulunan adresler de kanaldır [K1] |
| 8/A: 4 saat (fıkra 1); 50.000–500.000 TL (fıkra 5); fail bilgisi verilmezse 3.000–10.000 gün adli para cezası (fıkra 4) | Doğru [K1] |
| md. 8/1-ç: katalogda MİT md. 27 | Doğru, ama yalnız **27/1 ve 27/2** katalogda [K1] |
| 7590: kabul 24/7/2026, yürürlük 31/7/2026; "Başkan: Siber Güvenlik Başkanı" | Doğru [K1]. RG sayısı 33326 yalnız 2. ve 3. kolda geçiyor [İKİNCİL] |
| md. 9 iptal (AYM E.2020/76, K.2023/172) | Doğru [K1] |
| TCK 329/3 ve 336/3: taksirli temel hâl 6 ay–2 yıl | Doğru, ama eksik aktarılmış (Y1) [K2] |
| 2565 md. 7/1-e, 21/e, 25/a (6 ay–5 yıl), 26 (3–6 ay) | Doğru [K3] |
| 2935 md. 11/e-f ve 25/b-1 (1–6 ay) | Doğru [K6] |
| 2941 md. 18: 6 ay–2 yıl; seferberlikte "bir misli", savaşta "iki misli" artırım (iki ve üç kat) | Doğru [K7] |
| 2920 md. 3/c (devlet hava aracı) ve md. 43 | Doğru [K4] |
| KVKK 2026 tutarları | cottgroup tablosuyla aynı [K18, İKİNCİL]. Tabanlar md. 18'de (5.000–100.000 TL vb.) [K9] |
| KVKK md. 9/5: 5 iş günü; md. 17/2 → TCK 138 | Doğru [K9]. TCK 138'in cezası **1–2 yıl** [K2]; sentezdeki "doğrulanmalı" notu kaldırılabilir |
| İmha Yönetmeliği md. 7/3 (3 yıl) ve md. 11 (6 ay) | Doğru, ama md. 5 sınırı var (Y11) [K15] |
| Kurul ilke kararı 2026/347 | Doğru: karar 18.02.2026, RG 24.03.2026 [K17] |
| IMY'nin Flightradar24 kararı | Doğru [K20]: md. 6(1)(f) kabul edildi; tescil belgesi istemek kınandı (reprimand); şikâyetçilerin uçak verisinin yayından kaldırılması emredildi |
| ODbL: 4.6'daki "internetten ücretsiz" sunum, 9.1'de kendiliğinden sona erme | Doğru [K21] |
| Hostinger'ın Türkiye'de VPS veri merkezi yok | Doğru [K28] |
| OpenFreeMap şartları 14.10.2026'da değişti (Cloudflare, Macar hukuku, Budapeşte'de tahkim) | Doğru [K29] |
| AIP GEN 0.1 §5: telif | Doğru [K27] |
| İncirlik soruşturması | Doğru, ve sentezin yazdığından ağır [K30]: re'sen soruşturma, 5 kişi **gözaltına alındı** (çatısını açan bina sahibi dahil), adli kontrol. Savcılık açıklamasına göre bu paylaşım "basın ve ifade özgürlüğü kapsamında değerlendirilemeyecek nitelikte" |
| Repo: adsb.lol yanıtında `dbFlags` yoksa 0; `isHiddenByDefault` | Doğru (`packages/providers/src/live/response.ts`, `aircraft.ts`) |
| 5187 md. 2/m: internet haber sitesi | Doğru [K12] |

---

## 2. Yanlış, abartılı ya da eksik aktarılmış iddialar

**Y1. [HAFİF] TCK 329 ve 336'nın cezaları eksik.** Özet tablosu ve A-II yalnız "taksirli hâl 6 ay–2 yıl" diyor. Kaynak metin [K2]:
- **329/2 ve 336/2:** Fiil savaş zamanında işlenmiş ya da "Devletin … askerî hareketlerini tehlikeye koymuşsa" ceza 10–15 yıl.
- **329/3 ve 336/3:** Bu ağırlaştırılmış hâlin **taksirle işlenmesinde ceza 3–8 yıl.**

Bir kriz anında askerî uçağı göstermek tam da bu senaryodur. Ayrıca bilinen bir açık belgelenmiş ama açılıştan önce kapatılmamışsa "bilinçli taksir" savunulabilir: ceza üçte birden yarısına kadar artar (TCK 22/3) [K2]. Bkz. Y21.

**Y2. [YANLIŞ] A11: "TCK 334 ve 336: 3–5 yıl."**
- **334** bilgiyi açıklamayı değil, *temin etmeyi* cezalandırır: 1–3 yıl; askerî hareketleri tehlikeye sokarsa 5–10 yıl. **3–5 yıl yalnız 336 içindir** [K2].
- 336'nın unsuru da dar. Bilginin "yetkili makamların kanun ve düzenleyici işlemlere göre açıklanmasını yasakladığı" ve niteliği gereği gizli bir bilgi olması gerekir. Bir mahkemenin bir olay hakkındaki yayın yasağı kendiliğinden 336 kapsamına girmez.
- Yayın yasağına uymayan bir siteye pratikte 5651 üzerinden içerik kaldırma ve erişim engeli uygulanır. TCK 285 ise yalnız dar koşullarda devreye girer [K2]. Önlem aynı kalır (kriz modu); yalnız hukuki dayanak düzeltilmeli.

**Y3. [EKSİK] TCK 338 risk tablosunda yok, yalnız E1'de anılıyor.**
- Hüküm: Bölümdeki suçların işlenmesi, birinin dikkat ve özen yükümlülüğüne aykırı davranması sonucu "mümkün olmuş veya kolaylaşmış ise" 6 ay–3 yıl; savaş ya da askerî hareketleri tehlikeye sokma hâlinde 3–8 yıl [K2].
- Senaryo: Yabancı bir aktör bizim API'mizi ya da geçmiş oynatmamızı kullanarak askerî uçuş bilgisi "temin eder".
- Bu yüzden A15 (worker'da süzme, askerî iz tutmama) yalnız iyi bir uygulama değil, açılışın ön koşuludur.
- [BELİRSİZ] Doktrin "ilgili kişiler" ifadesini gizli bilgiyle yükümlü kişiler olarak dar okuyabilir. Avukata sorulmalı.

**Y4. [YANLIŞ ÇERÇEVE] "En olası yaptırım ceza davası değildir."**
- 8/A/4 bir zorunluluk koyar: 8/A kapsamındaki içeriği "oluşturan ve yayanlar hakkında Başkan tarafından … suç duyurusunda bulunulur" [K1]. Millî güvenlik gerekçeli bir 8/A kararı tek başına gelmez, arkasından suç duyurusu gelir.
- Uygulama da hızlı:
  - İncirlik'te yayından 2 gün sonra gözaltı ve adli kontrol oldu [K30].
  - MSB, C-130 kazasından sonra şehitlerin kimliğini resmî açıklamadan önce paylaşanlar hakkında suç duyurusunda bulundu (2. kol H6).
  - MİT tırları haberinde TCK 328 ve 330 ile tutuklama oldu (2. kol H5).
- Doğru çerçeve: **Mahkûmiyet olasılığı düşüktür. Kriz anında soruşturma olasılığı ise gerçektir.** Soruşturma gerçek kişiyi doğrudan hedef alır: gözaltı, yurt dışı yasağı, bilgisayarlara el konması. Yani süreç kendisi cezadır.

**Y5. [ABARTILI] 8/A: "Karar URL bazında uygulanamazsa bütün siteye erişim engeli" bir yaptırım gibi yazılmış.**
- 8/A/3'e göre tüm sitenin engellenmesi, URL bazında engellemenin "teknik olarak … yapılamadığı" ya da ihlali önlemediği durumlar içindir [K1]. Kararı uygulamamanın yaptırımı para cezasıdır (8/A/5).
- Ama sitenin mimarisi bu riski fiilen büyütüyor. Canlı veri tek bir WS ve API ucundan akıyor; uçak başına ayrı URL yok. Erişim sağlayıcı bu durumda alan adını ya da IP'yi engeller.
- Pratik sonuçlar için bkz. P2.

**Y6. [ABARTILI] A1 ve A7: KVKK md. 10/1-a "adını ve adresini istiyor".** Madde yalnız veri sorumlusunun "kimliği"ni ister [K9]. Adres ihtiyacı başka yerlerden doğar: başvuru yolu (Başvuru Tebliği) ve 5651 künyesi.

**Y7. [YANLIŞ/BELİRSİZ] A1: künyede VKN.**
- Yönetmelik md. 5/1-a'da "vergi kimlik numarası veya ticaret sicil numarası" ifadesi **tüzel kişi** bölümünde geçer. Gerçek kişi için zorunlu olduğu açık değildir [K16, İKİNCİL].
- Bu kaynağa göre md. 5/2 yer sağlayıcı bilgisinin "**ana sayfasında**" bulunmasını ister. Hostinger satırı yalnız İletişim sayfasında değil, ana sayfanın alt bilgisinde de olmalı.
- Gerçek kişi için gereken: "yerleşim yeri". Sanal ofis adresinin bunu karşılayıp karşılamadığı belirsiz.

**Y8. [YANLIŞ KAYNAK] A6: "adsb.lol iletişim bilgisi olmayan UA'ya 403 döndürüyor (app.py)".**
- Gösterilen kaynakta (bugünkü `app.py`) User-Agent denetimi yok [K25]. OpenAPI açıklamasında şunlar yazıyor: "In the future, you will require an API key", "Rate limits are dynamic", ve lisans ODbL.
- Kural sunucunun önündeki vekil katmanda uygulanıyor olabilir, ya da 2026-09-25'te gözlenmiş olabilir [BELİRSİZ]. İletişim bilgili UA iyi bir uygulamadır, ama sentez onu bu kaynağa dayandıramaz.
- İki kaynak karışmış:
  - "unfiltered" ifadesi gizlilik ve lisans sayfasında değil, ana sayfada geçiyor [K22].
  - Gizlilik ve lisans sayfasında yalnız şunlar var: "as is", tazminat maddesi ve besleyicilerin verisi için CC0 feragati [K23].
  - ODbL bildirimi API ve tarihsel veri belgelerinde [K24].
- Plan: API anahtarı gelecek. Bunun için bir ACTIVATION adımı ayrılmalı.

**Y9. [YANLIŞ] A14: "LTP yasak sahalarında sivil uçuşa izin yok; oradaki uçak devlet uçağıdır."** AIP ENR 5.1 (01 OCT 26) [K26]:
- **LTP2:** 8.000 ft AMSL'nin altında bütün trafiğe, üstünde VFR'ye kapalı. Yani 8.000 ft'in üstünde IFR sivil uçuşa açık.
- **LTP6 (Ankara) ve LTP7 (İmralı):** Görevdeki ambulans helikopterleri ve TUSAŞ'ın eğitim uçakları muaf.

Kural irtifaya bağlanmalı. Ambulans helikopterleri ayrıca gizlenmeli: bir hastanın taşınması sağlık verisine dönüşebilir (KVKK md. 6; sentezin B15'i). Bu kural B'den A'ya çıkarılmalı.

**Y10. [EKSİK] A14: "beş askerî üssün çevresi".**
- D-107'deki beş üs yalnız OurAirports'ta **IATA kodu olan** ve yalnız askerî kullanılan alanlardır (`docs/DECISIONS.md`, D-107).
- IATA kodu olmayan askerî alanlar ve ortak kullanımlı ana üsler listede yok. Basından ve genel bilgiden örnekler: Akıncı, Konya, Diyarbakır, Malatya Erhaç, Kayseri Erkilet, Merzifon, Batman, Balıkesir, Çorlu, Erzurum [İKİNCİL, doğrulanmadı].
- Ortak kullanımlı istasyonların varış panolarında, bayrağı olmayan askerî trafik "sivil varış" gibi görünebilir.
- Sentezin "AIP AD 2'den çıkarılmalı" önerisi yetmez: yalnız askerî alanlar sivil AIP'de yer almaz. Kaynak olarak OurAirports'un askerî satırları (kamu malı) ve ortak kullanım listesi kullanılmalı.

**Y11. [ABARTILI] A9: "periyodik imha en çok 6 ay" herkes için yazılmış.**
- Saklama ve imha politikası yalnız VERBİS'e kayıt yükümlüsü olanlar için zorunludur (İmha Yönetmeliği md. 5/1). Yükümlü olmayanlar yine siler ve anonimleştirir (md. 5/3) [K15].
- **VERBİS sentezde hiç yok.**
  - Kurul kararına göre yıllık çalışan sayısı 50'den az ve bilanço toplamı 100 milyon TL'den az olan, ana faaliyeti özel nitelikli veri işlemek olmayan veri sorumluları muaf (RG 01.10.2025/33034) [K19, İKİNCİL].
  - Kullanıcı büyük olasılıkla muaftır. Bu değerlendirme yazılı olarak kayda geçmeli: VERBİS'e kaydolmamanın cezası 2026'da 341.809 TL'den başlıyor [K18].
- md. 12'ye göre silme talebi en geç 30 gün içinde sonuçlandırılır [K15].

**Y12. [YANLIŞ] A8: "canlı uçaktan bağımsızdır".**
- Kurum, yurt dışındaki bulutta depolamayı aktarım sayıyor. O zaman Türk tescilli özel uçakların konum izleri (kişisel veri olabilir), AB'deki VPS'e yazıldığı anda md. 9 kapsamına girer. Yani canlı katman aktarılan verinin kapsamını genişletiyor.
- Kapıdaki "imzalandı ya da süreci başladı" ölçütü hukuken yetmez: süreci başlatmak uyum değildir.
- Hostinger'ın Kurul metnini hiç değiştirmeden imzalaması düşük olasılıktır [TAHMİN].
- B planına (ör. kişisel veriyi Türkiye'de tutmak, iz verisini azaltmak) kapıdan önce karar verilmeli.

**Y13. [ABARTILI] A4: ODbL'de hakkın geri gelmesi.** Sentez yalnız md. 9.4(c)'yi yazmış: ilk bildirimden sonra 30 gün içinde düzeltme. Metin daha yumuşak [K21]:
- **9.4(a) ve (b):** İhlal durunca hak geçici olarak geri gelir. Lisans veren aksini bildirmezse 60. günde kalıcı olur.
- **10.4:** Uygulanacak hukuk, lisansın uygulanmak istendiği yerin hukukudur. Türkiye'de bu, FSEK ve sözleşme hukuku demektir.

**Y14. [ÇELİŞKİ] B10: Kullanım koşullarına "askerî, istihbarat ya da hedefleme amaçlı kullanım yasağı".**
- Bu, ODbL'li *veri* üzerinde bir kullanım kısıtıdır. ODbL 4.7a "any terms" yasağına takılır [K21]. Sentezin D13'teki kırmızı çizgisiyle de çelişir.
- Çözüm: Kısıt yalnız *hizmete* (sitenin ve API'nin kullanımına) yazılır. `/acik-veri` koşulsuz kalır.

**Y15. [EKSİK] A3: 4 saatlik süreyi tek kişinin tutturması.** Gece, uçuş, tatil ve hastalık konuşulmamış. Sentez "telefonda anlık bildirim" diyor, ama uyuyan biri 4 saati kaçırır. Bkz. P1.

**Y16. [HAFİF] A7: "IMY bu sebebi kabul etti" bir güvence gibi okunuyor.**
- KVKK md. 5/2-f'nin metni GDPR'dan sert: "temel hak ve özgürlüklerine zarar vermemek kaydıyla" ve "zorunlu olması" [K9].
- Kurul IMY'yle bağlı değil. IMY de meşru menfaati kabul ettiği hâlde şikâyetçilerin uçaklarının yayından kaldırılmasını emretti [K20].
- Sonuç: B7 (ticari olmayan uçaklarda varsayılan olarak kimlik gösterilmez) yalnız bir ürün kararı değil, hukuki riski düşüren güçlü bir seçenek. Kullanıcıya böyle sunulmalı.

**Y17. [KAYNAKSIZ] A-III'teki tutarlar.**
- ETBİS "143.102–715.516 TL (2026)" ve 6502 "3.973 TL" için kaynak yok. 6563 md. 12'deki taban tutarlar 50.000–250.000 TL (7416, 2022) [K13].
- Hangi yıldan itibaren yeniden değerlendirildiği belli değil. Rakamlar Bakanlığın 2026 ilanıyla doğrulanmadan yazılmamalı.

**Y18. [EKSİK] E11: "Türk sivil hava aracı sicili kamuya açık mı?"**
- Cevap zaten indirilmiş kaynakta var. 2920 md. 51: "Uçak sicili alenidir". Belgeleri inceleyebilmek için ise ilgi kanıtlanmalı [K4].
- Uyarı: Sicilin alenî olması, KVKK md. 5/2-d'deki "ilgilinin kendisinin alenileştirmesi" değildir. Bu olgu yalnız denge testinde işe yarar.

**Y19. [EKSİK] E9: md. 9 iptal edildi, ama md. 9/A yürürlükte.**
- Özel hayatının gizliliğinin ihlal edildiğini düşünen kişi doğrudan Başkanlığa başvurur. Erişim sağlayıcılar engeli 4 saat içinde uygular. Kişi 24 saat içinde hâkime başvurur, hâkim 48 saat içinde karar verir [K1].
- Bu, özel uçak sahibinin en hızlı yoludur. Engel URL bazındadır: `/?hex=…` ve `/ucus/<id>` adresleri hedef olabilir.
- Gizleme talebi yolu (B4) bu nedenle A'ya çıkarılmalı. Talepler 9/A'ya varmadan karşılanmalı.

**Y20. [ZAMANLAMA] Özet 5 ve F7: "açıklar canlı veri gelmeden kapatılabilir".** Şunlar canlı katmandan bağımsız olarak bugün geçerli:
- **Aydınlatma:** Site bugün de ziyaretçi verisi işliyor (loglar, onaylı analiz, admin). KVKK md. 10 aydınlatması (`/gizlilik`) bugünden eksik.
- **Künye:** Site "ticari ya da ekonomik amaçlı" sayılırsa yükümlülük bugünden doğmuş durumda.
- **Yurt dışı aktarım:** md. 9 VPS'teki her kişisel veri için bugünden geçerli.

Bunlar açılış kapısının değil, bir sonraki küçük sürümün işidir.

**Y21. [EKSİK] Kullanım koşullarındaki mutlak söz.**
- Bugün yayındaki metin: "Askeri uçaklar haritada, aramada ve API'de gösterilmez." (`packages/i18n/src/messages/tr.ts` → `terms.privacy.military`).
- Kodda bu söz yalnız adsb.lol'ün askerî bitiyle yerine getiriliyor. Açık sentezde ve DECISIONS'ta yazılı. Bilinen bir açıkla bu mutlak sözü vermek iki risk taşır:
  - Tüketiciyi yanıltan bir beyandır.
  - Ceza soruşturmasında "açığı biliyordu" kanıtına dönüşür (TCK 22/3).
- Metin dürüst olmalı. Örnek: "Askerî ve devlet uçaklarını tespit kurallarımızla gizleriz; bu kurallar kusursuz değildir. Görünmemesi gereken bir uçak görürseniz bize bildirin."
- PIA ve LADD cümlesi de kapsamı doğru söylemeli (B6 uygulanırsa güncellenmeli).

---

## 3. Atlanan kanunlar ve makamlar

Görevde özellikle sorulan makamlar (RTÜK, İletişim Başkanlığı, MİT, Jandarma) dahil.

| Makam / hüküm | Bize dokunur mu | Ne yapılmalı |
|---|---|---|
| **TCK 135 ve 136** (kişisel veriyi hukuka aykırı kaydetmek 1–3 yıl; yaymak 2–4 yıl). Şikâyete bağlı değil (TCK 139); KVKK md. 17/1 bu maddelere gönderir [K2, K9] | **Evet.** KVKK md. 5'te geçerli bir dayanağı olmadan özel uçak izini yayımlamak doğrudan 136'dır. Sentez yalnız TCK 138'i anıyor | Meşru menfaat dayanağı yazılı denge testiyle kurulur. Özel uçakta kimlik, geçmiş, takip ve bildirim varsayılan olarak kapalı olur (P4). Konu avukata öncelikle sorulur |
| **5651 md. 4/1:** "İçerik sağlayıcı … her türlü içerikten sorumludur" [K1] | Evet. "adsb.lol'ün verisini yalnızca aktarıyoruz" savunması yok | Bütün süzme yükü bizdedir (sentezle aynı sonuç, eksik dayanak) |
| **5651 md. 9/A** (özel hayat) [K1] | Evet | Y19 |
| **7545 Siber Güvenlik Kanunu md. 16/1:** Yetkili mercilerin istediği "bilgi, belge, yazılım, veri ve donanımı" vermemek ya da alınmasını engellemek: 1–3 yıl hapis ve adli para cezası. 7590 ile değişti [K8] | Evet. 5651'in yetkili makamı da artık SGB. Bilgi talebi doğrudan bize gelebilir | Talebi yanıtlama prosedürü (runbook). Talep geldiğinde silme işinin durdurulması (P10) |
| **2937 MİT Kanunu md. 27/2-3:** MİT mensuplarının kimliklerini, görev ve faaliyetlerini ifşa: 3–7 yıl; internetten yayımda, 5651 md. 4'e göre sorumlu olanlar dahil: 3–9 yıl [K5] | MİT'in hava araçlarının hareketi "faaliyet" sayılabilir [BELİRSİZ]. md. 8/1-ç yalnız 27/1-2'yi kataloğa almış; 27/3 ise doğrudan ceza hükmü | A13'teki MİT maddesi kırmızı çizgi olarak yazılır. Cezanın asıl dayanağı 8/A değil, 27/3'tür |
| **2937 md. 27/4 ve md. 28:** MİT'in taleplerine öncelikle uyulur; yükümlülüğü yerine getirmemek: 2–4 yıl [K5] | Veri ya da log talebinde | Runbook'a "MİT veya SGB bilgi talebi" bölümü |
| **2920 md. 51:** Uçak sicili alenidir [K4] | Denge testinde | Y18 |
| **TCK 22/3** (bilinçli taksir) [K2] | Bilinen ve belgelenmiş açıklarda | Y21 ve kapı |
| **TCK 281** (delil yok etme): kişinin kendi suçu için ceza yok, ama başkasının suçunun delili için var [K2] | A15'teki "geçmişten silme" bir soruşturmadan *sonra* yapılırsa sorun olur | Silme kuralı önceden yazılı ve otomatik olmalı. Resmî talep gelince yalnız ilgili kayıtlar dondurulur (P10) |
| **TMK 3713 md. 6:** "terörle mücadelede görev almış kamu görevlilerinin hüviyetlerini" açıklamak ya da "hedef göstermek": 1–3 yıl [K10] | Düşük. Polis ya da jandarma helikopterinin konumu kimlik açıklamaz | Güvenlik helikopterleri A13 ile zaten gizlenir |
| **KVKK md. 16 (VERBİS)** [K9] | Muafiyet olası | Y11 |
| **KVKK md. 28/1-c** (ifade özgürlüğü istisnası) [K9] | Zayıf: istisnanın kendisi "millî güvenliği … ihlal etmemek ya da suç teşkil etmemek kaydıyla" geçerli | Avukata yalnız yan dayanak olarak sorulur |
| **TBK md. 20–25 ve 115; 6502 md. 5** | Kullanım koşullarının bağlayıcılığı. Ağır kusurdan sorumsuzluk anlaşması kesin hükümsüzdür. Ücretli dönemde haksız şart denetimi gelir | "Olduğu gibi" maddesi bu sınırlara göre yazılır (P5) |
| **7578** (RG 01.05.2026/33240, yürürlük 1.11.2026): sosyal ağ sağlayıcılarına 15 yaş altına hizmet yasağı, ebeveyn denetimi; oyun platformları [K14] | Bugün yok. Kullanıcılar içerik paylaşabilirse ("sosyal ağ sağlayıcı", 5651 md. 2/s) doğar | Kırmızı çizgilere eklenir: yorum, paylaşılan takip listesi, fotoğraf yüklemesi gibi sosyal özellik eklenmez |
| **RTÜK (6112 md. 29/A)** | Hayır. Yalnız radyo, televizyon ve isteğe bağlı yayın hizmetlerini kapsıyor (2. kol) | ATC sesi, web kamerası ya da canlı video eklenirse RTÜK de devreye girer; bu yüzden kırmızı çizgidir |
| **İletişim Başkanlığı (5187)** | Yalnız site "internet haber sitesi" sayılırsa; izin ya da kayıt yükümlülüğü yok [K12] | Sentezin D9'u yeterli |
| **Jandarma ve EGM** | Düzenleyici değiller; kolluk olarak işlem yaparlar. İncirlik'te gözaltıyı Emniyet yaptı [K30] | Kriz modu |
| **MSB ve Genelkurmay** | 2565 izinleri, suç duyurusu pratiği (2. kol H6) | Sentezle aynı |
| **DHMİ** | Ceza yetkisi görünmüyor. İlgisi AIP telifi; kendi alıcının anteni hava alanı yakınındaysa mânia onayı gerekebilir [BELİRSİZ] | Kendi alıcıdan önce sorulur. Alıcı ayrıca askerî yasak ya da güvenlik bölgesine kurulmaz; 2565 md. 7/1-e "cihaz kullanılması"nı da yasaklıyor [K3] |
| **BTK** | 7590'dan sonra 5651'deki yetkisi kalmadı; kendi alıcı için frekans konusunda yetkili | Sentezle aynı |

---

## 4. Eksik ya da zayıf pratik korumalar

**P1. Tek kişiyle 4 saat:**
- **Kapatma düğmesi:** Admin'de canlı katmanı tek dokunuşla kapatan bir düğme. Bütün canlı katman birkaç dakikada kapanabildiği sürece her 8/A ve 9/A kararı karşılanabilir. Ayrıntılı süzgeç sonra uygulanır.
- **İkinci kişi:** Güvenilir bir kişiye yalnız bu düğmeyi kullanabileceği bir admin yetkisi verilir ve birlikte bir kez denenir.
- **Uyarı kuralı:** `gov.tr` ve `esb.org.tr` uzantılı adreslerden gelen her e-posta ile "8/A", "erişimin engellenmesi" ve "karar" geçen e-postalar telefonda alarm çaldırır.
- **Otomatik kapatma yok:** E-posta gelince canlı katmanı kendiliğinden kapatmak önerilmez. Sahte bir e-postayla siteyi durdurmak kolaylaşır.

**P2. Paylaşılan VPS ve alan adı.**
- Türkiye'deki erişim engelleri DNS, IP ya da SNI düzeyinde uygulanır. VPS başka projelerle paylaşıldığı için IP engeli o projeleri de düşürür.
- Alan adı engellenirse `analiz.airline.live` ve `api.` de gider.
- Öneri: airline.live için ayrı bir IP ya da VPS. Analiz uygulaması için ayrı bir alan adı düşünülebilir.
- Bu bir mimari değişikliktir; DUR-SOR 5 kapsamında kullanıcı onayı gerekir.

**P3. Bildirim kanalları yalnız info@ değil.** 5651 md. 3/3 ve 6/A-11'e göre şu kanallar da geçerli [K1]:
- sitede görünen her adres
- alan adının WHOIS iletişim adresi (gizlilik vekili varsa yönlendirmesi çalışmalı)
- Hostinger hesabının e-postası ve abuse kanalı (Hostinger bir şikâyet üzerine VPS'i askıya alabilir)

Şirket kurulursa e-Tebligat (UETS) ve KEP de izlenmeli.

**P4. Özel uçaklar.**
- Bugün takip listesindeki her uçağın ince izi "konumdan bağımsız" 30 gün tutuluyor (`docs/spec/domain.md`, `track_points_fine` (b)). Yaklaşma ve iniş bildirimleri de özel uçaklar için açık. Bu, tek tek kişileri izlemeye yarayan bir araçtır: TCK 136 riski taşır, KVKK md. 4'teki ölçülülük ilkesine de aykırı düşer.
- Öneri: Ticari olmayan uçaklarda (en azından TC- tescilli ve LADD/PIA uçaklarda) şunlar varsayılan olarak kapalı olur:
  - takip
  - bildirim
  - ince iz
  - uçuş sayfası

**P5. Kullanım koşulları:**
- mutlak sözler kaldırılır (Y21)
- uygulanacak hukuk ve yetkili mahkeme yazılır
- sorumluluk sınırı TBK 115'e göre yazılır
- kullanım kısıtları ODbL'yle çatışmayacak biçimde hizmete yazılır (Y14)
- iletişim ve bildirim-kaldırma bağlantısı eklenir
- metni "kabul ettirmenin" yöntemi seçilir (TBK 20–25)

**P6. Özen kanıtının saklanması.** Sentez logları en çok 30 gün tutmayı öneriyor. Bu kişisel loglar için doğrudur. Özeni kanıtlayan kayıtlar ise kişisel veri değildir ve ayrı tutulmalıdır:
- filtre kurallarının sürüm geçmişi
- hangi sürümün ne zaman yayına çıktığı (Dokploy kaydı, GitHub Release)
- admin işlem kaydı
- kapatma düğmesinin kaydı

Bu kayıtlar dava zamanaşımı boyunca tutulmalı: 5 yıla kadar hapis cezası gerektiren suçlarda 8 yıl, daha ağırlarında 15 yıl (TCK 66/1-d,e) [K2]. Git geçmişi ve DECISIONS bu işi görür, ama ikisi de iki yönlü keser (Y21).

**P7. Liste ve koordinatların gizliliği.**
- GHCR paketleri herkese açık (CLAUDE.md, D-068). VIP ve devlet tescil listesi, coğrafi süzgecin çokgenleri ya da askerî hex aralıklarının özel listesi koda gömülürse imajla birlikte yayımlanmış olur.
- Bu listeler veritabanında ya da yalnız çalışma anında okunan yapılandırmada tutulur; ya da paketler gizli yapılır.
- D-107 bir öncül gösteriyor: üslerin adları istemci paketine sızmış, gözden geçirmede bulunmuştu. Üslerin ICAO kodları ise bugün hâlâ istemci paketinde. Kod kamuya açık bilgi olsa da bu, "hiçbir yerde" kuralıyla çelişiyor.

**P8. Ek tespit kuralları (B'den A'ya):**
- **MLAT ve TIS-B:** Sivil kimliği doğrulanmayan, havayolu dışındaki uçakların MLAT ve TIS-B konumu gösterilmez (B2). Gerekçe: Kendi konumunu yayımlamayan bir uçağın konumunu hesaplayıp göstermek, "niteliği itibarıyla gizli" bilgi tartışmasının en zayıf noktasıdır.
- **Yayıcı kategorileri:** C1 ve C2 (yer araçları), C3–C5 (engeller) ve B6 (İHA) gizlenir [BELİRSİZ: kodlar DO-260B ve readsb belgelerinden doğrulanmalı]. Havalimanı güvenlik araçlarının konumu Ulusal Sivil Havacılık Güvenlik Programı'na dokunur.
- **TRK öneki:** VRS fixture'ında `TRK` = "Turkish Airlines General Aviation" (`tools/fixtures/vrs/airlines.csv:5288`). VIP uçuşlarla ilişkisi doğrulanana kadar çağrı kodu kuralına aday olarak alınır.

**P9. Kriz modunu açan durumlar yazılı olmalı.** Örnekler:
- terör saldırısı
- darbe girişimi
- askerî uçak kazası
- sınır ötesi harekât
- OHAL
- seferberlik
- bir mahkemenin yayın yasağı

Varsayılan eylem de önceden seçilmeli: Türkiye hava sahasındaki havayolu dışı bütün uçakları gizlemek ya da canlı katmanı kapatmak. Böylece karar anında tartışma çıkmaz, açılış da bir kayıtla belgelenir.

**P10. Silme ile delilin korunması.**
- Saklama süresi dolan veriyi silmemek TCK 138'e giriyor. Bir soruşturma başladıktan sonra seçerek silmek ise kötü görünür ve başkasının suçunun delili için TCK 281 riski taşır.
- Kural: Silme işleri önceden yazılı ve otomatiktir. Resmî bir talep gelince yalnız ilgili kayıtlar dondurulur. Talep silmeyi istiyorsa silinir. Hangisi yapıldıysa kaydedilir.

**P11. Şirket.**
- Limited şirket hukuki ve idari sorumluluğu kısmen şirkete taşır, ceza sorumluluğunu taşımaz: "Ceza sorumluluğu şahsidir" (TCK 20) [K2].
- Künyede ev adresi yerine işyeri adresi yazılabilir.
- Ücretli plan planlandığı için E19 öne alınabilir.

---

## 5. Düzeltilmiş öncelik ve açılış kapısı

**Şimdi (canlı katmandan bağımsız; bir sonraki küçük sürüm):**
1. `/gizlilik`, çerez aydınlatması ve künye (Y20)
2. Kullanım koşullarındaki mutlak sözün düzeltilmesi (Y21)
3. Bütün bildirim kanallarının telefondan izlenmesi (P3)
4. VERBİS muafiyetinin yazılı değerlendirmesi (Y11)

**Kapı (bunlar olmadan `CONTACT_EMAIL` girilmez):**
1. **Worker'da süzme.** Kapsadıkları:
   - adsb.lol'ün askerî biti
   - VRS'in askerî aralıkları
   - askerî çağrı kodu önekleri
   - VIP ve devlet listesi (sunucuda, imaja girmeden; P7)
   - MLAT ve TIS-B kuralı ile yayıcı kategorileri (P8)
   - geniş üs listesine ve irtifaya göre coğrafi süzgeç (Y9, Y10)
2. **Kapatma düğmesi:** ikinci kişiyle bir kez denendi; 8/A ve 9/A runbook'u yazıldı (P1).
3. **Özel uçak varsayılanları:** takip, bildirim ve ince iz kapalı (P4).
4. **Gizleme talebi yolu** yayında (Y19).
5. **ODbL:** `/acik-veri` yayında; lisans bildirimi API'de, WS'te ve OG görsellerinde.
6. **Avukat görüşü:** Ceza hukuku soruları (E1–E5, §6) yazılı yanıtlandı.
7. **Yurt dışı aktarım:** Yol *seçildi* (Y12). Sürecin yalnız başlatılmış olması yetmez.
8. **Ayrı IP** kararı verildi (P2).

**Sonra:** ücretli dönem, kendi alıcı, Parça 5.

---

## 6. Avukata eklenecek sorular

1. **TCK 136 ve KVKK md. 5/2-f:** Özel uçak izini yayımlamak hangi koşulda "hukuka aykırı yayma" olur? Türk Kurulu'nun meşru menfaat uygulaması IMY'den ne kadar sert? P4'teki varsayılanlar yeterli mi?
2. **Suç duyurusu:** 8/A/4 kapsamında yapılan suç duyurularının uygulamada nasıl ilerlediği. 8/A kararına itiraz yolu ve süresi (CMK 268) [BELİRSİZ: süre doğrulanmadı].
3. **TCK 338:** Kapsamı ("ilgili kişiler"). API ve geçmiş oynatma bu kapsamda risk mi?
4. **Bilinçli taksir (TCK 22/3):** Açıkları belgeleyen iç kayıtlar (DECISIONS, bu araştırma) bir soruşturmada nasıl değerlendirilir?
5. **MİT Kanunu md. 27/3:** MİT'e ait ya da MİT'in kiraladığı hava araçlarının hareketleri "faaliyet" sayılır mı?
6. **7545 md. 16/1:** Bir gerçek kişiye hangi talepler yapılabilir? Biçimi, süresi ve doğrulanması ne olur?
7. **Delilin korunması:** Silme yükümlülüğü (TCK 138) ile delilin korunması (TCK 281, CMK) çatışınca ne yapılmalı?
8. **Künye:** Gerçek kişi için sanal ofis ya da işyeri adresi yeterli mi, VKN gerekir mi (Y7)?
9. **Kullanım koşulları:** Bağlanma yöntemi (TBK 20–25) ve sorumluluk sınırının geçerliliği (TBK 115) nasıl kurulmalı?

---

## 7. Kaynaklar (hepsi 2026-10-15'te okundu)

- **K1** 5651, güncel metin (7590 işlenmiş; md. 2, 3, 4, 5, 6/A-11, 8, 8/A, 9, 9/A, değişiklik tablosu): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5651.pdf (`legal/src/5651.txt`)
- **K2** TCK 5237 (md. 13, 20, 22, 66, 134–139, 217/A, 281, 285, 329–339): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5237.pdf
- **K3** 2565 (md. 7, 21, 25, 26): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2565.pdf
- **K4** 2920 (md. 2, 3, 43, 51): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2920.pdf
- **K5** 2937 MİT Kanunu (md. 27, 28): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2937.pdf (`legal/crit/2937.txt`)
- **K6** 2935 OHAL Kanunu (md. 11, 25): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2935.pdf
- **K7** 2941 Seferberlik ve Savaş Hali Kanunu (md. 3, 18): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.2941.pdf
- **K8** 7545 Siber Güvenlik Kanunu (md. 3, 16; 7590 değişiklikleri): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.7545.pdf
- **K9** 6698 KVKK (md. 5, 9, 10, 16, 17, 18, 28): https://www.mevzuat.gov.tr/mevzuatmetin/1.5.6698.pdf
- **K10** 3713 TMK (md. 6): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.3713.pdf
- **K11** 5809 (md. 37, 51/2): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5809.pdf
- **K12** 5187 (md. 2/m-ö): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5187.pdf
- **K13** 6563 (md. 12): https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6563.pdf
- **K14** 7578, RG 01.05.2026/33240 (md. 22, 23, 27): https://www.resmigazete.gov.tr/eskiler/2026/05/20260501-1.htm
- **K15** İmha Yönetmeliği (md. 5, 7, 11, 12): https://www.resmigazete.gov.tr/eskiler/2017/10/20171028-10.htm
- **K16** 5651 Usul ve Esaslar Yönetmeliği, md. 5 [İKİNCİL yayıncı]: https://www.lexpera.com.tr/mevzuat/yonetmelikler/internet-ortaminda-yapilan-yayinlarin-duzenlenmesine-dair-usul-ve-esaslar-hakkinda-yonetmelik
- **K17** KVKK, ilke kararı 2026/347 duyurusu: https://www.kvkk.gov.tr/Icerik/8710/veri-sorumlulari-tarafindan-acik-riza-ve-aydinlatma-metinlerinin-ayri-ayri-duzenlenmesi-gerektigi-hakkinda-kisisel-verileri-koruma-kurulunun-18-02-2026-tarihli-ve-2026-347-sayili-ilke-kararina-iliskin-kamuoyu-duyurusu
- **K18** 2026 KVKK cezaları [İKİNCİL]: https://cottgroup.com/tr/mevzuat/item/yeniden-degerleme-oranina-gore-2026-yili-kvkk-idari-para-cezalari
- **K19** VERBİS istisnası, RG 01.10.2025/33034 [İKİNCİL]: https://cottgroup.com/tr/blog/kvkk-gdpr/item/verbise-kayit-zorunlulugu-istisnalarinda-degisiklik
- **K20** IMY, DI-2021-3397, 2025-06-30: https://www.edpb.europa.eu/system/files/2025-08/se-2025-06-decision-public_0.pdf (`legal/crit/imy.txt`)
- **K21** ODbL 1.0 (md. 4.3, 4.6, 4.7, 9.1, 9.4, 10.4): https://opendatacommons.org/licenses/odbl/1-0/
- **K22** adsb.lol ana sayfa ("unfiltered"): https://www.adsb.lol/
- **K23** adsb.lol gizlilik ve lisans (tazminat, "as is", CC0 feragati): https://www.adsb.lol/privacy-license/
- **K24** adsb.lol API belgesi ("License: ODbL 1.0"): https://www.adsb.lol/docs/open-data/api/
- **K25** adsb.lol API kaynak kodu (UA denetimi yok; OpenAPI açıklaması): https://raw.githubusercontent.com/adsblol/api/main/src/adsb_api/app.py
- **K26** DHMİ AIP ENR 5.1 (01 OCT 26): https://www.dhmi.gov.tr/AIPDocuments/LT_ENR_5_1_en.pdf (`legal/src/aip-enr51.txt`)
- **K27** DHMİ AIP GEN 0.1 §5: https://www.dhmi.gov.tr/AIPDocuments/LT_GEN_0_1_en.pdf
- **K28** Hostinger veri merkezleri: https://www.hostinger.com/support/1583267-where-are-hostinger-servers-located/
- **K29** OpenFreeMap şartları (14.10.2026): https://openfreemap.org/tos
- **K30** NTV, İncirlik soruşturması, 02.03.2026: https://www.ntv.com.tr/turkiye/incirlik-hava-ussunden-canli-yayin-sorusturmasi-5-kisiye-adli-kontrol-1714231
- **Bu eleştiride yeniden açılmayanlar:** 2. kolun H5 (MİT tırları) ve H6 (C-130) kaynakları (`legal/track2.md` §3).
- **Repo (salt okunur):**
  - `docs/DECISIONS.md` (D-107)
  - `docs/spec/domain.md` (iz tabloları, D-107 sınırı)
  - `packages/providers/src/live/response.ts`
  - `packages/providers/src/aircraft.ts`
  - `apps/web/src/lib/terms.ts`
  - `packages/i18n/src/messages/tr.ts` (`terms`)
  - `tools/fixtures/vrs/airlines.csv`
