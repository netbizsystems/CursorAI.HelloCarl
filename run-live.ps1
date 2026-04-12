# HelloCarl — Vite 5180, API 3020. Do not use HelloDave's folder.
Set-Location "C:\Users\dande\source\repos\CursorAI.HelloCarl"

# Free only this app's ports (do not Stop-Process node globally — that kills HelloDave).
$ports = @(5180, 3020)
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Start-Sleep -Seconds 1
npm run dev:all
