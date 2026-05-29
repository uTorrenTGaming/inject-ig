import sys
import socket
import urllib.request
import urllib.error
import urllib.parse
import ssl
import json
import subprocess
import time
import os

def check_ping(target):
    print(f"[*] Iniciando teste de latência (Ping) para {target}...")
    try:
        host = urllib.parse.urlparse(target).netloc if "://" in target else target
        host = host.split(':')[0]
        
        # Cross platform ping
        param = '-n' if sys.platform.lower()=='win32' else '-c'
        command = ['ping', param, '4', host]
        
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10)
        print(result.stdout)
        if result.returncode == 0:
            print("[+] Ping concluído com sucesso. Host está ONLINE.")
        else:
            print("[-] Ping falhou. Host pode estar OFFLINE ou bloqueando ICMP.")
    except Exception as e:
        print(f"[!] Erro ao executar ping: {e}")

def check_ports(target):
    print(f"[*] Escaneando portas principais no alvo {target}...")
    host = urllib.parse.urlparse(target).netloc if "://" in target else target
    host = host.split(':')[0]
    
    ports = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 5432, 8080, 8443]
    open_ports = []
    
    for port in ports:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((host, port))
        if result == 0:
            print(f"[+] Porta {port} está ABERTA")
            open_ports.append(port)
        sock.close()
        
    if not open_ports:
        print("[-] Nenhuma porta principal foi encontrada aberta.")
    else:
        print(f"\n[+] Total de portas abertas encontradas: {len(open_ports)}")

def check_headers(target):
    url = target if target.startswith('http') else 'http://' + target
    print(f"[*] Coletando cabeçalhos HTTP de {url}...")
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) InjectIG'})
        with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
            headers = response.info()
            for key, value in headers.items():
                print(f"{key}: {value}")
            
            # Security analysis
            print("\n--- Análise de Segurança de Cabeçalhos ---")
            sec_headers = ['Strict-Transport-Security', 'Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options']
            for sh in sec_headers:
                if sh in headers:
                    print(f"[OK] {sh} está presente.")
                else:
                    print(f"[WARN] {sh} está AUSENTE.")
                    
    except urllib.error.URLError as e:
        print(f"[-] Falha na requisição: {e}")
    except Exception as e:
        print(f"[!] Erro: {e}")

def whois_lookup(target):
    print(f"[*] Executando Whois Lookup para {target}...")
    host = urllib.parse.urlparse(target).netloc if "://" in target else target
    host = host.split(':')[0]
    
    try:
        # Tenta usar o comando local whois
        result = subprocess.run(['whois', host], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
        if result.stdout:
            lines = result.stdout.split('\n')
            for line in lines[:20]: # Mostra apenas as primeiras linhas para não poluir
                if line.strip() and not line.startswith('%'):
                    print(line)
            print("\n[+] (Saída truncada... Whois concluído)")
        else:
            print("[-] Comando Whois não retornou dados ou não está instalado no sistema.")
    except Exception as e:
        print(f"[!] Erro ao executar whois local: {e}")

def execute_real_exploit(tool_id, target):
    url = target if target.startswith('http') else 'http://' + target
    print(f"[*] Preparando vetor de injeção real: {tool_id}")
    print(f"[*] Alvo: {url}")
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        if 'sqli' in tool_id.lower():
            payload = "'"
            target_url = f"{url}?id={urllib.parse.quote(payload)}" if "?" not in url else f"{url}&test={urllib.parse.quote(payload)}"
            print(f"\n[>] ENVIANDO PAYLOAD SQLi: {payload}")
            print(f"[>] GET {target_url}")
            
            req = urllib.request.Request(target_url, headers={'User-Agent': 'InjectIG/2.0 (Security Scanner)'})
            start_time = time.time()
            try:
                response = urllib.request.urlopen(req, context=ctx, timeout=10)
                html = response.read().decode('utf-8', errors='ignore')
            except urllib.error.HTTPError as e:
                html = e.read().decode('utf-8', errors='ignore')
                print(f"[!] Servidor retornou código de erro: {e.code}")
            
            elapsed = time.time() - start_time
            print(f"[<] Resposta recebida em {elapsed:.2f}s (Tamanho: {len(html)} bytes)")
            
            sql_errors = ["syntax error", "mysql_fetch", "ORA-", "PostgreSQL query failed", "SQL syntax", "unclosed quotation mark"]
            found_error = False
            for err in sql_errors:
                if err.lower() in html.lower():
                    print(f"\n[CRÍTICO] Assinatura de erro SQL encontrada na resposta: '{err}'")
                    print(f"[LOG RAW] Trecho suspeito: ...{html[max(0, html.lower().find(err.lower())-20) : html.lower().find(err.lower())+40]}...")
                    found_error = True
                    break
                    
            if not found_error:
                print("\n[-] Nenhuma assinatura de erro SQL detectada. O alvo parece tratar a entrada corretamente (ou mascara os erros).")

        elif 'xss' in tool_id.lower():
            payload = "<script>alert('inject-ig-test')</script>"
            target_url = f"{url}?q={urllib.parse.quote(payload)}" if "?" not in url else f"{url}&search={urllib.parse.quote(payload)}"
            print(f"\n[>] ENVIANDO PAYLOAD XSS: {payload}")
            print(f"[>] GET {target_url}")
            
            req = urllib.request.Request(target_url, headers={'User-Agent': 'InjectIG/2.0'})
            try:
                response = urllib.request.urlopen(req, context=ctx, timeout=10)
                html = response.read().decode('utf-8', errors='ignore')
            except urllib.error.HTTPError as e:
                html = e.read().decode('utf-8', errors='ignore')
            
            print(f"[<] Resposta recebida (Tamanho: {len(html)} bytes)")
            
            if payload in html:
                print(f"\n[CRÍTICO] Payload XSS refletido integralmente no HTML sem sanitização!")
                idx = html.find(payload)
                print(f"[LOG RAW] Reflexão no DOM: ...{html[max(0, idx-15) : idx+len(payload)+15]}...")
            else:
                print("\n[-] Payload não refletido. O alvo parece sanitizar as entradas ou possui WAF/Filtro ativo.")
                
        else:
            # Varredura genérica agressiva
            print("\n[>] ENVIANDO REQUISIÇÃO DE ANÁLISE PROFUNDA")
            req = urllib.request.Request(url, headers={'User-Agent': 'InjectIG/2.0', 'X-Forwarded-For': '127.0.0.1'})
            try:
                response = urllib.request.urlopen(req, context=ctx, timeout=10)
                html = response.read().decode('utf-8', errors='ignore')
                headers = response.info()
            except urllib.error.HTTPError as e:
                html = e.read().decode('utf-8', errors='ignore')
                headers = e.headers
            
            print(f"[<] Headers recebidos do alvo:")
            for k, v in headers.items():
                print(f"    {k}: {v}")
                
            print("\n[!] Vetor específico não implementado como script nativo isolado.")
            print("[+] Logs brutos capturados para análise posterior na interface.")
            
    except Exception as e:
        print(f"\n[!] Erro crítico ao executar injeção real: {e}")

def main():
    if len(sys.argv) < 3:
        print("Uso: python universal_tool.py <toolId> <target>")
        sys.exit(1)
        
    tool_id = sys.argv[1]
    target = sys.argv[2]
    
    print(f"=== Core Intelligence Engine ===")
    print(f"Tool ID: {tool_id}")
    print(f"Target : {target}")
    print(f"================================\n")
    
    if tool_id == 'net_ping':
        check_ping(target)
    elif tool_id == 'net_ports':
        check_ports(target)
    elif tool_id == 'web_headers':
        check_headers(target)
    elif tool_id == 'osint_whois':
        whois_lookup(target)
    elif tool_id.startswith('sec_') or tool_id.startswith('adv_'):
        # É um exploit ou scan de segurança
        execute_real_exploit(tool_id, target)
    else:
        # Varredura genérica agressiva para ferramentas sem módulo específico
        execute_real_exploit(tool_id, target)

if __name__ == "__main__":
    main()
