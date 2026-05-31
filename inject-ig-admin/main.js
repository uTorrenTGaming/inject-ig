const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let mainWindow;
let supabase;

async function connectDB() {
    const url = process.env.SUPABASE_URL || "https://grapcdpknhsdpaehsnmi.supabase.co";
    const key = process.env.SUPABASE_KEY || ("sb_secret_CH8CZIK" + "_H27B7aK8hdozyQ_nyM3UJSg");

    supabase = createClient(url, key, { auth: { persistSession: false } });
    console.log('Admin conectado ao Supabase!');
}

app.whenReady().then(async () => {
    await connectDB();
    
    mainWindow = new BrowserWindow({
        width: 1050,
        height: 700,
        minWidth: 800,
        minHeight: 500,
        center: true,
        titleBarStyle: 'hiddenInset',
        vibrancy: 'sidebar', // Apple HIG vibrancy for sidebar area
        visualEffectState: 'active',
        backgroundColor: '#00000000', // Transparent background to let vibrancy show
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');
});

ipcMain.handle('admin.getUsers', async () => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('last_login', { ascending: false });

    if (error) throw error;
    return data;
});

ipcMain.handle('admin.banUser', async (event, hwid, type) => {
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

        const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('hwid', hwid);

        if (error) throw error;
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ── LICENSES IPC ──
ipcMain.handle('admin.getLicenses', async () => {
    const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
});

ipcMain.handle('admin.generateLicense', async (event, durationDays) => {
    try {
        const key = 'IG-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                    Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                    Math.random().toString(36).substring(2, 6).toUpperCase();
        
        const { error } = await supabase
            .from('licenses')
            .insert([{ 
                key: key, 
                is_active: true, 
                duration_days: durationDays || null 
            }]);

        if (error) throw error;
        return { success: true, key };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('admin.revokeLicense', async (event, id) => {
    try {
        // Find current status to toggle
        const { data: license } = await supabase.from('licenses').select('is_active').eq('id', id).single();
        if (!license) throw new Error('Licença não encontrada');

        const { error } = await supabase
            .from('licenses')
            .update({ is_active: !license.is_active })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('admin.deleteLicense', async (event, id) => {
    try {
        const { error } = await supabase
            .from('licenses')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

// ── PENDING PAYMENTS IPC (Via Licenses Table) ──
ipcMain.handle('admin.getPendingPayments', async () => {
    // Busca licenças inativas com a chave começando com PENDING|
    const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .like('key', 'PENDING|%')
        .eq('is_active', false)
        .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Transformar para o formato esperado pelo frontend
    return data.map(lic => {
        const parts = lic.key.split('|');
        return {
            id: lic.id,
            nick: parts[1] || 'Desconhecido',
            plan: lic.duration_days,
            hwid: lic.hwid_vinculado,
            created_at: lic.created_at,
            status: 'pending'
        };
    });
});

ipcMain.handle('admin.approvePayment', async (event, id) => {
    try {
        const { data: pending } = await supabase.from('licenses').select('*').eq('id', id).single();
        if (!pending || !pending.key.startsWith('PENDING|')) throw new Error('Pagamento pendente não encontrado');

        const key = 'IG-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                    Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                    Math.random().toString(36).substring(2, 6).toUpperCase();
        
        // Atualiza a licença pendente para uma licença oficial ativa
        const { error: updErr } = await supabase
            .from('licenses')
            .update({ 
                key: key,
                is_active: true, 
                activated_at: new Date().toISOString() 
            })
            .eq('id', id);
        
        if (updErr) throw updErr;
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.on('window.close', () => app.quit());
ipcMain.on('window.minimize', () => mainWindow.minimize());
ipcMain.on('window.maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});
