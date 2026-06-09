const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || "https://grapcdpknhsdpaehsnmi.supabase.co";

function _d(str) {
    const b = Buffer.from(str, 'base64').toString('binary');
    const k = 'IGOR2026';
    let o = '';
    for(let i=0; i<b.length; i++) o += String.fromCharCode(b.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    return o;
}

// Chave ofuscada/criptografada para compilação e proteção contra análise estática simples
const SUPABASE_KEY = process.env.SUPABASE_KEY || _d('OiUQIVdTQFM9GAwaCnNofwIYB2AFcgVXAn8nNl1KS2cWKTYfAWV4ZS4=');

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

      // Cria o cliente — a partir daqui já está funcional para queries
      this.client = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
      });

      // initSchema é opcional — falha silenciosa não bloqueia o login
      try {
        await this.initSchema();
      } catch (schemaErr) {
        console.warn('initSchema falhou (não crítico):', schemaErr.message);
      }

      console.log('Conectado ao Supabase com sucesso!');
      return true;
    } catch (error) {
      console.error('Falha ao conectar ao Supabase:', error.message);
      // NÃO zeramos this.client se já foi criado — preservamos a conexão
      if (!this.client) throw error;
      return true;
    }
  }

  async initSchema() {
    try {
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

          CREATE TABLE IF NOT EXISTS licenses (
            id SERIAL PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            hwid_vinculado TEXT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            duration_days INTEGER NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            activated_at TIMESTAMP NULL,
            expires_at TIMESTAMP NULL
          );

          CREATE TABLE IF NOT EXISTS pending_payments (
            id SERIAL PRIMARY KEY,
            hwid TEXT NOT NULL,
            nick TEXT NOT NULL,
            plan INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS support_tickets (
            id SERIAL PRIMARY KEY,
            hwid TEXT NOT NULL,
            message TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE,
            status TEXT DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS app_updates (
            id SERIAL PRIMARY KEY,
            type TEXT DEFAULT 'update',
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `
      });
      // Ignora erro se a função RPC não existir — a tabela pode já existir
      if (error && !error.message.includes('already exists')) {
        console.warn('Schema init via RPC falhou (normal na primeira vez):', error.message);
      }
    } catch (err) {
      console.warn('Network ou falha crítica no initSchema:', err.message);
    }
  }

  async findUserByHWID(hwid) {
    try {
      if (!this.client) await this.connect();
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
      if (!this.client) await this.connect();
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

  // ── Digital Licensing (DRM) ──

  async hasValidLicense(hwid) {
    try {
      const { data, error } = await this.client
        .from('licenses')
        .select('*')
        .eq('hwid_vinculado', hwid)
        .eq('is_active', true)
        .single();

      if (!data) return false;

      // Verifica se a licença expirou
      if (data.expires_at) {
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        
        if (now > expiresAt) {
          // Licença expirou, vamos desativá-la no banco
          await this.client
            .from('licenses')
            .update({ is_active: false })
            .eq('id', data.id);
          return false;
        }
      }

      return true;
    } catch (error) {
      // PGRST116 é o erro de not found do Supabase
      if (error.code === 'PGRST116') return false;
      console.error('Erro ao checar licença:', error);
      return false;
    }
  }

  async getLicenseInfo(hwid) {
    try {
      if (!this.client) await this.connect();
      const { data, error } = await this.client
        .from('licenses')
        .select('*')
        .eq('hwid_vinculado', hwid)
        .eq('is_active', true)
        .single();

      if (!data) return null;
      return data;
    } catch (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Erro ao buscar detalhes da licença:', error);
      return null;
    }
  }

  async activateLicense(key, hwid) {
    try {
      if (!this.client) await this.connect();
      
      // DEV BACKDOOR PARA O IGOR
      if (key === 'IGOR-DEV-MASTER') {
          const fakeKey = 'IG-DEV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
          await this.client.from('licenses').insert([{
              key: fakeKey,
              hwid_vinculado: hwid,
              is_active: true,
              activated_at: new Date().toISOString()
          }]);
          return { success: true, message: 'Licença DEV gerada e vinculada com sucesso!' };
      }

      // 1. Busca a licença pela chave
      const { data: license, error: fetchError } = await this.client
        .from('licenses')
        .select('*')
        .eq('key', key)
        .single();

      if (fetchError || !license) {
        return { success: false, message: 'Chave de licença inválida ou não encontrada.' };
      }

      // 2. Verifica se a licença está inativa/cancelada
      if (!license.is_active) {
        return { success: false, message: 'Esta licença foi cancelada ou suspensa.' };
      }

      // 3. Verifica se já está vinculada a outro computador
      if (license.hwid_vinculado && license.hwid_vinculado !== hwid) {
        return { success: false, message: 'Esta chave já está em uso por outro computador.' };
      }

      // 4. Se não estiver vinculada, vincula ao HWID atual
      if (!license.hwid_vinculado) {
        const now = new Date();
        let expiresAt = null;

        if (license.duration_days) {
          const expDate = new Date(now);
          expDate.setDate(expDate.getDate() + license.duration_days);
          expiresAt = expDate.toISOString();
        }

        const { error: updateError } = await this.client
          .from('licenses')
          .update({ 
            hwid_vinculado: hwid, 
            activated_at: now.toISOString(),
            expires_at: expiresAt
          })
          .eq('id', license.id);

        if (updateError) throw updateError;
      }

      return { success: true, message: 'Licença ativada com sucesso!' };
    } catch (error) {
      console.error('Erro na ativação da licença:', error);
      return { success: false, message: 'Erro no servidor ao validar licença.' };
    }
  }

  async checkBanStatus(hwid) {
    const user = await this.findUserByHWID(hwid);
    if (!user) return false;
    return user.is_banned;
  }

  async submitSupportTicket(hwid, message, isAdmin = false) {
    try {
      if (!this.client) await this.connect();
      const { data, error } = await this.client
        .from('support_tickets')
        .insert([{ hwid, message, is_admin: isAdmin }]);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao enviar ticket de suporte:', error);
      return { success: false, message: error.message };
    }
  }

  async getSupportMessages(hwid) {
    try {
      if (!this.client) await this.connect();
      const { data, error } = await this.client
        .from('support_tickets')
        .select('*')
        .eq('hwid', hwid)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return { success: true, messages: data };
    } catch (error) {
      console.error('Erro ao buscar mensagens do suporte:', error);
      return { success: false, messages: [] };
    }
  }

  async getAllActiveChats() {
    try {
      if (!this.client) await this.connect();
      // Fetch all messages, order by descending to get latest first
      const { data, error } = await this.client
        .from('support_tickets')
        .select('hwid, message, created_at, is_admin')
        .order('created_at', { ascending: false });
        
      if (error) throw error;

      // Agrupa por HWID pegando a última mensagem
      const chatsMap = new Map();
      for (const msg of data) {
        if (!chatsMap.has(msg.hwid)) {
          chatsMap.set(msg.hwid, {
            hwid: msg.hwid,
            lastMessage: msg.message,
            timestamp: msg.created_at,
            lastIsAdmin: msg.is_admin
          });
        }
      }
      return { success: true, chats: Array.from(chatsMap.values()) };
    } catch (error) {
      console.error('Erro ao buscar chats ativos:', error);
      return { success: false, chats: [] };
    }
  }

  subscribeToSupportTickets(callback) {
    if (!this.client) return;
    
    // Inscreve no canal do Supabase Realtime
    const channel = this.client.channel('support-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, (payload) => {
        callback(payload.new);
      })
      .subscribe();
      
    return channel;
  }

  async getAppUpdates() {
    try {
      if (!this.client) await this.connect();
      const { data, error } = await this.client
        .from('app_updates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return { success: true, updates: data };
    } catch (error) {
      console.error('Erro ao buscar atualizações:', error);
      return { success: false, updates: [] };
    }
  }

  async close() {
    this.client = null;
  }
}

module.exports = new DatabaseManager();
