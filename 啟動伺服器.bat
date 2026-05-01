@echo off
title HealScape Pro - Server Launcher
color 0b

echo =======================================================
echo.
echo    HealScape Pro 系統自動啟動器
echo    -----------------------------------
echo    1. 啟動 Node.js 後端伺服器 (Port 3000)
echo    2. 啟動 ngrok 網路隧道
echo.
echo =======================================================
echo.

:: 啟動後端
echo [步驟 1/2] 正在新的視窗啟動後端伺服器...
start "HealScape Backend" cmd /k "cd server && npm run dev"

:: 延遲一下確保伺服器先跑起來
timeout /t 3 /nobreak > nul

:: 啟動 ngrok
echo [步驟 2/2] 正在新的視窗啟動 ngrok 隧道...
start "ngrok Tunnel" cmd /k "ngrok http 3000"

echo.
echo -------------------------------------------------------
echo.
echo    啟動指令已成功送出！
echo.
echo    請在彈出的 [ngrok] 視窗中複製 Forwarding 網址 (https://...)
echo    並更新至前端 api.js 中的 API_BASE (如果需要遠端存取)。
echo.
echo    按任意鍵關閉此引導視窗...
pause > nul
