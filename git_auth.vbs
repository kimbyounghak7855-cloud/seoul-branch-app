Dim WShell, fso
Set fso = CreateObject("Scripting.FileSystemObject")
Set WShell = CreateObject("WScript.Shell")

' 스크립트 자신의 위치를 기준으로 현재 디렉토리 설정 (Korean 경로 인코딩 문제 회피)
WShell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)

' git ls-remote 실행
WShell.Run "powershell -NoExit -Command ""Write-Host '현재 위치:' (Get-Location); Write-Host ''; Write-Host '--- git ls-remote origin 실행 중 ---'; git ls-remote origin; Write-Host '--- 완료 ---'""", 1, False
