
const { Client } = require('pg');
require('dotenv').config();

console.log("Testing connection to:", process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect()
  .then(() => {
    console.log('✅ Connected successfully via pg driver!');
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log('Time:', res.rows[0]);
    client.end();
  })
  .catch(err => {
    console.error('❌ Connection error:', err);
    client.end();
  });
