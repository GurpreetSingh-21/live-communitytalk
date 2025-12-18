require('dotenv').config();
const { Client, Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
    connectionString: connectionString,
});

async function applySchema() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, 'schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🔌 Connected to database via pg');
        console.log('📜 Applying schema from schema.sql...');

        // Need to handle Types first if they don't exist
        const types = [
            "CREATE TYPE \"Role\" AS ENUM ('user', 'mod', 'admin');",
            "CREATE TYPE \"CommunityType\" AS ENUM ('college', 'religion', 'custom');",
            "CREATE TYPE \"MemberRole\" AS ENUM ('member', 'admin', 'owner');",
            "CREATE TYPE \"MemberStatus\" AS ENUM ('active', 'invited', 'banned', 'online', 'owner');",
            "CREATE TYPE \"MessageStatus\" AS ENUM ('sent', 'delivered', 'read', 'edited', 'deleted');",
            "CREATE TYPE \"DMType\" AS ENUM ('text', 'photo', 'video', 'audio', 'file');"
        ];

        for (const type of types) {
            try {
                await client.query(type);
                console.log(`  ✅ Type created: ${type.split('"')[1]}`);
            } catch (e) {
                // Likely already exists
                if (e.code === '42710') {
                    console.log(`  🔹 Type already exists: ${type.split('"')[1]}`);
                } else {
                    console.warn(`  ⚠️ Failed to create type: ${e.message}`);
                }
            }
        }

        // Split SQL by command but respect semi-colons
        // The generated SQL separates commands by newlines and CreateTable/Index comments
        // A simple split by ';' might be safer given the output format

        // Actually, client.query can execute multiple statements if connection allows, but sometimes safer to not.
        // Let's try executing the whole block.
        await client.query(sql);

        console.log('🎉 Schema applied successfully!');
    } catch (err) {
        console.error('❌ Schema application failed:', err);
        // 42P07 = table already exists
        if (err.code === '42P07') {
            console.log('   (Table already exists, ignoring)');
        }
    } finally {
        client.release();
        await pool.end();
    }
}

applySchema();
