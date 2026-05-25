; inject-ig NSIS Installer Script
; JRE 21 vem BUNDLED — nenhuma dependência externa necessária

; Configura firewall do Windows para permitir a porta do backend
!macro customInstallMode
  ; Permite porta 8080 no Windows Firewall silenciosamente
  ExecWait 'netsh advfirewall firewall add rule name="inject-ig Server" dir=in action=allow protocol=tcp localport=8080' $0
!macroend

!macro customInstall
  ; Cria atalho na área de trabalho
  CreateShortcut "$DESKTOP\inject-ig.lnk" "$INSTDIR\inject-ig.exe" "" "$INSTDIR\inject-ig.exe" 0
  
  ; Torna o JRE bundled executável (define permissão se necessário)
  ; O JRE está em $INSTDIR\resources\jre\bin\java.exe — pronto para uso sem instalar
!macroend

!macro customUnInstall
  ; Remove atalho da área de trabalho ao desinstalar
  Delete "$DESKTOP\inject-ig.lnk"
  ; Remove regra do firewall
  ExecWait 'netsh advfirewall firewall delete rule name="inject-ig Server"' $0
!macroend
