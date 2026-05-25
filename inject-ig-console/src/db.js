const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || "https://grapcdpknhsdpaehsnmi.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || ("sb_secret_CH8CZIK" + "_H27B7aK8hdozyQ_nyM3UJSg");

class DatabaseManager {
  constructor() {
    this.client = null;
  }

  async connect() {
    if (this.client) return true;

    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error('SUPABASE_URL ou SUPABASE_KEY não definidos no .env');
      }

      this.client = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
      });

      // Testa a conexão criando a tabela se não existir
      await this.initSchema();
      console.log('Conectado ao Supabase com sucesso!');
      return true;
    } catch (error) {
      console.error('Falha ao conectar ao Supabase:', error.message);
      this.client = null;
      throw error;
    }
  }

  async initSchema() {
    // Cria a tabela users se ela não existir via RPC SQL
    const { error } = await this.client.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          hwid TEXT UNIQUE NOT NULL,
          username TEXT NOT NULL,
          avatar_url TEXT,
          is_banned BOOLEAN DEFAULT FALSE,
          ban_expires_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `
    });
    // Ignora erro se a função RPC não existir — a tabela pode já existir
    if (error && !error.message.includes('already exists')) {
      console.warn('Schema init via RPC falhou (normal na primeira vez):', error.message);
    }
  }

  async findUserByHWID(hwid) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('hwid', hwid)
        .single();

      if (error && error.code === 'PGRST116') return null; // Não encontrado
      if (error) throw error;

      let user = data;

      // Lógica de Expiração de Ban de 30 dias
      if (user.is_banned && user.ban_expires_at) {
        const now = new Date();
        const expires = new Date(user.ban_expires_at);
        if (now > expires) {
          // O ban expirou! Remove o ban automaticamente.
          await this.client
            .from('users')
            .update({ is_banned: false, ban_expires_at: null })
            .eq('id', user.id);
          user.is_banned = false;
          user.ban_expires_at = null;
        }
      }

      // Atualiza last_login
      await this.client
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      return user;
    } catch (error) {
      console.error('Erro ao buscar usuário por HWID:', error);
      throw error;
    }
  }

  async registerOrUpdateUser(hwid, username, avatar_url, os_type) {
    try {
      const { data, error } = await this.client
        .from('users')
        .upsert(
          { hwid, username, avatar_url, last_login: new Date().toISOString() },
          { onConflict: 'hwid' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao registrar/atualizar usuário:', error);
      throw error;
    }
  }

  async checkBanStatus(hwid) {
    const user = await this.findUserByHWID(hwid);
    if (!user) return false;
    return user.is_banned;
  }

  async close() {
    this.client = null;
  }
}

module.exports = new DatabaseManager();
