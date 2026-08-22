# Vionix smoke test — run while dev server is up:  .\scripts\smoke.ps1
$ErrorActionPreference = "Continue"
$BASE = "http://localhost:3000"
$h = @{ "Content-Type" = "application/json" }
$results = @()

function Check($name, $scriptblock) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    & $scriptblock
    $script:results += [pscustomobject]@{ Test = $name; Result = "PASS"; Ms = $sw.ElapsedMilliseconds }
  } catch {
    $script:results += [pscustomobject]@{ Test = $name; Result = "FAIL: $($_.Exception.Message)"; Ms = $sw.ElapsedMilliseconds }
  }
}

Write-Host "`n=== Vionix smoke ===" -ForegroundColor Cyan

Check "admin login" {
  Invoke-WebRequest "$BASE/api/admin/login" -Method POST -Body '{"password":"adminarkar123"}' -Headers $h -UseBasicParsing -SessionVariable wa -TimeoutSec 30 | Out-Null
}
Check "admin stats" {
  $r = Invoke-WebRequest "$BASE/api/admin/stats" -WebSession $wa -UseBasicParsing -TimeoutSec 20
  if (-not $r.Content.Contains('"success":true')) { throw "bad body" }
}
Check "admin disk (R2 list)" {
  $r = Invoke-WebRequest "$BASE/api/admin/disk" -WebSession $wa -UseBasicParsing -TimeoutSec 30
  if (-not $r.Content.Contains('storage')) { throw "bad body" }
}
Check "user register+login" {
  $email = "smoke$(Get-Random -Max 99999)@test.com"
  Invoke-WebRequest "$BASE/api/auth/register" -Method POST -Body ('{"email":"' + $email + '","password":"smokepass1","name":"Smoke"}') -Headers $h -UseBasicParsing -TimeoutSec 30 | Out-Null
  Invoke-WebRequest "$BASE/api/auth/login" -Method POST -Body ('{"email":"' + $email + '","password":"smokepass1"}') -Headers $h -UseBasicParsing -SessionVariable wu -TimeoutSec 30 | Out-Null
}
Check "me returns SafeUser" {
  $r = Invoke-WebRequest "$BASE/api/auth/me" -WebSession $wu -UseBasicParsing -TimeoutSec 20
  if ($r.Content -match "password_hash|google_id|email_hash") { throw "PII LEAK" }
}
Check "anon stream-token blocked" {
  try { Invoke-WebRequest "$BASE/api/stream-token" -UseBasicParsing -TimeoutSec 20 | Out-Null; throw "should 401" } catch { $c = $_.Exception.Response.StatusCode.value__; if ($c -ne 401) { throw "got $c" } }
}
Check "authed stream-token" {
  $r = Invoke-WebRequest "$BASE/api/stream-token" -WebSession $wu -UseBasicParsing -TimeoutSec 20
  if (-not $r.Content.Contains("token")) { throw "no token" }
}
Check "watchlist toggle" {
  Invoke-WebRequest "$BASE/api/watchlist" -Method POST -Body '{"movieId":27205}' -Headers $h -WebSession $wu -UseBasicParsing -TimeoutSec 20 | Out-Null
  Invoke-WebRequest "$BASE/api/watchlist" -Method POST -Body '{"movieId":27205}' -Headers $h -WebSession $wu -UseBasicParsing -TimeoutSec 20 | Out-Null
}
Check "progress save" {
  Invoke-WebRequest "$BASE/api/progress" -Method POST -Body '{"movieId":27205,"position":60,"duration":100}' -Headers $h -WebSession $wu -UseBasicParsing -TimeoutSec 20 | Out-Null
}
Check "multipart create+abort" {
  $c = Invoke-WebRequest "$BASE/api/admin/upload" -Method POST -Body '{"action":"create","fileName":"smoke-test.mp4","contentType":"video/mp4"}' -Headers $h -WebSession $wa -UseBasicParsing -TimeoutSec 40
  $d = ($c.Content | ConvertFrom-Json).data
  Invoke-WebRequest "$BASE/api/admin/upload" -Method POST -Body ('{"action":"abort","key":"' + $d.key + '","uploadId":"' + $d.uploadId + '"}') -Headers $h -WebSession $wa -UseBasicParsing -TimeoutSec 30 | Out-Null
}
Check "subtitle key gen" {
  $r = Invoke-WebRequest "$BASE/api/admin/subtitle" -Method POST -Body '{"action":"key","fileName":"t.srt"}' -Headers $h -WebSession $wa -UseBasicParsing -TimeoutSec 20
  if (-not $r.Content.Contains("subs/")) { throw "bad key" }
}

$results | Format-Table -AutoSize
$fail = ($results | Where-Object { $_.Result -like "FAIL*" }).Count
if ($fail -eq 0) { Write-Host "ALL PASS ($($results.Count) checks)" -ForegroundColor Green }
else { Write-Host "$fail FAILED" -ForegroundColor Red }
