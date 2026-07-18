// backend/scratch/clear-redis.js
const Redis = require('ioredis');

async function main() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log(`Connecting to Redis via ioredis at: ${redisUrl}`);
  
  const client = new Redis(redisUrl);
  
  console.log("🧹 Flushing all keys from Redis...");
  await client.flushall();
  console.log("✅ Redis successfully flushed!");
  
  await client.disconnect();
}

main().catch(console.error);
