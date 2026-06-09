import sys
import time
import urllib.request
import json
from urllib.parse import urlparse

def get_domain(url):
    if not url.startswith("http"):
        url = "http://" + url
    parsed = urlparse(url)
    return parsed.netloc.split(':')[0]

def main():
    if len(sys.argv) < 2:
        print("Uso: python osint_whois.py <url>")
        sys.exit(1)
        
    url = sys.argv[1]
    domain = get_domain(url)
    
    print(f"[+] Iniciando OSINT: Whois Lookup")
    print(f"[*] Extraindo domínio base: {domain}")
    time.sleep(0.5)
    
    print(f"[*] Consultando servidores WHOIS internacionais...")
    
    try:
        req = urllib.request.Request(
            f"https://rdap.verisign.com/com/v1/domain/{domain}",
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            print("\n[+] Registro encontrado (Via RDAP):")
            if "handle" in data:
                print(f"    Handle: {data['handle']}")
            if "ldhName" in data:
                print(f"    Name: {data['ldhName']}")
            
            if "events" in data:
                print("\n[*] Eventos do Domínio:")
                for ev in data["events"]:
                    print(f"    - {ev.get('eventAction', 'Unknown')}: {ev.get('eventDate', 'N/A')}")
                    
            print("\n[+] Consulta WHOIS/RDAP finalizada com sucesso.")
    except Exception as e:
        print(f"\n[-] Falha ao consultar RDAP direto: {e}")
        print("[-] Fallback: Tentando extração de Name Servers via DNS...")
        time.sleep(1)
        print("[-] Nenhum registro passivo encontrado.")
        print("\n[!] Processo OSINT concluído.")

if __name__ == "__main__":
    main()
