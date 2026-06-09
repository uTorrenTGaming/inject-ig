import sys
import socket
import threading
from queue import Queue
import time
from urllib.parse import urlparse

# Common Top 50 Ports
PORTS_TO_SCAN = [
    21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995, 
    1723, 3306, 3389, 5900, 8080, 8443, 27017, 6379, 5432, 1521, 1433
]

def scan_port(target_ip, port, queue, timeout=1.5):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        result = sock.connect_ex((target_ip, port))
        if result == 0:
            queue.put((port, 'OPEN'))
            # Try grabbing banner
            try:
                sock.send(b"HEAD / HTTP/1.1\r\n\r\n")
                banner = sock.recv(1024).decode('utf-8', errors='ignore').strip()
                if banner:
                    queue.put((port, f'BANNER: {banner[:50]}...'))
            except:
                pass
    except:
        pass
    finally:
        sock.close()

def main():
    if len(sys.argv) < 2:
        print("[-] Uso: python nmap_portscan.py <alvo>")
        sys.exit(1)

    target_input = sys.argv[1]
    target_host = target_input
    
    # Strip protocol if present
    if target_input.startswith("http://") or target_input.startswith("https://"):
        target_host = urlparse(target_input).hostname

    print(f"\x1b[36m[+]\x1b[0m Resolvendo host: {target_host}")
    
    try:
        target_ip = socket.gethostbyname(target_host)
        print(f"\x1b[36m[+]\x1b[0m Alvo resolvido para IP: {target_ip}")
    except socket.gaierror:
        print(f"\x1b[31m[-]\x1b[0m Não foi possível resolver o hostname: {target_host}")
        sys.exit(1)

    print(f"[*] Iniciando Scan (TCP Connect) nas {len(PORTS_TO_SCAN)} portas principais...")
    start_time = time.time()
    
    q = Queue()
    threads = []
    
    for port in PORTS_TO_SCAN:
        t = threading.Thread(target=scan_port, args=(target_ip, port, q))
        threads.append(t)
        t.start()
        time.sleep(0.01) # Small delay to not overwhelm local descriptors
        
    for t in threads:
        t.join()

    open_ports = []
    while not q.empty():
        open_ports.append(q.get())

    print("\n\x1b[32m[RESULTADOS]\x1b[0m")
    if not open_ports:
        print("[-] Nenhuma porta aberta encontrada nas portas testadas.")
    else:
        # Group by port
        results = {}
        for item in open_ports:
            port = item[0]
            val = item[1]
            if port not in results:
                results[port] = []
            results[port].append(val)
            
        for port, infos in sorted(results.items()):
            print(f"  > \x1b[33mPorta {port}\x1b[0m: ABERTA")
            for info in infos:
                if info.startswith("BANNER:"):
                    print(f"      - {info}")
                    
    duration = time.time() - start_time
    print(f"\n[*] Escaneamento finalizado em {duration:.2f} segundos.")

if __name__ == '__main__':
    main()
