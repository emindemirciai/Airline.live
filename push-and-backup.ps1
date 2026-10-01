[CmdletBinding()]
param(
    [string]$CommitMessage = "",
    [string]$ProjectName = "",
    [string]$BackupRoot = "H:\Drive'ım\Artificial Intelligence - Projects",
    [int]$KeepBackups = 30
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[UYARI] $Message" -ForegroundColor Yellow
}

function Fail {
    param([string]$Message)
    Write-Host ""
    Write-Host "[HATA] $Message" -ForegroundColor Red
    exit 1
}

function Test-CommandExists {
    param([string]$CommandName)
    return [bool](Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Is-SafeTemplateSecret {
    param([string]$RelativePath)

    $name = [System.IO.Path]::GetFileName($RelativePath).ToLowerInvariant()
    return @(
        ".env.example",
        ".env.sample",
        ".env.template",
        ".env.production.example",
        ".env.development.example"
    ) -contains $name
}

function Is-SensitivePath {
    param([string]$RelativePath)

    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        return $false
    }

    $normalized = $RelativePath.Replace("\", "/").Trim('"')
    $name = [System.IO.Path]::GetFileName($normalized).ToLowerInvariant()

    if (Is-SafeTemplateSecret $normalized) {
        return $false
    }

    if ($name -eq ".env" -or $name.StartsWith(".env.")) {
        return $true
    }

    if ($name -match '\.(pem|key|pfx|p12|jks|keystore|mobileprovision)$') {
        return $true
    }

    if ($name -eq "credentials.json") {
        return $true
    }

    if ($name -match '^service[-_]?account.*\.json$') {
        return $true
    }

    if ($name -match '^(secret|secrets|credential|credentials)(\..+)?$') {
        return $true
    }

    if ($name -match '^private[-_]?key(\..+)?$') {
        return $true
    }

    return $false
}

function Get-StatusPath {
    param([string]$Line)

    if ([string]::IsNullOrWhiteSpace($Line) -or $Line.Length -lt 4) {
        return ""
    }

    $pathPart = $Line.Substring(3).Trim()

    # Rename/copy satirlarinda "old -> new" gorulebilir.
    if ($pathPart -match ' -> ') {
        $pathPart = ($pathPart -split ' -> ')[-1].Trim()
    }

    return $pathPart.Trim('"')
}

function Assert-NoSensitiveGitFiles {
    Write-Step "Git icin hassas dosya kontrolu"

    $problemFiles = New-Object System.Collections.Generic.List[string]

    $tracked = & git ls-files
    if ($LASTEXITCODE -ne 0) {
        Fail "git ls-files calistirilamadi."
    }

    foreach ($path in $tracked) {
        if (Is-SensitivePath $path) {
            $problemFiles.Add("Takip edilen: $path")
        }
    }

    $statusLines = & git status --porcelain=v1 -uall
    if ($LASTEXITCODE -ne 0) {
        Fail "git status calistirilamadi."
    }

    foreach ($line in $statusLines) {
        $path = Get-StatusPath $line
        if (Is-SensitivePath $path) {
            $problemFiles.Add("Calisma alaninda: $path")
        }
    }

    if ($problemFiles.Count -gt 0) {
        Write-Host ""
        Write-Host "GitHub'a gidebilecek hassas dosya(lar) tespit edildi:" -ForegroundColor Red
        $problemFiles | Sort-Object -Unique | ForEach-Object {
            Write-Host " - $_" -ForegroundColor Red
        }
        Fail "Hassas dosyalar temizlenmeden git add/commit/push yapilmadi."
    }

    Write-Ok "Hassas Git dosyasi tespit edilmedi."
}

function Create-FullZip {
    param(
        [string]$SourceRoot,
        [string]$DestinationZip
    )

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    if (Test-Path -LiteralPath $DestinationZip) {
        Remove-Item -LiteralPath $DestinationZip -Force
    }

    $sourceFull = (Resolve-Path -LiteralPath $SourceRoot).Path.TrimEnd("\")

    $zipStream = [System.IO.File]::Open(
        $DestinationZip,
        [System.IO.FileMode]::CreateNew
    )

    try {
        $archive = New-Object -TypeName System.IO.Compression.ZipArchive -ArgumentList @(
            $zipStream,
            [System.IO.Compression.ZipArchiveMode]::Create,
            $false
        )

        try {
            $items = Get-ChildItem -LiteralPath $sourceFull -Recurse -Force
            $fileCount = 0
            $directoryCount = 0

            foreach ($item in $items) {
                $relative = $item.FullName.Substring($sourceFull.Length).TrimStart("\")
                if ([string]::IsNullOrWhiteSpace($relative)) {
                    continue
                }

                $entryName = $relative.Replace("\", "/")

                if ($item.PSIsContainer) {
                    # Bos klasorlerin de geri yuklenebilmesi icin klasor entry'si eklenir.
                    if (-not $entryName.EndsWith("/")) {
                        $entryName += "/"
                    }

                    $archive.CreateEntry($entryName) | Out-Null
                    $directoryCount++
                }
                else {
                    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                        $archive,
                        $item.FullName,
                        $entryName,
                        [System.IO.Compression.CompressionLevel]::Optimal
                    ) | Out-Null
                    $fileCount++
                }
            }

            if ($fileCount -eq 0 -and $directoryCount -eq 0) {
                throw "ZIP'e eklenecek proje icerigi bulunamadi."
            }

            return @{
                Files = $fileCount
                Directories = $directoryCount
            }
        }
        finally {
            if ($null -ne $archive) {
                $archive.Dispose()
            }
        }
    }
    finally {
        $zipStream.Dispose()
    }
}

# ------------------------------------------------------------
# 1) Proje kokunu belirle
# ------------------------------------------------------------
$ProjectRoot = $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    Fail "Script proje kokunu belirleyemedi."
}

Set-Location -LiteralPath $ProjectRoot

if ([string]::IsNullOrWhiteSpace($ProjectName)) {
    $ProjectName = Split-Path -Leaf $ProjectRoot
}

if ([string]::IsNullOrWhiteSpace($ProjectName)) {
    Fail "Proje adi belirlenemedi."
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "  AI PROJECT - GITHUB + GOOGLE DRIVE BACKUP" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "Proje       : $ProjectName"
Write-Host "Proje yolu  : $ProjectRoot"
Write-Host "Drive kok   : $BackupRoot"
Write-Host "Yedek sayisi: $KeepBackups"

# ------------------------------------------------------------
# 2) Gereksinimler
# ------------------------------------------------------------
Write-Step "Gereksinimler kontrol ediliyor"

if (-not (Test-CommandExists "git")) {
    Fail "Git bulunamadi. Git for Windows kurulu olmali."
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ".git"))) {
    Fail "Bu klasor bir Git repository kok dizini degil: $ProjectRoot"
}

$originUrl = (& git remote get-url origin 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($originUrl)) {
    Fail "'origin' Git remote bulunamadi."
}

$branch = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
    Fail "Aktif Git branch belirlenemedi."
}

if (-not (Test-Path -LiteralPath $BackupRoot)) {
    Fail "Google Drive yedek kok yolu bulunamadi: $BackupRoot"
}

Write-Ok "Git, repository, origin, branch ve Drive yolu hazir."
Write-Host "Branch      : $branch"
Write-Host "Origin      : $originUrl"

# ------------------------------------------------------------
# 3) Secret kontrolu
# ------------------------------------------------------------
Assert-NoSensitiveGitFiles

# ------------------------------------------------------------
# 4) Git add + commit
# ------------------------------------------------------------
Write-Step "Degisiklikler Git staging alanina aliniyor"

& git add -A
if ($LASTEXITCODE -ne 0) {
    Fail "git add -A basarisiz oldu."
}

& git diff --cached --quiet
$hasStagedChanges = ($LASTEXITCODE -ne 0)

if ($hasStagedChanges) {
    $timestampForCommit = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
        $CommitMessage = "backup: $timestampForCommit"
    }

    Write-Step "Commit olusturuluyor"
    Write-Host "Commit mesaji: $CommitMessage"

    & git commit -m $CommitMessage
    if ($LASTEXITCODE -ne 0) {
        Fail "git commit basarisiz oldu. Google Drive yedegi olusturulmadi."
    }

    Write-Ok "Commit olusturuldu."
}
else {
    Write-Ok "Commit edilecek yeni degisiklik yok."
}

# ------------------------------------------------------------
# 5) GitHub push
# ------------------------------------------------------------
Write-Step "GitHub push yapiliyor"

& git push origin $branch
if ($LASTEXITCODE -ne 0) {
    Fail "GitHub push basarisiz oldu. Google Drive yedegi olusturulmadi."
}

Write-Ok "GitHub push basarili."

# ------------------------------------------------------------
# 6) Drive proje klasoru
# ------------------------------------------------------------
$ProjectBackupFolder = Join-Path $BackupRoot $ProjectName

if (-not (Test-Path -LiteralPath $ProjectBackupFolder)) {
    Write-Step "Ilk yedek icin proje klasoru olusturuluyor"
    New-Item -ItemType Directory -Path $ProjectBackupFolder -Force | Out-Null
    Write-Ok "Olusturuldu: $ProjectBackupFolder"
}

# ------------------------------------------------------------
# 7) Tarih + saat zorunlu ZIP
# ------------------------------------------------------------
$backupTimestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupFileName = "${ProjectName}_${backupTimestamp}.zip"
$backupPath = Join-Path $ProjectBackupFolder $backupFileName

Write-Step "Google Drive TAM proje ZIP yedegi olusturuluyor"
Write-Host "Hedef: $backupPath"


try {
    $zipStats = Create-FullZip -SourceRoot $ProjectRoot -DestinationZip $backupPath
}
catch {
    if (Test-Path -LiteralPath $backupPath) {
        Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
    }
    Fail "ZIP yedegi olusturulamadi: $($_.Exception.Message)"
}

if (-not (Test-Path -LiteralPath $backupPath)) {
    Fail "ZIP olusturma tamamlandi gorundu ancak dosya bulunamadi."
}

$backupItem = Get-Item -LiteralPath $backupPath
if ($backupItem.Length -le 0) {
    Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
    Fail "Olusturulan ZIP bos."
}

Write-Ok "Google Drive yedegi tamamlandi."
Write-Host "Dosya sayisi : $($zipStats.Files)"
Write-Host "Klasor sayisi: $($zipStats.Directories)"
Write-Host ("ZIP boyutu   : {0:N2} MB" -f ($backupItem.Length / 1MB))

$warningThresholdBytes = 10GB
if ($backupItem.Length -gt $warningThresholdBytes) {
    Write-Warn ("Yedek dosyasi 10 GB'i asti ({0:N2} GB). Yedek silinmedi veya durdurulmadi; sadece bilgi amacli uyari verildi." -f ($backupItem.Length / 1GB))
}

# ------------------------------------------------------------
# 8) Eski yedekleri temizle
# ------------------------------------------------------------
if ($KeepBackups -gt 0) {
    Write-Step "Yedek saklama politikasi uygulanıyor"

    $escapedProjectName = [regex]::Escape($ProjectName)
    $backupRegex = "^${escapedProjectName}_\d{4}-\d{2}-\d{2}_\d{6}\.zip$"

    $backups = Get-ChildItem -LiteralPath $ProjectBackupFolder -File |
        Where-Object { $_.Name -match $backupRegex } |
        Sort-Object LastWriteTime -Descending

    if ($backups.Count -gt $KeepBackups) {
        $toDelete = $backups | Select-Object -Skip $KeepBackups

        foreach ($oldBackup in $toDelete) {
            Remove-Item -LiteralPath $oldBackup.FullName -Force
            Write-Host "Eski yedek silindi: $($oldBackup.Name)"
        }
    }

    Write-Ok "Son $KeepBackups tarihli yedek korunuyor."
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "  ISLEM BASARILI" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "GitHub : origin/$branch"
Write-Host "Yedek  : $backupPath"
Write-Host ""
