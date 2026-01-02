const { Client } = require('pg');

const password = 'DebugDragongs2025';
const projectRef = 'tdzgivkroeeqhusehtrg';
const username = `postgres.${projectRef}`;

// Test configs
const tests = [
  {
    name: 'West-2 Transaction Pooler',
    connectionString: `postgresql://${username}:${password}@aws-0-us-west-2.pooler.supabase.com:6543/postgres`
  },
  {
    name: 'East-2 Transaction Pooler',
    connectionString: `postgresql://${username}:${password}@aws-0-us-east-2.pooler.supabase.com:6543/postgres`
  },
  {
    name: 'East-2 Direct',
    connectionString: `postgresql://${username}:${password}@aws-0-us-east-2.pooler.supabase.com:5432/postgres`
  },
   {
    name: 'East-1 Direct',
    connectionString: `postgresql://${username}:${password}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
  },
     { // Try direct DB host
    name: 'DB Host Direct',
    connectionString: `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`
  }
];

async function runTests() {
  console.log("🔍 Diagnosing Database Connection...\n");
  
  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    console.log(`URL: ${test.connectionString.replace(password, '****')}`);
    
    const client = new Client({ 
        connectionString: test.connectionString,
        ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log("✅ SUCCESS! Connected successfully.");
      await client.end();
      // Found the working one!
      console.log("\n>>> USE THIS CONFIGURATION <<<");
      return;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      if (err.code) console.log(`   Code: ${err.code}`);
    }
    console.log('---');
  }
}

runTests();
