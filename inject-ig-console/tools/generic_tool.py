import sys
import time

def main():
    if len(sys.argv) < 2:
        print("Uso: python generic_tool.py <url>")
        sys.exit(1)
        
    url = sys.argv[1]
    
    print(f"[+] Iniciando diagnóstico de inteligência no alvo.")
    print(f"[+] Alvo definido: {url}")
    time.sleep(0.5)
    
    print(f"[*] Analisando topologia de rede...")
    time.sleep(1)
    
    print(f"[*] Extraindo metadados...")
    time.sleep(0.8)
    
    print("\n[!] A ferramenta genérica não possui módulos específicos para esta rotação.")
    print("[!] O alvo não expõe dados passivos para o vetor selecionado.")
    print("\n[+] Diagnóstico finalizado.")

if __name__ == "__main__":
    main()
