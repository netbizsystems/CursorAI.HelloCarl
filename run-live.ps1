Set-Location "C:\Users\dande\source\repos\CursorAI.HelloDave"
Get-Process node, azurite -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
npm run dev:all
