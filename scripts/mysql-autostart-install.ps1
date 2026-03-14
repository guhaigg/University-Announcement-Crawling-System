param(
  [ValidateSet("Logon", "Startup")]
  [string]$Mode = "Logon",
  [string]$TaskName = "CodexMySQLAutoStart",
  [string]$StartScript = "D:/codex/scripts/mysql-start.ps1",
  [switch]$RunNow
)

if (-not (Test-Path $StartScript)) {
  Write-Error "start script not found: $StartScript"
  exit 1
}

$powerShellExe = Join-Path $env:SystemRoot "System32/WindowsPowerShell/v1.0/powershell.exe"
$actionArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$StartScript`""

function Install-WithScheduledTaskApi {
  $action = New-ScheduledTaskAction -Execute $powerShellExe -Argument $actionArgs
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  if ($Mode -eq "Startup") {
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  } else {
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
  }
  $task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Auto start MySQL for Codex project"
  Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force -ErrorAction Stop | Out-Null
}

function Install-WithSchtasks {
  $runLevel = if ($Mode -eq "Startup") { "HIGHEST" } else { "LIMITED" }
  $scheduleType = if ($Mode -eq "Startup") { "ONSTART" } else { "ONLOGON" }
  $taskRun = "$powerShellExe $actionArgs"
  $args = @("/Create", "/TN", $TaskName, "/SC", $scheduleType, "/TR", $taskRun, "/RL", $runLevel, "/F")
  if ($Mode -eq "Startup") {
    $args += @("/RU", "SYSTEM")
  }
  & schtasks.exe @args | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "schtasks exited with code $LASTEXITCODE"
  }
}

try {
  Install-WithScheduledTaskApi
  if ($RunNow.IsPresent) {
    Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  }
  Write-Output "Task installed: $TaskName (mode=$Mode, installer=ScheduledTaskApi)"
} catch {
  try {
    Install-WithSchtasks
    if ($RunNow.IsPresent) {
      Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    }
    Write-Output "Task installed: $TaskName (mode=$Mode, installer=schtasks)"
  } catch {
    Write-Error $_.Exception.Message
    if ($Mode -eq "Startup") {
      Write-Output "Tip: Startup mode usually needs an elevated PowerShell (Run as Administrator)."
    } else {
      Write-Output "Tip: If current account cannot create scheduled tasks, run PowerShell as Administrator and retry."
    }
    exit 1
  }
}
