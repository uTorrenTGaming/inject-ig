; inject-ig NSIS Installer Script
; This runs before/after the main NSIS installer

; Check if Java is installed on Windows
!macro customInstall
  ; Check for Java 11+
  ReadRegStr $R0 HKLM "SOFTWARE\JavaSoft\JRE" "CurrentVersion"
  ${If} $R0 == ""
    ReadRegStr $R0 HKLM "SOFTWARE\JavaSoft\Java Runtime Environment" "CurrentVersion"
  ${EndIf}
  
  ${If} $R0 == ""
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "inject-ig requer Java 11 ou superior.$\n$\nDeseja abrir o site de download do Java agora?" \
      IDYES downloadJava IDNO skipJava
    downloadJava:
      ExecShell "open" "https://adoptium.net/temurin/releases/?version=21"
    skipJava:
  ${EndIf}
!macroend

; Configure Windows Firewall to allow the backend port
!macro customInstallMode
  ; Allow port 8080 through Windows Firewall silently
  ExecWait 'netsh advfirewall firewall add rule name="inject-ig Server" dir=in action=allow protocol=tcp localport=8080' $0
!macroend
