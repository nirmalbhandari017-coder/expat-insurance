@echo off
title Lead Tracker  (keep this window open)
cd /d "C:\Users\user\expat-insurance\lead-tracker"
echo ============================================================
echo   LEAD TRACKER is starting up...
echo.
echo   A browser tab will open automatically when it's ready.
echo   KEEP THIS WINDOW OPEN while you use the app.
echo   To stop: close this window, or press Ctrl+C.
echo ============================================================
echo.
rem Open the browser automatically once the server answers on port 3000.
start "" powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 90;$i++){try{$r=Invoke-WebRequest -UseBasicParsing http://localhost:3000/login -TimeoutSec 2; if($r.StatusCode -eq 200){Start-Process 'http://localhost:3000'; exit}}catch{}; Start-Sleep -Seconds 2}"
rem Start the dev server (this keeps running until you close the window).
call npm run dev
echo.
echo The server has stopped. You can close this window.
pause
