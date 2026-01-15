// Test Virginia Supabase connection directly
const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-us-east-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.xuvalaiwokitqwzbexms',
  password: 'Jascharan1990@',
  database: 'postgres',
});

async function testConnection() {
  try {
    console.log('🔄 Attempting to connect to Virginia Supabase...');
    await client.connect();
    console.log('✅ CONNECTION SUCCESSFUL!');
    
    const result = await client.query('SELECT NOW()');
    console.log('✅ Query successful:', result.rows[0]);
    
    await client.end();
    console.log('✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ CONNECTION FAILED:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    process.exit(1);
  }
}

testConnection();
