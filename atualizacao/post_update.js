require('dotenv').config({ path: '../inject-ig-console/.env' });
const db = require('../inject-ig-console/src/db.js');

async function main() {
  const content = process.argv[2];
  if (!content) return process.exit(0);
  
  try {
    await db.connect();
    const { error } = await db.client.from('app_updates').insert([{ type: 'update', content }]);
    if (error) {
      console.error('Erro ao postar update:', error.message);
    } else {
      console.log('Changelog atualizado no app dos clientes com sucesso!');
    }
  } catch (err) {
    console.error('Falha:', err.message);
  }
  process.exit(0);
}

main();
