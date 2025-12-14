param(
  [Parameter(Mandatory=$true)][string]$FilePath,
  [Parameter(Mandatory=$true)][string]$Token,
  [string]$BaseUrl = "http://localhost:4000",
  [string]$Title = "",
  [string]$Caption = "",
  [string]$Category = "",
  [string]$PostUlid = "",
  [string]$ThumbnailUrl = "",
  [string]$CategoryCode = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "File not found: $FilePath"
}

$uri = ($BaseUrl.TrimEnd('/') + "/api/influencers/me/ads/video")

$headers = @{
  Authorization = "Bearer $Token"
  accept        = "application/json"
}

$form = @{
  file = Get-Item -LiteralPath $FilePath
}
if ($Title) { $form.title = $Title }
if ($Caption) { $form.caption = $Caption }
if ($Category) { $form.category = $Category }
if ($PostUlid) { $form.postUlid = $PostUlid }
if ($ThumbnailUrl) { $form.thumbnailUrl = $ThumbnailUrl }
if ($CategoryCode) { $form.categoryCode = $CategoryCode }

# Invoke-WebRequest/Invoke-RestMethod builds multipart with boundary correctly.
try {
  $resp = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Form $form
  $resp | ConvertTo-Json -Depth 20
} catch {
  # Best-effort parse JSON error response
  $msg = $_.Exception.Message
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
    $msg = $_.ErrorDetails.Message
  }
  Write-Host "Request failed." -ForegroundColor Red
  Write-Host $msg
  exit 1
}
