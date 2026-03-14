param(
  [string]$PidFile = "D:/codex/data/mysql.pid"
)

if (Test-Path $PidFile) {
  $pidText = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  $pid = 0
  [void][int]::TryParse([string]$pidText, [ref]$pid)
  if ($pid -gt 0) {
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $pid -Force
      Remove-Item $PidFile -ErrorAction SilentlyContinue
      Write-Output "MySQL stopped. pid=$pid"
      exit 0
    }
  }
}

Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Output "MySQL stop command executed."
