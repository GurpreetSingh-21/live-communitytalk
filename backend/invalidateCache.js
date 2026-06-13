require('dotenv').config();
const ioredis = require('ioredis');

async function main() {
  const client = new ioredis(process.env.REDIS_URL);
  
  // Delete all threads:* keys so everyone gets fresh data with new avatars
  let cursor = '0';
  let deleted = 0;
  do {
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', 'threads:*', 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await client.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== '0');
  
  console.log(`✅ Invalidated ${deleted} threads cache key(s) in Redis`);
  client.disconnect();
}

main().catch(console.error);
