@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ========================================
echo  서울지점 영업지도 - 로컬 서버 시작
echo  http://127.0.0.1:5500 으로 접속하세요
echo ========================================
echo.
where npx >nul 2>&1
if %errorlevel%==0 (
    echo [Node.js] npx serve 로 서버를 시작합니다...
    npx --yes serve -l 5500 --no-clipboard
) else (
    where python >nul 2>&1
    if %errorlevel%==0 (
        echo [Python] http.server 로 서버를 시작합니다...
        python -m http.server 5500
    ) else (
        echo [오류] Node.js 또는 Python 이 필요합니다.
        echo Node.js 다운로드: https://nodejs.org
        pause
    )
)
