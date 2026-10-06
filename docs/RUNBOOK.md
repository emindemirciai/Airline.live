# İşletim el kitabı

Üretimde bir şey ters gittiğinde izlenecek adımlar. Ajan üretim DB'sine ve Dokploy ayarlarına kendiliğinden dokunmaz (CLAUDE.md DUR-SOR 4). Aşağıdaki adımları kullanıcı yapar ya da ajana açıkça izin verir. Parça 4 bu dosyayı tamamlar.

## adsb.lol API anahtarı istemeye başladı (401/403)
**Belirti:** admin Servisler'de "Canlı veri · adsb.lol" satırı "Çalışmıyor"; devre "yapılandırma hatası". hy-worker-rt logunda `adsblol config error` satırı var.

**Ne olur:** 401/403 kısıtlama değil politika ya da yapılandırma hatasıdır. Worker devreyi kalıcı açar ve süreç yeniden başlayana kadar adsb.lol'e istek atmaz (D-073). Harita son veriyi 120 sn tutar, sonra boşalır.

1. **Duyuruyu kontrol et:** https://status.adsb.lol ve https://github.com/adsblol/api. Anahtar zorunluluğu mu geldi, yoksa User-Agent'ımız mı reddediliyor?
2. **User-Agent:** Dokploy Environment'ta `CONTACT_EMAIL` dolu mu? User-Agent `havayolu/<sürüm> (+https://havayolu.live; <e-posta>)` biçiminde gider. Boş ya da `node` UA 403 alır.
3. **Anahtar istendiyse:**
   - adsb.lol anahtarı besleyicilere verir (kendi alıcımız yok, D-006). Seçenekler: alıcı kurup beslemek ya da info@adsb.lol'e yazmak.
   - Anahtar alınınca Dokploy'a `ADSBLOL_API_KEY` ve istenen başlık adıyla `ADSBLOL_API_KEY_HEADER` girilir.
4. **Yeniden başlat:** Dokploy'da hy-worker-rt yeniden başlatılır ya da yeniden deploy edilir; devre açılışta kapanır.
5. **Doğrula:** 2 dk içinde admin satırı "Çalışıyor" olur. Sağlık kaydı dakikada bir yazıldığı için "Son başarılı yanıt" bir dakikaya kadar eski görünebilir.

Başka bir canlı kaynağa geçmek DUR-SOR'dur (lisans kaydı, data-sources.md).

## Sağlayıcı kesintisi ve 429 fırtınası
**Belirti:** admin satırı "Sorunlu" (429/5xx oranı > %20 ya da tazelik > 40 sn) ya da "Çalışmıyor" (60 sn boyunca başarılı yanıt yok). "429 oranı (1 sa)" yükseliyor.

**Ne olur (otomatik):**
- 429/420'de istek hızı yarıya iner (alt sınır 0,05 istek/sn) ve üstel bekleme (15 → 300 sn) başlar.
- 5xx ve ağ hatası 5 kez üst üste gelirse devre 60 sn açılır, sonra tek deneme yapılır.
- Temiz geçen her 10 dk'da hız %10 toparlanır (üst sınır 0,2).
- Olay motoru geldiğinde (Parça 2), muhtemel iniş tespiti kesinti boyunca bastırılır (domain.md → Kesinti bastırma).

**Kontrol:**
1. https://status.adsb.lol: genel bir kesinti var mı?
2. **Tek taraflı kısıtlama:** Genel kesinti yoksa sorun VPS IP'sine özgü olabilir. Başka bir ağdan tek istekle denenir:

   ```bash
   curl -s -o /dev/null -w '%{http_code}' -A 'havayolu/test (+https://havayolu.live)' https://api.adsb.lol/v2/point/41.27/28.73/5
   ```

   Bu canlı bir istektir; yalnızca kullanıcı çalıştırır.
3. **Süreklilik:** 429 oranı saatlerce %20'nin üstünde kalırsa `ADSBLOL_RPS` düşürülebilir (en az 0,05); Dokploy env'i değişir ve worker yeniden başlar. Hızı 0,2'nin üstüne çıkarmak yalnızca 24 saatlik ölçüm ve DECISIONS kaydıyla yapılır (data-sources.md).
4. **Kapsama raporu:** Kesinti uzarsa M7 kapsama raporu o saatleri ayrı gösterir; iniş kalitesi yorumlanırken dikkate alınır.

## aviationweather.gov 403 ya da 429 (hava durumu)
**Belirti:** admin Servisler'de "Hava durumu · aviationweather.gov" satırı "Sorunlu" (429 engeli, son denetimden yeni hata ya da taze gözlemli istasyon yok) ya da "Çalışmıyor" (METAR denetimi 2 sa'ten eski ya da 403 engeli). Ayrıntıda hata ve engelin bitiş saati yazar. hy-worker-bg logunda `weather` satırları var.

**Ne olur (otomatik, D-078):**
- **429:** İş içinde yeniden denenmez. Worker `max(Retry-After, 10 dk)` boyunca istek atmaz; zamanlanmış çalışmalar istek göndermeden atlanır, sonra kendiliğinden devam eder.
- **403:** Worker 1 sa istek atmaz, satır "Çalışmıyor" olur. Bu bir kısıtlama değil, kaynağın davranışının değiştiği anlamına gelir (DUR-SOR 3): ajan kendiliğinden bir şey değiştirmez, kullanıcıya bildirir.
- **5xx, zaman aşımı:** 60 sn sonra bir kez yeniden denenir; sonraki zamanlanmış çalışma yine dener.
- Sayfa ve harita son geçerli raporu yaşıyla göstermeye devam eder; 3 sa'ten eski rapor "Eski gözlem", 12 sa'ten eskisi "güncel rapor yok" olur. Hiçbir rapor uydurulmaz ya da başka havalimanından alınmaz.
- **Engel bitince kayıt dolar:** ilk başarılı METAR isteği son başarılı denetimden bu yana geçen süreyi (+1 sa, en çok 24 sa) ister; METAR/TAF kaydında delik kalmaz. İstasyonlar listelenen havalimanlarıdır (3. halkayla 61 + 75 + 89 + 278 = 503; D-107'den beri askerî üsler hariç 56 + 75 + 89 + 278 = 498; D-080, D-088, D-090, D-107): bu istek onları geriye bakışa göre gruplara böler (24 saatlik doldurmada istek başına 6 istasyon, 83 istek), sonra olağan 7 METAR isteğine (80 × 6 + 18 istasyon) döner. İki isteğin başlangıcı arasında en az 700 ms geçer (`AWC_MIN_REQUEST_INTERVAL_MS`): 83 isteklik doldurma ~1 dk sürer ve dakikada 100 sınırının altında kalır (en çok 86). Listeye yeni giren ya da son 24 saatte hiç METAR'ı saklanmamış istasyon da worker süreci başına bir kez 24 saatle istenir (yeni halka yayını, worker yeniden başlatması). 24 saatten uzun kesintinin en eski kısmı ve kesintide yerini yenisine bırakan TAF'lar alınamaz.

**Kontrol:**
1. https://aviationweather.gov/data/api/ ve https://aviationweather.gov/data/feed/changelog.json: yeni bir kısıt, parametre değişikliği ya da duyuru var mı? Belgelenmemiş parametreler 400 döner (v4.26).
2. Sıklık: worker olağan durumda saatte ~96 istek atar (3. halkayla 498 istasyon, D-090, D-107): METAR 5 dk'da bir 7 istek (saatte 84), TAF 15 dk'da bir 3 istek (saatte 12); iki isteğin başlangıcı arasında en az 700 ms vardır (herhangi bir dakikada en çok 86 istek); sınır dakikada 100'dür. Sayılar istasyon kümesiyle değişir; güncel hâli data-sources.md §5 → "İstek düzenimiz"dedir. **Gerçek sayı günlüktedir** (D-101): hy-worker-bg'nin `hava durumu güncellendi` satırının `result.requests` alanı o çalışmada AWC'ye atılan istek sayısıdır (gruplar, 400 kayıt sınırındaki bölünmeler ve 24 saatlik doldurma dahil; `job` METAR için `weather-metar`, TAF için `weather-taf`). Olağan değer METAR 7, TAF 3'tür. TAF'ta 3'ten büyük değer grupların 400 kayıt sınırında bölündüğünü gösterir (grup başına en çok 7); sıklaşırsa TAF grubu 200'den 100'e indirilir (D-090). Yeni halka yayınından ya da worker yeniden başlatmasından sonraki ilk METAR çalışması daha büyüktür (3. halkada 50). Yeni rapor yazılmayan çalışma yalnız `debug` düzeyinde (`hava durumu kontrol edildi`) yazılır, üretim günlüğünde görünmez. `hava durumu: yanıt 400 kayıt sınırında` uyarısı da `requests` taşır. 429 sürüyorsa aynı IP'den başka bir uygulamanın AWC'ye istek atıp atmadığına bak (sunucu başka projelerle paylaşılır).
3. User-Agent: `havayolu/<sürüm> (+https://havayolu.live; <CONTACT_EMAIL>)` biçiminde gider. AWC özel User-Agent önerir.
4. **Engel kalkmıyorsa:** NWS yönergesi engellenen kullanıcının sdm@noaa.gov'a yazmasıdır. Bu e-postayı kullanıcı gönderir; içerik: uygulamanın tanımı, istek sıklığı (olağan durumda saatte ~96 istek: 498 istasyon, METAR 5 dk'da bir 7 istekte, TAF 15 dk'da bir 3 istekte; kesintiden sonra bir kez 24 saatlik doldurma, 83 istek; iki istek arasında en az 700 ms), User-Agent ve VPS IP'si. Göndermeden önce sayıları data-sources.md §5'le karşılaştır.
5. Tek istekle elle deneme canlı bir istektir; yalnızca kullanıcı çalıştırır:

   ```bash
   curl -s -o /dev/null -w '%{http_code}' -A 'havayolu/test (+https://havayolu.live)' 'https://aviationweather.gov/api/data/metar?ids=LTFM&format=json'
   ```

Toplu önbellek dosyalarına (`/data/cache/…`) ya da başka bir hava durumu kaynağına geçmek DUR-SOR'dur (lisans kaydı, data-sources.md §5; önbellek XML'inde basınç inHg'dir).
