# Dokploy kurulumu (bir kez)

Bu adımları bir kez uygularsın. Sonrasında `main`'e birleşen her PR, CI yeşilse kendiliğinden yayına çıkar. Yayın hattının nasıl çalıştığı: `docs/spec/infra.md` → CI/CD, karar D-064.

Kurulum bitene kadar CI yeşil kalır: imajlar derlenir, yayın adımı "YAYINLANMADI: Dokploy kurulumu tamamlanmadı" özetiyle atlanır.

**Önkoşullar**
- DNS kayıtları yayılmış olmalı. Her biri `72.62.53.122` döndürmeli:

  ```bash
  nslookup airline.live 1.1.1.1
  ```

  Aynısını `api.airline.live`, `admin.airline.live`, `analiz.airline.live` ve `www.airline.live` için de dene. Önceki alan adının kayıtları (`havayolu.live`, `www`, `api`, `admin`, `analiz`) da yerinde kalır: kalıcı yönlendirmeler (D-112) onlarla çalışır.
- VPS'e SSH erişimin ve Dokploy paneline yönetici girişin olmalı.

## 1. Dokploy sürümü ve güvenlik
1. **Sürüm:** Panelde Settings → Web Server'da sürüm en az **v0.30.7** olmalı. Eskiyse güncelle; eski sürümlerde komut enjeksiyonu açıkları var.
2. **Panel alan adı:** Panel HTTPS bir alan adında açılmalı. `http://IP:3000` kullanılmaz.
   - Zaten bir alan adı varsa onu kullan.
   - Yoksa DNS'e örneğin `panel.airline.live` için A kaydı ekle ve Settings → Web Server → Domain'e gir.
   - Bu adres GitHub'daki `DOKPLOY_URL` olacak (yalnızca API tetiği için).
   - **Panel adresini sonradan değiştirirsen** Dokploy'un GitHub App'lerinin bildirim adresi eski adreste kalır. Dokploy eski adresin yönlendirmesini kaldırdığı için bildirimler Traefik'ten 404 alır ve Autodeploy sessizce durur (2026-09-27'de yaşandı, D-070). Her uygulamada GitHub → Settings → Developer settings → GitHub Apps → uygulama → General → Webhook URL alanını `https://<yeni panel adresi>/api/deploy/github` yap. Sonra Advanced → Recent Deliveries'ten son push'u Redeliver ile dene; yanıt 200 olmalı. Aynı Dokploy'daki diğer projelerin uygulamaları da etkilenir.
3. **Let's Encrypt e-postası:** Settings → Web Server'da gir. Varsayılan `test@localhost.com`'dur, değiştir.
4. **Güvenlik duvarı (SSH):** Docker, yayınladığı portlarda ufw'yi atladığı için `ufw-docker` gerekir. Sonuçta dışarıya yalnızca 22, 80 ve 443 açık kalır; Dokploy paneli (3000) kapanır.
   - **Önemli:** `ufw-docker` kurulunca konteynerlerin yayınladığı **bütün** portlar dışarıya kapanır, Traefik'in 80/443'ü dahil. `ufw allow 80/443` yalnızca sunucunun kendi portlarını açar, Traefik konteynerine ulaşmaz. Bu yüzden aşağıdaki `ufw route allow` satırları şarttır; atlanırsa VPS'teki **bütün siteler** (diğer projeler ve panel dahil) erişilemez olur.
   - **Önce** diğer projelerin dışarıya doğrudan açtığı portları not al; `docker ps` çıktısındaki PORTS sütununa bak (80/443 dışındakiler). Her birine sonra `sudo ufw-docker allow <konteyner> <port>` ile tek tek izin vermen gerekir.
   - Bu adımlar boyunca **SSH oturumunu açık tut**. Bir şey ters giderse `sudo ufw disable` her şeyi eski hâline döndürür.

   Sunucunun kendi portları:

   ```bash
   sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
   ```

   ufw-docker (sabitlenmiş sürüm 251123; indirilen dosyanın SHA-256 değeri kontrol edilir, uyuşmazsa kurulmaz):

   ```bash
   sudo wget -O /usr/local/bin/ufw-docker https://raw.githubusercontent.com/chaifeng/ufw-docker/78366b6afe6e566cd53f7e55341889c2e3c863e7/ufw-docker && echo "c3e5f0bf6061a3a2e7d7ac06abc80665707d2f4c91e90d76f22e4168863fb472  /usr/local/bin/ufw-docker" | sha256sum -c - && sudo chmod +x /usr/local/bin/ufw-docker && sudo ufw-docker install
   ```

   Traefik'in konteyner portları (80, 443 ve HTTP/3 için 443/udp):

   ```bash
   sudo ufw route allow proto tcp from any to any port 80 && sudo ufw route allow proto tcp from any to any port 443 && sudo ufw route allow proto udp from any to any port 443
   ```

   Etkinleştir:

   ```bash
   sudo ufw enable && sudo systemctl restart ufw
   ```

   **Doğrulama**, SSH oturumu hâlâ açıkken ve **başka bir ağdan** (ör. telefonun mobil verisiyle):
   - Panel ve diğer projelerin siteleri açılmaya devam etmeli; örneğin panel alan adın için `curl -sI https://<panel alan adın>` bir HTTP yanıtı dönmeli.
   - Panel portu kapalı olmalı; şu komut zaman aşımına uğramalı:

     ```bash
     curl -m 5 http://72.62.53.122:3000
     ```

   - Siteler açılmıyorsa hemen `sudo ufw disable` çalıştır ve bana haber ver.

## 2. Bellek
- `docker stats --no-stream` ile mevcut kullanımı gör.
- Bu projenin (Dokploy'da `havayolu` Compose uygulaması) bellek üst sınırlarının toplamı ~2,6 GB. Boşta ölçülen kullanım ~290 MB (yerel üretim denemesi).
- Analiz uygulaması ~150–250 MB ekler.
- Boş bellek 3 GB'ın altındaysa 2 GB swap ve `vm.overcommit_memory=1` ayarlarını değerlendir. Bu ayar bütün projeleri etkiler (ACTIVATION'daki satır).

## 3. havayolu Compose uygulaması
1. **Proje ve servis:** Projects → Create Project `havayolu` → Create Service → **Compose**, ad `havayolu`.
2. **Kaynak:** GitHub sağlayıcısı (Settings → Git → GitHub; yoksa bağla).
   - repo `emindemirciai/havayolu`
   - dal **`release`** (`main` değil; D-070)
   - compose dosyası `./docker-compose.yml`
3. **General:**
   - **Autodeploy AÇIK** kalır; Trigger Type "On Push".
   - Neden `release`: `main`'e push geldiğinde yeni imajlar henüz yoktur (CI onları ~15 dk sonra hazırlar). Dokploy `main`'i izleseydi her seferinde bir önceki sürümü yayınlardı. CI, imajları hazırlayıp `:main` etiketini taşıdıktan sonra `release` dalına bir yayın commit'i gönderir; Autodeploy tam o anda doğru imajla çalışır.
   - `release` dalına yalnızca CI yazar; elle push yapma.
   - Advanced → Isolated Deployments kapalı kalır.
   - "Create env file" açık kalır.
4. **composeId (yalnızca API tetiği için):** Servis sayfasının adresindeki son parça: `/dashboard/project/<projectId>/environment/<environmentId>/services/compose/<composeId>`. Dal tetiğinde (varsayılan) gerekmez.

## 4. GHCR erişimi (Registry) — şu an gerekmiyor
GHCR paketleri şu an herkese açıktır ve Dokploy onları girişsiz çeker (2026-09-27 doğrulandı). Paket görünürlüğü repodan bağımsızdır: repo gizli yapıldığında paketler herkese açık kaldı. İmajlar derlenmiş kodu ve kaynak haritalarını içerir; kodu gizlemek istersen paketleri gizli yap (github.com → Packages → paket → Package settings → Change visibility) ve **aynı anda** bu adımı uygula, yoksa Dokploy imaj çekemez (D-068):

1. **PAT oluştur:** github.com → Settings → Developer settings → Personal access tokens → **Tokens (classic)**.
   - Yalnızca `read:packages` yetkisi yeterli.
   - Süre ver, örneğin 1 yıl, ve bitiş tarihini ACTIVATION'a yaz.
2. **Registry'yi ekle:** Dokploy → Settings → Registry → Add.
   - Registry URL `ghcr.io`
   - kullanıcı `emindemirciai`
   - parola: az önce oluşturduğun PAT
   - Dokploy sunucuda `docker login` yapar; compose imajları buradan çeker.

## 5. Environment
1. **Bloğu yapıştır:** Compose → Environment'a `deploy/dokploy.env.example` bloğunu yapıştır.
2. **`#…#` talimatlarını izle (D-063):**
   - `#parola üret#` yazan yerlerde `#…#` kısmını silip değeri yaz.
   - `#boş bırak…#` ve ileri parçaları gösteren satırlar olduğu gibi kalabilir.
3. **Sırları ilk deploy'dan ÖNCE gir:** `ADMIN_SETUP_TOKEN`, `POSTGRES_PASSWORD`, `REDIS_QUEUE_PASSWORD`, `REDIS_LIVE_PASSWORD`.
   - Postgres parolası ilk açılışta veritabanına yazılır.
   - Yalnızca `[A-Za-z0-9_-]` kullan. Her sır için ayrı üret ve parola yöneticine kaydet:

     ```powershell
     $b = New-Object byte[] 36; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b).Replace('+','-').Replace('/','_').TrimEnd('=')
     ```

4. **Kopyalama:** `.env.example`'ı kopyalama (D-060). `GIT_SHA` ve `BUILD_TIME` girilmez.
5. **Bir kez yazılan satırlar:** `POSTGRES_DB`, `POSTGRES_USER` ve `POSTGRES_PASSWORD` ilk deploy'da volume'a yazılır ve bir daha değiştirilmez (marka ya da alan adı değişince de). Değişirse `hy-migrate` veritabanına giremez ve bütün site kapanır (RUNBOOK "Dokploy env'i değişince bütün site kapandı"). Environment'ta bul-değiştir yapma.

## 6. Alan adları (Domains)
Compose servisinin Domains sekmesinde her satır için HTTPS açık, sertifika Let's Encrypt:

| Servis | Alan adı | Port |
|---|---|---|
| `hy-web` | `airline.live` | 3000 |
| `hy-web` | `www.airline.live` (uygulama köke 308 ile yönlendirir) | 3000 |
| `hy-web` | `admin.airline.live` | 3000 |
| `hy-api` | `api.airline.live` | **4000** |

**Eski alan adları (D-112, kalıcı yönlendirme):** önceki alan adının dört adresi aynı servislerde, HTTPS ve Let's Encrypt sertifikasıyla bağlı kalır; silinmez. Uygulama env'deki `LEGACY_*_HOSTS` listeleriyle her isteği aynı yol ve sorguyla 308 ile yeni adrese gönderir (liste boşken eski adresler bugünkü gibi sunulur). Traefik sertifikaları yalnızca bağlı alan adları için yeniler; alan adı kaldırılırsa eski bağlantılar sertifika hatası alır.

| Servis | Alan adı | Port | Yönlendiği adres |
|---|---|---|---|
| `hy-web` | `havayolu.live` | 3000 | `https://airline.live` + aynı yol (`LEGACY_WEB_HOSTS`) |
| `hy-web` | `www.havayolu.live` | 3000 | `https://airline.live` + aynı yol, tek adımda (`LEGACY_WEB_HOSTS`) |
| `hy-web` | `admin.havayolu.live` | 3000 | `https://admin.airline.live` + aynı yol (`LEGACY_ADMIN_HOSTS`) |
| `hy-api` | `api.havayolu.live` | 4000 | `https://api.airline.live` + aynı yol (`LEGACY_API_HOSTS`; WebSocket el sıkışması 308 alır, eski sekme yenilenince yeni adrese bağlanır) |

**Geçişte Environment (D-112; ACTIVATION (b2), v0.25.0 yayındayken).** Satır satır değişenler, yalnız bunlar:

- `APP_NAME`: `havayolu` → `Airline.live`
- `WEB_HOST`: `havayolu.live` → `airline.live`
- `API_HOST`: `api.havayolu.live` → `api.airline.live`
- `ADMIN_HOST`: `admin.havayolu.live` → `admin.airline.live`
- `LEGACY_WEB_HOSTS` (yeni satır): `havayolu.live,www.havayolu.live`
- `LEGACY_ADMIN_HOSTS` (yeni satır): `admin.havayolu.live`
- `LEGACY_API_HOSTS` (yeni satır): `api.havayolu.live`
- `ANALYZE_URL`: `https://analiz.havayolu.live` → `https://analiz.airline.live`
- `ANALYZE_SITE_ID`: `havayolu.live` → `airline.live`
- sonra, ayrı adımda ((b2) doğrulandıktan sonra ve ACTIVATION 2. adımdaki açılış kapısı tamamlanınca, D-115): `CONTACT_EMAIL=info@airline.live`

Aynen kalanlar (dokunma):

- `POSTGRES_DB` ve `POSTGRES_USER` (`havayolu`; iç addır, değişirse veritabanına giriş bozulur ve bütün site kapanır: 2026-10-15 kesintisi, RUNBOOK)
- `POSTGRES_PASSWORD`, `REDIS_QUEUE_PASSWORD`, `REDIS_LIVE_PASSWORD`, `ADMIN_SETUP_TOKEN`
- `IMAGE_TAG`
- bütün `MEM_LIMIT_*` satırları
- öbür bütün satırlar (`ADMIN_EMAIL`, `ESRI_API_KEY`, arama motoru doğrulamaları, `TRUSTED_PROXY_CIDRS` …)

Environment'ta "havayolu" için bul-değiştir yapılmaz: Compose, servis ve veritabanı adları `havayolu` kalır.

Şimdi Dokploy'dan deploy etme: ilk yayın 10. adımdadır ve alan adlarını da o uygular. Sonrasında alan adı değişiklikleri Dokploy'da Deploy ile ya da `deploy.yml`'yi `dry_run=false` ile yeniden çalıştırarak uygulanır.

## 7. Analiz uygulaması (Siteni Analiz Et)
1. **Servis:** Aynı projede ikinci bir **Compose** servisi, ad `analiz`.
   - kaynak `emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-`, dal `main`
   - compose dosyası o reponun `docker-compose.yml`'si
2. **Environment:** `deploy/analiz.env.example` bloğu.
3. **Domain:** servis `analyze` → `analiz.airline.live`, port 3000, HTTPS. Önceki `analiz.havayolu.live` alan adı aynı serviste kalabilir (yönlendirmesi bu reponun dışındadır, analiz uygulamasının işidir).
4. **Not:** Bu uygulama kendi modelinde sunucuda derlenir. Derleme sırasında kısa bir CPU/RAM artışı olur.
5. **Giriş:** Airline.live API'si ayakta olmalı; analiz paneline girişi o doğrular (`ANALYZE_AUTH_API_URL` doğrudan `https://api.airline.live` olmalı: çapraz alan yönlendirmesinde `Authorization` başlığı düşer).

## 8. Dokploy API anahtarı (isteğe bağlı; yalnızca `DEPLOY_TRIGGER=api`)
Varsayılan yayın yolu dal tetiğidir (D-070) ve Dokploy API anahtarı gerektirmez. Bu bölüm ve §9'daki üç secret yalnızca Autodeploy kapatılıp yayının Dokploy API'siyle tetiklenmesi istenirse gerekir; o durumda panelin HTTPS adresi de şarttır (§1).

1. **Anahtarı oluştur:** Settings → Profile → API/CLI → Generate.
   - ad `github-actions`
   - süre **90 gün**
   - organizasyonu seç
   - Bitiş tarihini ACTIVATION'a yaz.
   - Anahtarın isteğe bağlı istek sınırını (rate limit) kapalı bırak; açarsan bir yayın ~100 istek yaptığı için en az 100 istek/15 dk izin ver.
2. **Önerilen:** Anahtarı yalnızca bu projeye erişimi olan bir "deploy-bot" üyesiyle üret.
   - Kapsamı dene: anahtarla başka bir projenin servisini okumaya çalış, 401/403 beklenir.
   - 200 dönerse anahtarı kullanma, bana haber ver.

## 9. GitHub variables (ve API tetiği için secrets)
Dal tetiğinde (varsayılan) yalnızca şu variables gerekir; secret gerekmez:

```bash
gh variable set WEB_URL --repo emindemirciai/havayolu --body https://airline.live
```

```bash
gh variable set API_URL --repo emindemirciai/havayolu --body https://api.airline.live
```

```bash
gh variable set DEPLOY_ENABLED --repo emindemirciai/havayolu --body false
```

İsteğe bağlı: `DEPLOY_BRANCH` (varsayılan `release`), `DEPLOY_TRIGGER` (`branch` varsayılan, `api`). `api` seçilirse şu üç secret da girilir; komutlar değeri kendisi sorar, değer komut geçmişine yazılmaz:

```bash
gh secret set DOKPLOY_URL --repo emindemirciai/havayolu
```

```bash
gh secret set DOKPLOY_API_TOKEN --repo emindemirciai/havayolu
```

```bash
gh secret set DOKPLOY_COMPOSE_ID --repo emindemirciai/havayolu
```

Repo gizlidir (D-068); secrets yalnızca bu repodaki iş akışlarına verilir, yayın yalnızca `main`'de çalışır.

## 10. Deneme ve ilk yayın
1. **Deneme derlemesi:** Yalnızca `sha-<7>` etiketli imajları derler ve gönderir, yayınlamaz:

   ```bash
   gh workflow run deploy.yml --repo emindemirciai/havayolu --ref main -f dry_run=true
   ```

2. **Yayını aç:** Actions'ta iş yeşil bitince yayını aç:

   ```bash
   gh variable set DEPLOY_ENABLED --repo emindemirciai/havayolu --body true
   ```

3. **İlk yayın:** `release` işi `:main` etiketini taşır, `release` dalına yayın commit'ini gönderir (Dokploy Autodeploy başlar); `/version`, `/api/version` ve `/ready` doğrulanana kadar bekler (en fazla ~15 dk).

   ```bash
   gh workflow run deploy.yml --repo emindemirciai/havayolu --ref main -f dry_run=false
   ```

Bundan sonra her birleşen PR aynı yolu kendiliğinden izler.

## 11. Doğrulama listesi
- **API sürümü:** Yeni `gitSha` görünmeli:

  ```bash
  curl https://api.airline.live/version
  ```

- **Web:** https://airline.live/durum sayfasında API "Çalışıyor" görünmeli, sürüm doğru olmalı.
- **Yönetim:** https://admin.airline.live açılmalı; `ADMIN_EMAIL` ve kurulum anahtarıyla giriş yap, Servisler panelinde bütün servisler "Çalışıyor" olmalı.
- **Analiz:** https://analiz.airline.live/login açılmalı ve aynı yönetici hesabıyla girilmeli. `https://analiz.airline.live/api/health` 200 dönmeli.
- **Eski alan adları (D-112, `LEGACY_*_HOSTS` girildikten sonra):** her biri `308` ve aynı yol ile sorguyu taşıyan `location` döndürmeli:

  ```bash
  curl -sI "https://havayolu.live/en/havalimanlari?x=1" | grep -iE "^(HTTP|location)"
  curl -sI "https://www.havayolu.live/istasyon/LTFM" | grep -iE "^(HTTP|location)"
  curl -sI "https://admin.havayolu.live/admin" | grep -iE "^(HTTP|location)"
  curl -sI "https://api.havayolu.live/version?x=1" | grep -iE "^(HTTP|location)"
  ```

  Beklenen `location` değerleri: `https://airline.live/en/havalimanlari?x=1`, `https://airline.live/istasyon/LTFM`, `https://admin.airline.live/admin`, `https://api.airline.live/version?x=1`.

## 12. Bilmen gerekenler
- **Kesinti:** Yayın sırasında birkaç saniyelik kesinti olur. Compose yayını sıfır kesintili değildir.
- **Yalnızca belge değişikliği:** `main`'e her birleşme yayın işini çalıştırır. Canlıdaki sürümden bu yana yalnızca `docs/` ya da `apps/mobile/` değiştiyse Dokploy tetiklenmez ("YAYIN GEREKMEDİ"); kesinti olmaz.
- **Geri alma:** Önceki bir commit'e dönmek için:

  ```bash
  gh workflow run rollback.yml --repo emindemirciai/havayolu --ref main -f sha=<en az 7 karakter>
  ```

  - SHA, `main`'de deploy işinin imaj derlediği bir commit olmalı (PR dalındaki bir commit değil). İmajlardan biri yoksa hiçbir etiket taşınmaz, iş kırmızı biter.
  - Seçilen imajlar `:main` olur ve aynı doğrulama yapılır.
  - Veritabanı şeması geri alınmaz; şema değişiklikleri geriye uyumludur.
  - **Eski alan adları (D-112):** `LEGACY_*_HOSTS` girildikten sonra v0.25.0'dan eski bir SHA'ya dönmek eski alan adlarının 308'lerini kapatır (eski imaj listeyi tanımaz, doğrulama yine yeşildir). Mümkünse en az v0.25.0'a geri al; daha eskiye dönmek gerekirse en az v0.25.0 yeniden yayına çıkana kadar eski adresler yönlendirmesiz sunulur (§11'deki dört `curl -sI` satırıyla denetle).
  - Sonraki birleşme, belge değişikliği bile olsa, canlıdan farkı yayınlar ve sorunlu kodu geri getirir. Bu yüzden geri aldıktan sonra sorunlu değişikliği önce bir PR ile geri al (revert).
- **Parola unutulursa:** Bir parola `#…#` talimatıyla kaldıysa API açılmaz; Dokploy logunda hangisi olduğu yazar.
  - Postgres parolası ilk açılışta veritabanına yazılır. Yanlış girildiyse ve **henüz veri yoksa**:
    1. Dokploy'da havayolu compose'unu durdur (Stop).
    2. Sunucuda volume'u bul ve adının başının Dokploy'daki uygulama adıyla (appName) eşleştiğini kontrol et:

       ```bash
       docker volume ls --filter name=_hy_pgdata
       ```

    3. `docker volume rm <appName>_hy_pgdata` ile sil, Environment'taki parolayı düzelt ve yeniden deploy et.
  - Bu işlem veritabanındaki her şeyi siler; veri varsa önce bana sor.
- **İzleme:** Kendi kurduğun Dokploy'da geçmiş metrik ve uyarı yok. Dış bir uptime kontrolü, örneğin UptimeRobot, dakikada bir `https://airline.live` ve `https://api.airline.live/ready` adreslerine bakmalı (ACTIVATION).
