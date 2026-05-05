param(
  [string]$InputPath = "C:\Users\thanu\OneDrive\Desktop\Users.xlsx",
  [string]$OutputPath = "d:\Programming\FSD CIA\data\allowedUsers.json"
)

if (!(Test-Path -LiteralPath $InputPath)) {
  throw "Input file not found: $InputPath"
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open($InputPath)
$sheet = $workbook.Worksheets.Item(1)
$used = $sheet.UsedRange
$rowCount = $used.Rows.Count

$records = @()
for ($row = 2; $row -le $rowCount; $row++) {
  $usn = [string]$used.Item($row, 1).Text
  $password = [string]$used.Item($row, 2).Text

  if ($usn -and $password) {
    $records += [pscustomobject]@{
      usn = $usn.Trim().ToUpper()
      password = $password.Trim()
    }
  }
}

$workbook.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($used) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($sheet) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null

$records = $records | Sort-Object usn -Unique
$records | ConvertTo-Json -Depth 3 | Set-Content -Path $OutputPath

Write-Output "Imported $($records.Count) users to $OutputPath"
