require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

(async () => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log('Tables in public schema:');
        res.rows.forEach(r => console.log(` - ${r.table_name}`));

    } catch (err) {
        console.error('Error listing tables:', err);
    } finally {
        client.release();
        pool.end();
    }
})();
