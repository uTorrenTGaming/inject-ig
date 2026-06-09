import sys
import os
import subprocess
import zipfile
import xml.etree.ElementTree as ET
import re

def install_deps():
    try:
        import pdf2docx
        import fitz
    except ImportError:
        print("Instalando dependencias do PDF Studio...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pdf2docx", "PyMuPDF"])

try:
    install_deps()
    from pdf2docx import Converter
    import fitz # PyMuPDF
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)

def pdf_to_docx(pdf_path, docx_path):
    try:
        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()
        print(f"SUCCESS: {docx_path}")
    except Exception as e:
        print(f"ERROR: {e}")

def pdf_to_txt(pdf_path, txt_path):
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"SUCCESS: {txt_path}")
    except Exception as e:
        print(f"ERROR: {e}")

def img_to_pdf(img_path, pdf_path):
    try:
        img_doc = fitz.open(img_path)
        pdf_bytes = img_doc.convert_to_pdf()
        img_doc.close()
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        print(f"SUCCESS: {pdf_path}")
    except Exception as e:
        print(f"ERROR: {e}")

def extract_text_from_docx(docx_path):
    try:
        with zipfile.ZipFile(docx_path) as z:
            xml_content = z.read('word/document.xml')
        root = ET.fromstring(xml_content)
        namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        texts = []
        for paragraph in root.findall('.//w:p', namespaces):
            p_text = ""
            for t in paragraph.findall('.//w:t', namespaces):
                if t.text:
                    p_text += t.text
            texts.append(p_text)
        return '\n'.join(texts)
    except Exception:
        return ""

def write_text_to_pdf(text, pdf_path):
    doc = fitz.open()
    fontname = "helv"
    fontsize = 11
    line_height = 15
    margin = 50
    page_width = 595
    page_height = 842
    
    page = doc.new_page(width=page_width, height=page_height)
    current_y = margin
    
    lines = text.split('\n')
    for line in lines:
        max_chars = 85
        wrapped_lines = [line[i:i+max_chars] for i in range(0, len(line), max_chars)] if line else [""]
        for wl in wrapped_lines:
            if current_y + line_height > page_height - margin:
                page = doc.new_page(width=page_width, height=page_height)
                current_y = margin
            page.insert_text(fitz.Point(margin, current_y), wl, fontname=fontname, fontsize=fontsize)
            current_y += line_height
            
    doc.save(pdf_path)
    doc.close()

def docs_to_pdf(doc_path, pdf_path):
    ext = os.path.splitext(doc_path.lower())[1]
    
    # 1. Se for texto puro (.txt), converte diretamente
    if ext == '.txt':
        try:
            with open(doc_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
            write_text_to_pdf(text, pdf_path)
            print(f"SUCCESS: {pdf_path}")
            return
        except Exception as e:
            print(f"ERROR: {e}")
            return

    # 2. Tenta LibreOffice se disponível (multiplataforma)
    try:
        soffice_path = "soffice"
        if sys.platform == "win32":
            paths = [
                r"C:\Program Files\LibreOffice\program\soffice.exe",
                r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"
            ]
            for p in paths:
                if os.path.exists(p):
                    soffice_path = p
                    break
        elif sys.platform == "darwin":
            p = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
            if os.path.exists(p):
                soffice_path = p
                
        outdir = os.path.dirname(pdf_path)
        subprocess.run([soffice_path, "--headless", "--convert-to", "pdf", "--outdir", outdir, doc_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        default_out = os.path.join(outdir, os.path.splitext(os.path.basename(doc_path))[0] + ".pdf")
        if os.path.exists(default_out):
            if default_out != pdf_path:
                os.replace(default_out, pdf_path)
            print(f"SUCCESS: {pdf_path}")
            return
    except Exception:
        pass
        
    # 3. Tenta docx2pdf (se Microsoft Word estiver instalado no Mac/Windows)
    if ext == '.docx':
        try:
            import docx2pdf
            docx2pdf.convert(doc_path, pdf_path)
            if os.path.exists(pdf_path):
                print(f"SUCCESS: {pdf_path}")
                return
        except Exception:
            pass

    # 4. Fallback para DOCX: Extração de texto XML nativa
    if ext == '.docx':
        try:
            text = extract_text_from_docx(doc_path)
            if text:
                write_text_to_pdf(text, pdf_path)
                print(f"SUCCESS: {pdf_path}")
                return
            else:
                raise Exception("Não foi possível extrair texto do documento .docx.")
        except Exception as e:
            print(f"ERROR: {e}")
            return

    # 5. RTF fallback: tenta ler e remover tags RTF básicas
    if ext == '.rtf':
        try:
            with open(doc_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            text = re.sub(r'\\([a-z]{1,32})(-?\d+)? ?|\\\'[0-9a-f]{2}|\\\{|\\\}|[\r\n]', '', content)
            text = text.replace('\\\\', '\\')
            write_text_to_pdf(text, pdf_path)
            print(f"SUCCESS: {pdf_path}")
            return
        except Exception as e:
            print(f"ERROR: {e}")
            return

    print("ERROR: Formato de documento não suportado ou dependência (LibreOffice/Word) ausente.")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("ERROR: missing arguments")
        sys.exit(1)
        
    action = sys.argv[1]
    input_file = sys.argv[2]
    output_file = sys.argv[3]
    
    if action == "pdf2docx":
        pdf_to_docx(input_file, output_file)
    elif action == "pdf2txt":
        pdf_to_txt(input_file, output_file)
    elif action == "img2pdf":
        img_to_pdf(input_file, output_file)
    elif action == "docs2pdf":
        docs_to_pdf(input_file, output_file)
    else:
        print(f"ERROR: unknown action {action}")
