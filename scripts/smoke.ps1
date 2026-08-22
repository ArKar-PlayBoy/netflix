# Vionix smoke test (curl + file-based JSON bodies — PS5.1-safe)
# Run while dev server is up:  .\scripts\smoke.ps1
$ErrorActionPreference = "Continue"
$BASE = "http://localhost:3000"
$hJson = "Content-Type: application/json"
$jarA = Join-Path $env:TEMP "vionix-admin.jar"
$jarU = Join-Path $env:TEMP "vionix-user.jar"
Remove-Item $jarA, $jarU -ErrorAction SilentlyContinue
$results = @()

function JsonFile($obj) {
  $p = Join-Path $env:TEMP ("vj-" + [guid]::NewGuid().ToString("N") + ".json")
  [System.IO.File]::WriteAllText($p, ($obj | ConvertTo-Json -Compress))
  return $p
}

function Req([string]$method, [string]$url, [string]$bodyFile, [string]$jarIn, [string]$jarOut) {
  $ca = @("-sS", "-o", "NUL", "-w", "%{http_code}", "--max-time", "40", "-X", $method)
  if ($jarIn -and (Test-Path $jarIn)) { $ca += @("-b", $jarIn) }
  if ($jarOut) { $ca += @("-c", $jarOut) }
  if ($bodyFile) { $ca += @("-H", $hJson, "--data-binary", ("@" + $bodyFile)) }
  $code = & curl.exe @ca $url
  return [int]$code
}

function ReqBody([string]$method, [string]$url, [string]$bodyFile, [string]$jarIn, [string]$outFile) {
  $ca = @("-sS", "-o", $outFile, "-w", "%{http_code}", "--max-time", "40", "-X", $method)
  if ($jarIn -and (Test-Path $jarIn)) { $ca += @("-b", $jarIn) }
  if ($bodyFile) { $ca += @("-H", $hJson, "--data-binary", ("@" + $bodyFile)) }
  $code = & curl.exe @ca $url
  return [int]$code
}

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
  $code = Req "POST" "$BASE/api/admin/login" (JsonFile @{ password = "adminarkar123" }) "" $jarA
  if ($code -ne 200) { throw "HTTP $code" }
}
Check "admin stats" {
  $code = Req "GET" "$BASE/api/admin/stats" $null $jarA ""
  if ($code -ne 200) { throw "HTTP $code" }
}
Check "admin disk (R2 list)" {
  $code = Req "GET" "$BASE/api/admin/disk" $null $jarA ""
  if ($code -ne 200) { throw "HTTP $code" }
}
Check "user register" {
  $script:smokeEmail = "smoke$(Get-Random -Max 99999)@test.com"
  $code = Req "POST" "$BASE/api/auth/register" (JsonFile @{ email = $smokeEmail; password = "smokepass1"; name = "Smoke" }) "" $jarU
  if ($code -ne 200 -and $code -ne 409) { throw "HTTP $code" }
}
Check "user login" {
  $code = Req "POST" "$BASE/api/auth/login" (JsonFile @{ email = $smokeEmail; password = "smokepass1" }) "" $jarU
  if ($code -ne 200) { throw "HTTP $code" }
}
Check "me returns SafeUser" {
  $out = Join-Path $env:TEMP "vionix-me.json"
  $code = ReqBody "GET" "$BASE/api/auth/me" $null $jarU $out
  if ($code -ne 200) { throw "HTTP $code" }
  if ((Get-Content $out -Raw) -match "password_hash|google_id|email_hash") { throw "PII LEAK" }
}
Check "anon stream-token blocked" {
  $code = Req "GET" "$BASE/api/stream-token" $null "" ""
  if ($code -ne 401) { throw "HTTP $code" }
}
Check "authed stream-token" {
  $code = Req "GET" "$BASE/api/stream-token" $null $jarU ""
  if ($code -ne 200) { throw "HTTP $code" }
}
Check "watchlist toggle x2" {
  $code = Req "POST" "$BASE/api/watchlist" (JsonFile @{ movieId = 27205 }) $jarU ""
  if ($code -ne 200) { throw "HTTP $code" }
  $code = Req "POST" "$BASE/api/watchlist" (JsonFile @{ movieId = 27205 }) $jarU ""
  if ($code -ne 200) { throw "HTTP $code" }
}
Check "progress save" {
  $code = Req "POST" "$BASE/api/progress" (JsonFile @{ movieId = 27205; position = 60; duration = 100 }) $jarU ""
  if ($code -ne 200) { throw "HTTP $code" }
}
Check "multipart create+abort" {
  $create = JsonFile @{ action = "create"; fileName = "smoke-test.mp4"; contentType = "video/mp4" }
  $out = Join-Path $env:TEMP "vionix-mp.json"
  $code = ReqBody "POST" "$BASE/api/admin/upload" $create $jarA $out
  if ($code -ne 200) { throw "create HTTP $code" }
  $d = (Get-Content $out -Raw | ConvertFrom-Json).data
  $code = Req "POST" "$BASE/api/admin/upload" (JsonFile @{ action = "abort"; key = $d.key; uploadId = $d.uploadId }) $jarA ""
  if ($code -ne 200) { throw "abort HTTP $code" }
}
Check "subtitle key gen" {
  $code = Req "POST" "$BASE/api/admin/subtitle" (JsonFile @{ action = "key"; fileName = "t.srt" }) $jarA ""
  if ($code -ne 200) { throw "HTTP $code" }
}

$results | Format-Table -AutoSize
$fail = ($results | Where-Object { $_.Result -like "FAIL*" }).Count
if ($fail -eq 0) { Write-Host "ALL PASS ($($results.Count) checks)" -ForegroundColor Green }
else { Write-Host "$fail FAILED" -ForegroundColor Red }
