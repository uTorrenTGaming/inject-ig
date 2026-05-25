const { Client } = require('pg');

async function createDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '5127805124',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('Connected to default postgres database.');
    
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'injectig'");
    if (res.rowCount === 0) {
      await client.query('CREATE DATABASE injectig');
      console.log('Database "injectig" created successfully.');
    } else {
      console.log('Database "injectig" already exists.');
    }
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}
createDatabase();
