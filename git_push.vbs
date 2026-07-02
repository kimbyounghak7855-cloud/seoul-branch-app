Dim WShell, fso
Set fso = CreateObject("Scripting.FileSystemObject")
Set WShell = CreateObject("WScript.Shell")

' 스크립트 위치 기준으로 현재 디렉토리 설정 (Korean 경로 인코딩 문제 회피)
WShell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)

' index.lock 파일 삭제 (이전 git 프로세스가 남긴 잠금 파일)
Dim lockFile
lockFile = fso.GetParentFolderName(WScript.ScriptFullName) & "\.git\index.lock"
If fso.FileExists(lockFile) Then
    fso.DeleteFile lockFile
End If

' git config, add, commit, push 실행
Dim cmd
cmd = "powershell -NoExit -Command """ & _
    "Write-Host '=== 현재 위치 ===' -ForegroundColor Cyan; " & _
    "Write-Host (Get-Location); " & _
    "Write-Host ''; " & _
    "Write-Host '=== git config 설정 ===' -ForegroundColor Cyan; " & _
    "git config --global user.email 'gom1443@gmail.com'; " & _
    "git config --global user.name '김병학'; " & _
    "Write-Host ''; " & _
    "Write-Host '=== git add . ===' -ForegroundColor Cyan; " & _
    "git add .; " & _
    "Write-Host ''; " & _
    "Write-Host '=== git commit ===' -ForegroundColor Cyan; " & _
    "git commit -m '초기 커밋: 서울지점 영업지도 PWA'; " & _
    "Write-Host ''; " & _
    "Write-Host '=== git push -u origin master ===' -ForegroundColor Cyan; " & _
    "git push -u origin master; " & _
    "Write-Host ''; " & _
    "Write-Host '=== 완료! ===' -ForegroundColor Green" & _
    """"

WShell.Run cmd, 1, False
