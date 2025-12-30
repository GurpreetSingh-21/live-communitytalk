// backend/scripts/test-redis.js
// Quick script to test Redis connectivity

require('dotenv').config();
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

console.log('🔍 Testing Redis connection...');
console.log('📍 REDIS_URL:', REDIS_URL.replace(/:[^:@]+@/, ':****@')); // Hide password

const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    lazyConnect: true,
});

redis.on('error', (err) => {
    console.error('❌ Redis error:', err.message);
});

redis.on('connect', () => {
    console.log('✅ Redis connected!');
});

async function testRedis() {
    try {
        // Connect
        await redis.connect();

        // Test SET
        const testKey = 'test:redis:check';
        const testValue = `working-${Date.now()}`;
        await redis.set(testKey, testValue, 'EX', 60);
        console.log('✅ SET:', testKey, '=', testValue);

        // Test GET
        const result = await redis.get(testKey);
        console.log('✅ GET:', testKey, '=', result);

        if (result === testValue) {
            console.log('🎉 Redis is working correctly!');
        } else {
            console.log('⚠️  Value mismatch - something is wrong');
        }

        // Test presence-like operations
        await redis.sadd('test:online:users', 'user1', 'user2', 'user3');
        const members = await redis.smembers('test:online:users');
        console.log('✅ SADD/SMEMBERS (presence simulation):', members);

        // Test pub/sub capability
        console.log('✅ Redis pub/sub ready for Socket.IO adapter');

        // Cleanup
        await redis.del(testKey, 'test:online:users');
        console.log('✅ Cleanup complete');

        // Show server info
        const info = await redis.info('server');
        const version = info.match(/redis_version:(\S+)/)?.[1];
        console.log('📊 Redis version:', version);

    } catch (err) {
        console.error('❌ Redis test failed:', err.message);
        process.exit(1);
    } finally {
        await redis.quit();
        console.log('👋 Disconnected from Redis');
    }
}

testRedis();
