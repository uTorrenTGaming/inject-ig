require('dotenv').config();
const db = require('./src/db');

async function generate() {
    await db.connect();
    
    // Gera uma chave aleatória estilo serial
    const key = 'IG-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const { data, error } = await db.client
        .from('licenses')
        .insert([{ key: key, is_active: true }])
        .select();

    if (error) {
        console.error('Erro ao gerar chave:', error.message);
    } else {
        console.log('✅ CHAVE GERADA COM SUCESSO!');
        console.log('Chave:', key);
    }
    
    process.exit(0);
}

generate();
