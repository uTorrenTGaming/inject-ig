import sys
import time
import os
import subprocess
import tempfile
import base64

# Dummy 1x1 transparent PNG as fallback
DUMMY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

def get_tmp_file():
    return os.path.join(tempfile.gettempdir(), 'inject_ig_screen.png')

def write_dummy(path):
    try:
        with open(path, 'wb') as f:
            f.write(base64.b64decode(DUMMY_PNG_B64))
    except Exception:
        pass

def main():
    print("INFO: Conectado. Iniciando captura de tela simulada USB...", flush=True)
    tmp_file = get_tmp_file()
    
    # Check OS
    is_mac = sys.platform == 'darwin'
    
    while True:
        try:
            if is_mac:
                # Use macOS built-in screencapture (silent, no sound, main display)
                subprocess.run(['screencapture', '-x', '-C', tmp_file], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                # For Windows/Linux, write dummy if it doesn't exist
                write_dummy(tmp_file)
            
            # If file was created successfully, tell electron to read it
            if os.path.exists(tmp_file):
                print("FRAME", flush=True)
            else:
                print("ERROR: Falha ao gerar frame", flush=True)
                
            time.sleep(1.0) # Capture every 1 second
            
        except Exception as e:
            print(f"ERROR: {str(e)}", flush=True)
            time.sleep(1.0)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
