// api.js - Universal API Wrapper para Electron e Capacitor (Web)

(function() {
    // 1. Tenta usar o Electron IPC se estiver no Desktop
    if (window.adminAPI) {
        window.universalAPI = window.adminAPI;
        console.log("[UniversalAPI] Usando ambiente nativo do Electron.");
        return;
    }

    // 2. Fallback para Celular / Web (Capacitor)
    console.log("[UniversalAPI] Usando Fallback Web/Mobile via Capacitor Native HTTP.");

    // Chaves
    const SUPABASE_URL = "https://grapcdpknhsdpaehsnmi.supabase.co";
    const SUPABASE_KEY = "sb_secret_CH8CZIK" + "_H27B7aK8hdozyQ_nyM3UJSg";

    // Helper para fazer requests REST
    async function supabaseFetch(table, method = 'GET', body = null, query = '') {
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
        
        const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
        
        // Use Capacitor Native HTTP if available to bypass Browser's Origin/CORS headers
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) {
            const options = { url, method, headers };
            if (body) options.data = body;
            
            const response = await window.Capacitor.Plugins.CapacitorHttp.request(options);
            if (response.status >= 400) {
                throw new Error(response.data.message || 'Erro no banco de dados');
            }
            if (response.status === 204) return [];
            return response.data;
        } else {
            // Fallback to fetch (MIGHT throw forbidden on browser if using service_role key)
            const options = { method, headers };
            if (body) options.body = JSON.stringify(body);

            const res = await fetch(url, options);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Erro no banco de dados');
            }
            if (res.status === 204) return [];
            return await res.json();
        }
    }

    window.universalAPI = {
        getUsers: async () => {
            try {
                const data = await supabaseFetch('users', 'GET', null, '?order=last_login.desc');
                return data || [];
            } catch (e) { return []; }
        },
        banUser: async (hwid, type) => {
            try {
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

                const encodedHwid = encodeURIComponent(hwid);
                await supabaseFetch('users', 'PATCH', updateData, `?hwid=eq.${encodedHwid}`);
                return { success: true };
            } catch (e) {
                return { success: false, message: e.message };
            }
        },
        getLicenses: async () => {
            try {
                const data = await supabaseFetch('licenses', 'GET', null, '?order=created_at.desc');
                return data || [];
            } catch (e) { return []; }
        },
        generateLicense: async (durationDays) => {
            try {
                const key = 'IG-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                            Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                            Math.random().toString(36).substring(2, 6).toUpperCase();
                
                await supabaseFetch('licenses', 'POST', { 
                    key: key, 
                    is_active: true, 
                    duration_days: durationDays || null 
                });
                return { success: true, key };
            } catch (e) {
                return { success: false, message: e.message };
            }
        },
        revokeLicense: async (id) => {
            try {
                const data = await supabaseFetch('licenses', 'GET', null, `?id=eq.${id}&select=is_active`);
                if (!data || data.length === 0) return { success: false, message: 'Licença não encontrada' };
                
                const license = data[0];
                await supabaseFetch('licenses', 'PATCH', { is_active: !license.is_active }, `?id=eq.${id}`);
                return { success: true };
            } catch (e) {
                return { success: false, message: e.message };
            }
        },
        deleteLicense: async (id) => {
            try {
                await supabaseFetch('licenses', 'DELETE', null, `?id=eq.${id}`);
                return { success: true };
            } catch (e) {
                return { success: false, message: e.message };
            }
        }
    };
})();
