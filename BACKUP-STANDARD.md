# AI Project Backup Standard

Bu standart, yerel Windows projelerinde **GitHub teslimi + Google Drive tam proje yedeği** oluşturur.

## Standart dosyalar

Her Git repository kök dizinine şu dosyalar eklenir:

```text
push-and-backup.ps1
run-backup.cmd
BACKUP-STANDARD.md
PROJECT-BACKUP-RULES.md
AI-PROMPT.md
```

Mevcut proje `README.md` dosyasına dokunulmaz.

## Google Drive yedek kökü

```text
H:\Drive'ım\Artificial Intelligence - Projects
```

Script proje adını bulunduğu repository kök klasörünün adından otomatik alır.

Örneğin proje kökü:

```text
C:\Projects\Bozkurt Obası
```

ise ilk başarılı yedeklemede şu klasör otomatik oluşturulur:

```text
H:\Drive'ım\Artificial Intelligence - Projects\Bozkurt Obası
```

## Yedek dosya adı

Her ZIP dosyasında tarih ve saat zorunludur:

```text
<Proje Adı>_YYYY-MM-DD_HHMMSS.zip
```

Örnek:

```text
Bozkurt Obası_2026-10-01_031542.zip
```

## Tam yedek politikası

Google Drive ZIP yedeğinde hiçbir proje dosyası veya klasörü yeniden üretilebilir, gereksiz, cache, dependency veya build çıktısı kabul edilerek atlanmaz.

Yedekleme anında repository kökünün altında ne bulunuyorsa ZIP'e alınır. Buna örneğin şunlar da dahildir:

```text
.git
node_modules
dist
build
coverage
cache klasörleri
IDE klasörleri
.env dosyaları
sertifikalar / anahtarlar
yerel konfigürasyonlar
üretilmiş assetler
diğer tüm proje dosya ve klasörleri
```

Boş klasörler de ZIP içine klasör girdisi olarak eklenir.

`.gitignore` yalnızca Git davranışını etkiler; Google Drive tam yedeğinin içeriğini azaltmaz.

Bu yaklaşımın amacı, ZIP açıldığında projeyi yeniden dosya üretmek zorunda kalmadan mümkün olduğunca eksiksiz geri yükleyebilmektir.

> Tam yedek hassas dosyalar içerebilir. ZIP dosyası şifrelenmez.

## GitHub güvenliği

Google Drive tam yedeği tüm proje içeriğini kapsarken GitHub push tarafında hassas dosya güvenliği korunur.

Script, Git tarafından gönderilmek üzere görünen `.env`, private key, certificate, credentials ve benzeri hassas dosyaları tespit ederse GitHub push işlemini durdurur.

Bu kontrol Drive tam yedeğini filtrelemek için kullanılmaz.

## İşlem sırası

1. Git ve repository kontrol edilir.
2. `origin` ve aktif branch belirlenir.
3. GitHub'a gidebilecek hassas dosyalar kontrol edilir.
4. `git add -A` çalıştırılır.
5. Değişiklik varsa commit oluşturulur.
6. Aktif branch GitHub'a push edilir.
7. Push başarısızsa Drive yedeği oluşturulmaz.
8. Push başarılıysa Drive proje klasörü oluşturulur.
9. Repository kökünün tam içeriği tarih-saat damgalı ZIP'e alınır.
10. Varsayılan olarak son **30** tarihli yedek tutulur.

## Boyut politikası

Maksimum yedek boyutu limiti yoktur.

ZIP dosyası 10 GB'ı aşarsa yalnızca bilgi amaçlı uyarı verilir. Yedekleme durdurulmaz, ZIP silinmez ve işlem başarısız sayılmaz.

## Manuel kullanım

```powershell
.\push-and-backup.ps1
```

Özel commit mesajı:

```powershell
.\push-and-backup.ps1 -CommitMessage "feat: sistem güncellendi"
```

Farklı yedek adedi:

```powershell
.\push-and-backup.ps1 -KeepBackups 40
```

Farklı Drive kökü:

```powershell
.\push-and-backup.ps1 -BackupRoot "D:\Yedekler"
```

Projeye özel görünen ad:

```powershell
.\push-and-backup.ps1 -ProjectName "Bozkurt Obası"
```
