# AquaSense AI — end-to-end smoke test (API level)
# Verifies every endpoint the UI calls, in demo-flow order.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\smoke_test.ps1
# Against production instead of localhost:
#   $env:AQUASENSE_BASE = "https://aquasense-2-0.vercel.app/api/v1"; .\scripts\smoke_test.ps1
$ErrorActionPreference = "Continue"
$B = if ($env:AQUASENSE_BASE) { $env:AQUASENSE_BASE } else { "http://127.0.0.1:8000/api/v1" }
"Target: $B"
$script:results = @()

function Hit($name, $method, $url, $body = $null) {
  try {
    if ($method -eq "POST") {
      $r = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json" -TimeoutSec 90
    } else {
      $r = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 90
    }
    $script:results += [pscustomobject]@{ Check = $name; OK = "PASS" }
    return $r
  } catch {
    $script:results += [pscustomobject]@{ Check = $name; OK = "FAIL: $($_.Exception.Message)" }
    return $null
  }
}

# 1. health
Hit "health" GET "$B/health" | Out-Null

# 2. load demo farm (full analysis pipeline; endpoint takes no body)
Hit "POST demo farm (full pipeline)" POST "$B/farms/demo" "null" | Out-Null

# 3. dashboard
$d = Hit "GET dashboard" GET "$B/dashboard/1"
if ($d) {
  $s = $d.data.water_analytics.summary
  "  baseline=$([math]::Round($s.baseline_total_l)) L  ai=$([math]::Round($s.ai_total_l)) L  saved=$([math]::Round($s.saved_l)) L  rainwater=$([math]::Round($s.rainwater_conserved_l)) L  reduction=$($s.saved_pct)%"
}

# 4. recommendation
$r = Hit "GET recommendation" GET "$B/recommendation/1"
if ($r) { "  status=$($r.data.status_label)  qty=$([math]::Round($r.data.quantity_l)) L  time=$($r.data.recommended_time)  confidence=$($r.data.confidence)" }

# 5. predict (ML)
$p = Hit "POST predict (ML)" POST "$B/predict/1" "{}"
if ($p) { "  model=$($p.data.model_name)  basis=$($p.data.metrics.data_basis)  mae=$($p.data.metrics.mae_pct_points)" }

# 6. other UI pages
Hit "GET weather"           GET "$B/weather/1"              | Out-Null
Hit "GET history"           GET "$B/history/1?mode=daily&days=30" | Out-Null
Hit "GET water-analytics"   GET "$B/water-analytics/1?mode=daily&days=30" | Out-Null
Hit "GET achievements"      GET "$B/achievements/1"         | Out-Null
Hit "GET nutrients"         GET "$B/nutrients/1"            | Out-Null
Hit "GET sensors readings"  GET "$B/sensors/readings/1?days=7" | Out-Null
Hit "GET crops"             GET "$B/crops"                  | Out-Null
Hit "GET aquastat"          GET "$B/reference/aquastat"     | Out-Null
Hit "GET nass benchmark"    GET "$B/reference/nass?crop=wheat" | Out-Null
Hit "GET soils"             GET "$B/soils"                  | Out-Null
Hit "GET irrigation-methods" GET "$B/irrigation-methods"    | Out-Null
Hit "GET data-status"       GET "$B/data-status"            | Out-Null
Hit "GET organizations"     GET "$B/organizations"          | Out-Null
Hit "GET location search"   GET "$B/location/search?q=Mysuru" | Out-Null
Hit "GET impact"            GET "$B/impact"                 | Out-Null
Hit "POST water-calculator" POST "$B/water-calculator" '{"baseline_per_ha_l":5000000,"ai_per_ha_l":2700000,"area_ha":2.5}' | Out-Null
Hit "GET history event write" POST "$B/history/1/events" '{"farm_id":1,"quantity_l":100000,"method":"drip","recommendation_followed":true}' | Out-Null

""
$script:results | Format-Table -AutoSize
$failed = @($script:results | Where-Object { $_.OK -ne "PASS" })
"TOTAL: $($script:results.Count)  PASS: $($script:results.Count - $failed.Count)  FAIL: $($failed.Count)"
if ($failed.Count -gt 0) { exit 1 }
