CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    hwid VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    is_banned BOOLEAN DEFAULT false,
    ban_expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adiciona a coluna com segurança caso a tabela já exista (versões anteriores)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='ban_expires_at') THEN
        ALTER TABLE users ADD COLUMN ban_expires_at TIMESTAMP NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS configs (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL
);
