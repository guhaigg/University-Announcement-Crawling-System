param(
  [string]$MysqlExe = "C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe",
  [string]$MySqlHost = "127.0.0.1",
  [int]$Port = 3306,
  [string]$RootUser = "root",
  [string]$RootPassword = "",
  [string]$Database = "codex_yz",
  [string]$AppUser = "codex_app",
  [string]$AppPassword = "",
  [string]$SetRootPassword = ""
)

if (-not (Test-Path $MysqlExe)) {
  Write-Error "mysql client not found: $MysqlExe"
  exit 1
}

if ([string]::IsNullOrWhiteSpace($AppPassword)) {
  $chars = (48..57 + 65..90 + 97..122) | ForEach-Object { [char]$_ }
  $AppPassword = -join (1..24 | ForEach-Object { $chars | Get-Random })
}

$sqlLines = @()
if (-not [string]::IsNullOrWhiteSpace($SetRootPassword)) {
  $sqlLines += "ALTER USER '$RootUser'@'localhost' IDENTIFIED BY '$SetRootPassword';"
}
$sqlLines += "CREATE DATABASE IF NOT EXISTS $Database CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
$sqlLines += "CREATE USER IF NOT EXISTS '$AppUser'@'localhost' IDENTIFIED BY '$AppPassword';"
$sqlLines += "CREATE USER IF NOT EXISTS '$AppUser'@'127.0.0.1' IDENTIFIED BY '$AppPassword';"
$sqlLines += "GRANT ALL PRIVILEGES ON $Database.* TO '$AppUser'@'localhost';"
$sqlLines += "GRANT ALL PRIVILEGES ON $Database.* TO '$AppUser'@'127.0.0.1';"
$sqlLines += "FLUSH PRIVILEGES;"

$sqlFile = "D:/codex/data/mysql-bootstrap.sql"
$sqlLines -join "`n" | Set-Content -Path $sqlFile -Encoding ascii

$args = @("--host=$MySqlHost", "--port=$Port", "--user=$RootUser")
if (-not [string]::IsNullOrWhiteSpace($RootPassword)) {
  $args += "--password=$RootPassword"
}

Get-Content $sqlFile | & $MysqlExe @args
if ($LASTEXITCODE -ne 0) {
  Write-Error "bootstrap failed"
  exit 1
}

Write-Output "MYSQL_DATABASE=$Database"
Write-Output "MYSQL_USER=$AppUser"
Write-Output "MYSQL_PASSWORD=$AppPassword"
if (-not [string]::IsNullOrWhiteSpace($SetRootPassword)) {
  Write-Output "ROOT_PASSWORD=$SetRootPassword"
}
