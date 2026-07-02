@echo off
chcp 65001 > nul
echo ========================================
echo  서울지점 영업지도 - 로컬 개발 서버 시작
echo ========================================
echo.
echo VS Code와 Live Server 플러그인이 필요합니다.
echo.
echo [1단계] VS Code로 이 폴더를 엽니다...
start code .
echo.
echo [2단계] VS Code 하단 상태바의 "Go Live" 버튼을 클릭하세요.
echo         브라우저에서 http://127.0.0.1:5500 으로 열립니다.
echo.
echo [주의] 지도가 표시되지 않으면:
echo   console.ncloud.com 로그인
echo   ^> Maps ^> Application 수정
echo   ^> Web 서비스 URL에 http://127.0.0.1:5500 추가
echo.
pause
