require('dotenv').config();
const Redis = require('ioredis');

async function main() {
  const UPSTASH_URL = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  const redisTLS = (process.env.REDIS_URL || '').startsWith('rediss://') 
    ? { rejectUnauthorized: false, servername: UPSTASH_URL.hostname } 
    : undefined;
  
  const client = new Redis({
    host: UPSTASH_URL.hostname,
    port: parseInt(UPSTASH_URL.port) || 6379,
    username: UPSTASH_URL.username || undefined,
    password: UPSTASH_URL.password ? decodeURIComponent(UPSTASH_URL.password) : undefined,
    tls: redisTLS
  });
  
  // Delete all threads:* keys so everyone gets fresh data with new avatars
  let cursor = '0';
  let deleted = 0;
  do {
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', 'threads:*', 'COUNT', 100);
    cursor = nextCursor;
    
    if (keys && keys.length > 0) {
      await client.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== '0');
  
  console.log(`✅ Invalidated ${deleted} threads cache key(s) in Redis`);
  client.disconnect();
}

main().catch(console.error);
