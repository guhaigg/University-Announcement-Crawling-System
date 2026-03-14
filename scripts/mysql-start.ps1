param(
  [string]$ConfigFile = "D:/codex/data/mysql-my.ini",
  [string]$MysqlBin = "C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqld.exe",
  [string]$DataDir = "D:/codex/data/mysql-data",
  [string]$PidFile = "D:/codex/data/mysql.pid"
)

$listening = netstat -ano | Select-String ":3306\s+.*LISTENING"
if ($listening) {
  Write-Output "MySQL already listening on 3306."
  exit 0
}

if (-not (Test-Path $MysqlBin)) {
  Write-Error "mysqld not found: $MysqlBin"
  exit 1
}
if (-not (Test-Path $ConfigFile)) {
  @"
[mysqld]
basedir=C:/Program Files/MySQL/MySQL Server 8.4
datadir=$DataDir
port=3306
bind-address=127.0.0.1
mysqlx=0
character-set-server=utf8mb4
collation-server=utf8mb4_general_ci
max_connections=200
sql_mode=STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION

[client]
port=3306
default-character-set=utf8mb4
"@ | Set-Content -Path $ConfigFile -Encoding ascii
}

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
$hasData = (Get-ChildItem -Path $DataDir -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $hasData) {
  $baseDir = Split-Path (Split-Path $MysqlBin -Parent) -Parent
  & $MysqlBin "--initialize-insecure" "--basedir=$baseDir" "--datadir=$DataDir"
  if ($LASTEXITCODE -ne 0) {
    Write-Error "mysqld initialize failed with code $LASTEXITCODE"
    exit 1
  }
}

$proc = Start-Process -FilePath $MysqlBin -ArgumentList "--defaults-file=$ConfigFile","--console" -PassThru
Start-Sleep -Seconds 2
if ($proc.HasExited) {
  Write-Error "mysqld exited with code $($proc.ExitCode)"
  exit 1
}

Set-Content -Path $PidFile -Value $proc.Id -Encoding ascii
Write-Output "MySQL started. pid=$($proc.Id)"
