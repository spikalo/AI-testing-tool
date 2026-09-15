# Zet ANG-paper.docx om naar PDF. LibreOffice staat niet op elke machine; Word wel,
# en Word kan dit via COM zonder dat er een venster opengaat.
# Aanroep vanuit de projectmap:  powershell -ExecutionPolicy Bypass -File paper/naar-pdf.ps1
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path .).Path
$docx = Join-Path $root 'ANG-paper.docx'
$pdf  = Join-Path $root 'ANG-paper.pdf'
if (-not (Test-Path $docx)) { throw "niet gevonden: $docx" }

$soffice = @(
  'C:\Program Files\LibreOffice\program\soffice.exe',
  'C:\Program Files (x86)\LibreOffice\program\soffice.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($soffice) {
  & $soffice --headless --convert-to pdf --outdir $root $docx | Out-Null
} else {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  try {
    $doc = $word.Documents.Open($docx, $false, $true)   # ReadOnly, zodat het bestand niet herschreven wordt
    $doc.ExportAsFixedFormat($pdf, 17)                  # 17 = wdExportFormatPDF
    $doc.Close(0)                                       # 0 = wdDoNotSaveChanges
  } finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
  }
}
$f = Get-Item $pdf
Write-Output ("pdf geschreven: {0} bytes, {1}" -f $f.Length, $f.LastWriteTime)
