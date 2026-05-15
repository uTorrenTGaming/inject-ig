# 🛠️ Como usar o Instalador Completo (setup.sh)

O arquivo `setup.sh` dentro desta pasta é um **gerador de projeto completo**. Ele não apenas configura o ambiente, mas cria toda a estrutura de pastas e arquivos fontes do Inject-IG.

---

## 🏃 Como executar

1.  **Abra o Terminal** na pasta onde deseja criar o projeto.
2.  **Dê permissão de execução** ao script:
    ```bash
    chmod +x tutorial/setup.sh
    ```
3.  **Execute o script**:
    ```bash
    ./tutorial/setup.sh
    ```

---

## 📋 O que o script faz?

1.  **Criação de Pastas**: Gera a hierarquia completa de diretórios para o Console (Electron) e o Core Engine (Java).
2.  **Geração de Código**: Escreve os arquivos `package.json`, `main.js`, `index.html`, `pom.xml` e as classes Java essenciais diretamente no disco.
3.  **Script de Inicialização**: Cria o arquivo `./iniciar` pronto para uso.

---

## 🔧 Pós-Instalação

Após rodar o `setup.sh`, você deve instalar as dependências manualmente (ou o script fará isso se você adicionar os comandos):

```bash
# No Console
cd inject-ig-console && npm install

# No Backend
cd ../inject-ig-engine/core-engine
chmod +x mvnw
./mvnw clean install
```


---

## ⚠️ Requisitos antes de rodar

O script verifica a presença das ferramentas, mas não as instala para você. Certifique-se de ter:
- **Node.js 18+**
- **JDK 17 ou 21** (Recomendado: Amazon Corretto ou Oracle OpenJDK)

---

## 🔄 Quando rodar novamente?

Você deve rodar o `setup.sh` novamente se:
- Você deletar a pasta `node_modules`.
- Houver atualizações grandes na estrutura do banco de dados ou dependências do Java.
- Você estiver movendo o projeto para um novo diretório ou computador.
