param(
  [string]$TaskName = "CodexMySQLAutoStart"
)

try {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
  Write-Output "Task removed: $TaskName"
} catch {
  Write-Output "Task not found or cannot be removed: $TaskName"
  exit 1
}
