param(
  [string]$TaskName = "CodexMySQLAutoStart"
)

try {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  $info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop
  [pscustomobject]@{
    TaskName      = $task.TaskName
    State         = [string]$task.State
    LastRunTime   = $info.LastRunTime
    LastTaskResult= $info.LastTaskResult
    NextRunTime   = $info.NextRunTime
    Author        = $task.Principal.UserId
  } | Format-List
} catch {
  Write-Output "Task not found: $TaskName"
  exit 1
}
