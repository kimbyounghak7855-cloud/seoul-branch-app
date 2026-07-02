Dim WShell, fso
Set fso = CreateObject("Scripting.FileSystemObject")
Set WShell = CreateObject("WScript.Shell")
WShell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)

' Use %APPDATA% to avoid Korean character encoding issues in hardcoded paths
Dim pythonExe
pythonExe = WShell.ExpandEnvironmentStrings("%APPDATA%") & "\uv\python\cpython-3.14-windows-x86_64-none\python.exe"

If fso.FileExists(pythonExe) Then
    WShell.Run "cmd /k """ & pythonExe & """ -m http.server 5500", 1, False
Else
    ' Fallback: try uv run (uv manages its own Python)
    WShell.Run "cmd /k uv run python -m http.server 5500", 1, False
End If
