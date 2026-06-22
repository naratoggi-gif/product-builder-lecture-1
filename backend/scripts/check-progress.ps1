param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Email = "demo@goal-idle.local",
  [string]$Nickname = "demo-user",
  [string]$Password = "Demo1234!"
)

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Uri,
    $Body,
    [hashtable]$Headers
  )

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
  }

  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json)
}

Write-Host "[0] Login or signup"
$token = $null
try {
  $login = Invoke-Json -Method POST -Uri "$BaseUrl/auth/login" -Body @{ email = $Email; password = $Password } -Headers @{}
  $token = $login.accessToken
} catch {
  $signup = Invoke-Json -Method POST -Uri "$BaseUrl/auth/signup" -Body @{ email = $Email; nickname = $Nickname; password = $Password } -Headers @{}
  $token = $signup.accessToken
}

$headers = @{ Authorization = "Bearer $token" }

Write-Host "[1] Player profile"
Invoke-Json -Method GET -Uri "$BaseUrl/player/me" -Headers $headers | ConvertTo-Json -Depth 7

Write-Host "[2] Vision goals"
Invoke-Json -Method GET -Uri "$BaseUrl/goals/vision" -Headers $headers | ConvertTo-Json -Depth 7

Write-Host "[3] Weekly missions"
$weekly = Invoke-Json -Method GET -Uri "$BaseUrl/goals/weekly" -Headers $headers
$weekly | ConvertTo-Json -Depth 7

if (($weekly | Measure-Object).Count -eq 0) {
  Write-Host "[3-1] Create sample vision + weekly + micro"
  $vision = Invoke-Json -Method POST -Uri "$BaseUrl/goals/vision" -Body @{ title = "30일 루틴 만들기"; description = "하루 1개 즉시 행동"; targetDate = (Get-Date).AddDays(30).ToString('yyyy-MM-dd') } -Headers $headers
  $generated = Invoke-Json -Method POST -Uri "$BaseUrl/goals/vision/$($vision.id)/weekly-plan" -Body @{ weeks = 1; targetCount = 4 } -Headers $headers
  $weeklyId = $generated[0].id
  Invoke-Json -Method POST -Uri "$BaseUrl/goals/weekly/$weeklyId/micro-generate" -Body @{ count = 3 } -Headers $headers | Out-Null
}

Write-Host "[4] Next micro action"
$next = Invoke-Json -Method GET -Uri "$BaseUrl/actions/next-micro" -Headers $headers
$next | ConvertTo-Json -Depth 7

Write-Host "[5] Complete micro action"
Invoke-Json -Method POST -Uri "$BaseUrl/actions/micro/$($next.id)/complete" -Headers $headers | ConvertTo-Json -Depth 7

Write-Host "[6] Consistency state"
Invoke-Json -Method GET -Uri "$BaseUrl/consistency/me" -Headers $headers | ConvertTo-Json -Depth 7

Write-Host "[7] Prediction score"
$body = @{ durationMin = 30; difficulty = 3; historicalSuccessRate = 0.5; timeslotSuccessRate = 0.6; fatigueLevel = 2 }
Invoke-Json -Method POST -Uri "$BaseUrl/prediction/score" -Body $body -Headers $headers | ConvertTo-Json -Depth 7

Write-Host "[8] Idle claim"
Invoke-Json -Method POST -Uri "$BaseUrl/idle/claim" -Headers $headers | ConvertTo-Json -Depth 7

Write-Host "[9] Costume shop"
Invoke-Json -Method GET -Uri "$BaseUrl/shop/costumes" -Headers $headers | ConvertTo-Json -Depth 7
