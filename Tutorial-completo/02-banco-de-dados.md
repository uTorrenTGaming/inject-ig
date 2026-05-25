# Configuração e Operação do Banco de Dados

O aplicativo se baseia inteiramente no PostgreSQL. Ele utiliza a biblioteca nativa `pg` do Node.js, incorporada diretamente no Electron (`src/db.js`).

## 1. Conexão

O arquivo principal `main.js` estabelece a conexão instantaneamente antes de exibir a interface gráfica:

```javascript
await db.connect({ 
    user: 'postgres', 
    password: '<Sua_Senha_Aqui>' // Por padrão 5127805124
});
```

Se precisar alterar essas credenciais (por exemplo, quando apontar para uma VPS na nuvem), edite o arquivo `main.js`.

## 2. A Tabela `users`

A validação de identidade é gerida por uma tabela simples, mas projetada para bloquear fraudes físicas.

```sql
CREATE TABLE IF NOT EXISTS users (
    hwid VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    avatar_url TEXT DEFAULT '',
    is_banned BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Detalhamento das Colunas:
- `hwid`: Chave primária. Hash da placa-mãe.
- `username`: Definido pelo usuário na tela inicial do app.
- `avatar_url`: A imagem que o usuário escolher (Link ou DiceBear avatar).
- `is_banned`: Flag de segurança máxima.

## 3. Gestão e Banimentos Manuais

Atualmente, enquanto não temos o App de Administração finalizado, a gestão de quem acessa o aplicativo é feita manipulando essa tabela manualmente no PostgreSQL.

### Bloquear (Banir) um Computador
```bash
psql -U postgres -d injectig -c "UPDATE users SET is_banned = true WHERE username='NomeDoAlvo';"
```

### Desbloquear
```bash
psql -U postgres -d injectig -c "UPDATE users SET is_banned = false WHERE username='NomeDoAlvo';"
```

Qualquer máquina que tentar logar enquanto `is_banned = true` ficará travada eternamente em uma tela vermelha de alerta (Banned Screen).
