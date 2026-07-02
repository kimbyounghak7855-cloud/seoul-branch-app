Dim WShell
Set WShell = CreateObject("WScript.Shell")
WShell.Run "cmd /k wmic process where ""name='python.exe'"" get ExecutablePath", 1, False
