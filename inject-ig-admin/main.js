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
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 500,
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#121214',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.maximize();
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

ipcMain.on('window.close', () => app.quit());
ipcMain.on('window.minimize', () => mainWindow.minimize());
ipcMain.on('window.maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});
