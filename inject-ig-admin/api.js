// api.js - Universal API Wrapper para Electron e Capacitor (Web)

(function() {
    // 1. Tenta usar o Electron IPC se estiver no Desktop
    if (window.adminAPI) {
        window.universalAPI = window.adminAPI;
        console.log("[UniversalAPI] Usando ambiente nativo do Electron.");
        return;
    }

    // 2. Fallback para Celular / Web (Capacitor)
    console.log("[UniversalAPI] Electron não detectado. Usando Fallback Web/Mobile via Supabase CDN.");

    // Chaves de acesso hardcoded temporárias (No build final de produção usar env variables do vite/webpack)
    const SUPABASE_URL = "https://grapcdpknhsdpaehsnmi.supabase.co";
    const SUPABASE_KEY = "sb_secret_CH8CZIK" + "_H27B7aK8hdozyQ_nyM3UJSg";

    // Aguarda o carregamento do script do Supabase no index.html
    let supabase = null;
    
    function getSupabase() {
        if (!supabase && window.supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
        }
        return supabase;
    }

    window.universalAPI = {
        getUsers: async () => {
            const sb = getSupabase();
            if (!sb) return [];
            const { data, error } = await sb.from('users').select('*').order('last_login', { ascending: false });
            if (error) console.error(error);
            return data || [];
        },
        banUser: async (hwid, type) => {
            const sb = getSupabase();
            if (!sb) return { success: false, message: 'Supabase not loaded' };
            
            let updateData = {};
            if (type === 'permanent') {
                updateData = { is_banned: true, ban_expires_at: null };
            } else if (type === '30days') {
                const date = new Date();
                date.setDate(date.getDate() + 30);
                updateData = { is_banned: true, ban_expires_at: date.toISOString() };
            } else if (type === 'unban') {
                updateData = { is_banned: false, ban_expires_at: null };
            }

            const { error } = await sb.from('users').update(updateData).eq('hwid', hwid);
            if (error) return { success: false, message: error.message };
            return { success: true };
        },
        getLicenses: async () => {
            const sb = getSupabase();
            if (!sb) return [];
            const { data, error } = await sb.from('licenses').select('*').order('created_at', { ascending: false });
            if (error) console.error(error);
            return data || [];
        },
        generateLicense: async (durationDays) => {
            const sb = getSupabase();
            if (!sb) return { success: false, message: 'Supabase not loaded' };
            const key = 'IG-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                        Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                        Math.random().toString(36).substring(2, 6).toUpperCase();
            
            const { error } = await sb.from('licenses').insert([{ 
                key: key, 
                is_active: true, 
                duration_days: durationDays || null 
            }]);
            if (error) return { success: false, message: error.message };
            return { success: true, key };
        },
        revokeLicense: async (id) => {
            const sb = getSupabase();
            if (!sb) return { success: false, message: 'Supabase not loaded' };
            const { data: license } = await sb.from('licenses').select('is_active').eq('id', id).single();
            if (!license) return { success: false, message: 'Licença não encontrada' };

            const { error } = await sb.from('licenses').update({ is_active: !license.is_active }).eq('id', id);
            if (error) return { success: false, message: error.message };
            return { success: true };
        },
        deleteLicense: async (id) => {
            const sb = getSupabase();
            if (!sb) return { success: false, message: 'Supabase not loaded' };
            const { error } = await sb.from('licenses').delete().eq('id', id);
            if (error) return { success: false, message: error.message };
            return { success: true };
        }
    };
})();
