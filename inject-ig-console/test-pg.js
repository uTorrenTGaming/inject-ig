const { Client } = require('pg');
const os = require('os');

async function testConnection() {
  const usersToTest = ['postgres', os.userInfo().username, 'root'];
  const passwordsToTest = ['postgres', '', 'root'];

  for (const user of usersToTest) {
    for (const password of passwordsToTest) {
      const client = new Client({
        host: 'localhost',
        port: 5432,
        user: user,
        password: password,
        database: 'postgres' // connect to default database first
      });

      try {
        await client.connect();
        console.log(`SUCCESS: Connected with user "${user}" and password "${password}"`);
        
        // Try creating the database
        try {
           await client.query('CREATE DATABASE injectig;');
           console.log('Database injectig created!');
        } catch (err) {
           if (err.code === '42P04') {
               console.log('Database injectig already exists.');
           } else {
               console.log('Error creating database:', err.message);
           }
        }
        
        await client.end();
        return { user, password };
      } catch (err) {
        // console.log(`Failed for user ${user}: ${err.message}`);
      }
    }
  }
  console.log('FAILED to connect with all tested credentials.');
}

testConnection();
