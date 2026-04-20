// backend/scripts/test-redis-advanced.js
// Comprehensive Redis testing script for senior-level validation

require('dotenv').config();
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
console.log('🔍 Advanced Redis Testing Suite');
console.log('📍 REDIS_URL:', REDIS_URL.replace(/:[^:@]+@/, ':****@'));

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  lazyConnect: true,
});

let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function logTest(name, status, details = '') {
  const symbols = { pass: '✅', fail: '❌', warn: '⚠️' };
  console.log(`${symbols[status]} ${name}${details ? ': ' + details : ''}`);
  
  testResults.tests.push({ name, status, details });
  if (status === 'pass') testResults.passed++;
  else if (status === 'fail') testResults.failed++;
  else testResults.warnings++;
}

async function testBasicOperations() {
  console.log('\n━━━ 1. Basic Operations ━━━');
  
  try {
    // SET/GET
    await redis.set('test:basic', 'value123');
    const val = await redis.get('test:basic');
    if (val === 'value123') {
      logTest('Basic SET/GET', 'pass');
    } else {
      logTest('Basic SET/GET', 'fail', `Expected 'value123', got '${val}'`);
    }
    
    // SETEX with TTL
    await redis.setex('test:ttl', 5, 'expires-soon');
    const ttl = await redis.ttl('test:ttl');
    if (ttl > 0 && ttl <= 5) {
      logTest('SETEX with TTL', 'pass', `TTL: ${ttl}s`);
    } else {
      logTest('SETEX with TTL', 'fail', `Invalid TTL: ${ttl}`);
    }
    
    // DEL
    const deleted = await redis.del('test:basic');
    if (deleted === 1) {
      logTest('DEL operation', 'pass');
    } else {
      logTest('DEL operation', 'fail', `Expected 1 deleted, got ${deleted}`);
    }
    
    // Cleanup
    await redis.del('test:ttl');
  } catch (err) {
    logTest('Basic Operations', 'fail', err.message);
  }
}

async function testCachePatterns() {
  console.log('\n━━━ 2. Cache Pattern Tests ━━━');
  
  const cachePatterns = [
    { key: 'user:profile:test123', ttl: 1800, type: 'User Profile' },
    { key: 'user:bootstrap:test123', ttl: 300, type: 'Bootstrap Data' },
    { key: 'community:test456', ttl: 60, type: 'Community Data' },
    { key: 'dm:inbox:test123', ttl: 30, type: 'DM Inbox' },
    { key: 'members:test456', ttl: 120, type: 'Member List' },
    { key: 'messages:test456:20', ttl: 30, type: 'Message List' },
  ];
  
  try {
    for (const pattern of cachePatterns) {
      const testData = { id: pattern.key, timestamp: Date.now() };
      
      // Set cache
      await redis.setex(pattern.key, pattern.ttl, JSON.stringify(testData));
      
      // Get cache
      const cached = await redis.get(pattern.key);
      const parsed = JSON.parse(cached);
      
      if (parsed.id === pattern.key) {
        logTest(`Cache: ${pattern.type}`, 'pass', `TTL: ${pattern.ttl}s`);
      } else {
        logTest(`Cache: ${pattern.type}`, 'fail', 'Data mismatch');
      }
    }
    
    // Cleanup
    const keys = cachePatterns.map(p => p.key);
    await redis.del(...keys);
  } catch (err) {
    logTest('Cache Patterns', 'fail', err.message);
  }
}

async function testPresenceSystem() {
  console.log('\n━━━ 3. Presence System Tests ━━━');
  
  const testUserId = 'test-user-12345';
  const testCommunityId = 'test-community-67890';
  
  try {
    // Clean up any existing test data
    await redis.hdel('presence:user:sockets', testUserId);
    await redis.srem('presence:users:online', testUserId);
    await redis.del(`presence:user:communities:${testUserId}`);
    await redis.del(`presence:community:${testCommunityId}`);
    
    // Test 1: First connection
    const count1 = await redis.hincrby('presence:user:sockets', testUserId, 1);
    if (count1 === 1) {
      await redis.sadd('presence:users:online', testUserId);
      logTest('Presence: First connection (count=1)', 'pass');
    } else {
      logTest('Presence: First connection', 'fail', `Expected count=1, got ${count1}`);
    }
    
    // Test 2: Second connection (same user)
    const count2 = await redis.hincrby('presence:user:sockets', testUserId, 1);
    if (count2 === 2) {
      logTest('Presence: Second connection (count=2)', 'pass');
    } else {
      logTest('Presence: Second connection', 'fail', `Expected count=2, got ${count2}`);
    }
    
    // Test 3: Check if online
    const isOnline = await redis.sismember('presence:users:online', testUserId);
    if (isOnline === 1) {
      logTest('Presence: User is online check', 'pass');
    } else {
      logTest('Presence: User is online check', 'fail');
    }
    
    // Test 4: Join community
    await redis.sadd(`presence:community:${testCommunityId}`, testUserId);
    await redis.sadd(`presence:user:communities:${testUserId}`, testCommunityId);
    
    const inCommunity = await redis.sismember(`presence:community:${testCommunityId}`, testUserId);
    if (inCommunity === 1) {
      logTest('Presence: Join community', 'pass');
    } else {
      logTest('Presence: Join community', 'fail');
    }
    
    // Test 5: List communities for user
    const userCommunities = await redis.smembers(`presence:user:communities:${testUserId}`);
    if (userCommunities.includes(testCommunityId)) {
      logTest('Presence: List user communities', 'pass', `Found ${userCommunities.length}`);
    } else {
      logTest('Presence: List user communities', 'fail');
    }
    
    // Test 6: List users in community
    const communityUsers = await redis.smembers(`presence:community:${testCommunityId}`);
    if (communityUsers.includes(testUserId)) {
      logTest('Presence: List community users', 'pass', `Found ${communityUsers.length}`);
    } else {
      logTest('Presence: List community users', 'fail');
    }
    
    // Test 7: First disconnect (still has 1 socket)
    const count3 = await redis.hincrby('presence:user:sockets', testUserId, -1);
    if (count3 === 1) {
      logTest('Presence: First disconnect (count=1)', 'pass');
    } else {
      logTest('Presence: First disconnect', 'fail', `Expected count=1, got ${count3}`);
    }
    
    // Test 8: Last disconnect
    const count4 = await redis.hincrby('presence:user:sockets', testUserId, -1);
    if (count4 === 0) {
      await redis.hdel('presence:user:sockets', testUserId);
      await redis.srem('presence:users:online', testUserId);
      logTest('Presence: Last disconnect (count=0)', 'pass');
    } else {
      logTest('Presence: Last disconnect', 'fail', `Expected count=0, got ${count4}`);
    }
    
    // Test 9: User should be offline now
    const stillOnline = await redis.sismember('presence:users:online', testUserId);
    if (stillOnline === 0) {
      logTest('Presence: User offline after all disconnects', 'pass');
    } else {
      logTest('Presence: User offline after all disconnects', 'fail');
    }
    
    // Cleanup
    await redis.del(`presence:user:communities:${testUserId}`);
    await redis.del(`presence:community:${testCommunityId}`);
    
  } catch (err) {
    logTest('Presence System', 'fail', err.message);
  }
}

async function testPipelineOperations() {
  console.log('\n━━━ 4. Pipeline Efficiency Tests ━━━');
  
  try {
    const testKeys = Array.from({ length: 10 }, (_, i) => `test:pipeline:${i}`);
    
    // Test without pipeline
    const startNoPipeline = Date.now();
    for (const key of testKeys) {
      await redis.set(key, 'value');
    }
    const timeNoPipeline = Date.now() - startNoPipeline;
    
    // Test with pipeline
    const startWithPipeline = Date.now();
    const pipeline = redis.pipeline();
    for (const key of testKeys) {
      pipeline.set(`${key}:pipe`, 'value');
    }
    await pipeline.exec();
    const timeWithPipeline = Date.now() - startWithPipeline;
    
    const improvement = ((timeNoPipeline - timeWithPipeline) / timeNoPipeline * 100).toFixed(1);
    
    if (timeWithPipeline < timeNoPipeline) {
      logTest('Pipeline efficiency', 'pass', `${improvement}% faster (${timeNoPipeline}ms → ${timeWithPipeline}ms)`);
    } else {
      logTest('Pipeline efficiency', 'warn', 'No improvement detected (may be network dependent)');
    }
    
    // Cleanup
    await redis.del(...testKeys, ...testKeys.map(k => `${k}:pipe`));
  } catch (err) {
    logTest('Pipeline Operations', 'fail', err.message);
  }
}

async function testErrorHandling() {
  console.log('\n━━━ 5. Error Handling Tests ━━━');
  
  try {
    // Test JSON parse error handling
    await redis.set('test:invalid-json', '{invalid json}');
    const cached = await redis.get('test:invalid-json');
    
    try {
      JSON.parse(cached);
      logTest('Invalid JSON handling', 'fail', 'Should have thrown error');
    } catch (parseErr) {
      logTest('Invalid JSON handling', 'pass', 'Correctly throws parse error');
    }
    
    // Test non-existent key
    const nonExistent = await redis.get('test:does-not-exist');
    if (nonExistent === null) {
      logTest('Non-existent key returns null', 'pass');
    } else {
      logTest('Non-existent key returns null', 'fail', `Got: ${nonExistent}`);
    }
    
    // Test TTL on non-existent key
    const ttl = await redis.ttl('test:does-not-exist');
    if (ttl === -2) {
      logTest('TTL on non-existent key', 'pass', 'Returns -2');
    } else {
      logTest('TTL on non-existent key', 'warn', `Expected -2, got ${ttl}`);
    }
    
    // Cleanup
    await redis.del('test:invalid-json');
  } catch (err) {
    logTest('Error Handling', 'fail', err.message);
  }
}

async function testPerformance() {
  console.log('\n━━━ 6. Performance Tests ━━━');
  
  try {
    // Test SET latency
    const setIterations = 100;
    const startSet = Date.now();
    for (let i = 0; i < setIterations; i++) {
      await redis.set(`test:perf:${i}`, `value${i}`);
    }
    const avgSetTime = (Date.now() - startSet) / setIterations;
    
    if (avgSetTime < 50) {
      logTest('SET latency', 'pass', `${avgSetTime.toFixed(2)}ms avg`);
    } else {
      logTest('SET latency', 'warn', `${avgSetTime.toFixed(2)}ms avg (higher than expected)`);
    }
    
    // Test GET latency
    const getIterations = 100;
    const startGet = Date.now();
    for (let i = 0; i < getIterations; i++) {
      await redis.get(`test:perf:${i}`);
    }
    const avgGetTime = (Date.now() - startGet) / getIterations;
    
    if (avgGetTime < 50) {
      logTest('GET latency', 'pass', `${avgGetTime.toFixed(2)}ms avg`);
    } else {
      logTest('GET latency', 'warn', `${avgGetTime.toFixed(2)}ms avg (higher than expected)`);
    }
    
    // Cleanup
    const keys = Array.from({ length: setIterations }, (_, i) => `test:perf:${i}`);
    await redis.del(...keys);
  } catch (err) {
    logTest('Performance Tests', 'fail', err.message);
  }
}

async function testRedisInfo() {
  console.log('\n━━━ 7. Redis Server Info ━━━');
  
  try {
    const info = await redis.info('server');
    const version = info.match(/redis_version:(\S+)/)?.[1];
    const mode = info.match(/redis_mode:(\S+)/)?.[1];
    const os = info.match(/os:(\S+)/)?.[1];
    
    console.log(`📊 Redis Version: ${version}`);
    console.log(`📊 Redis Mode: ${mode}`);
    console.log(`📊 OS: ${os}`);
    
    logTest('Redis server info', 'pass', `v${version}`);
    
    // Memory info
    const memInfo = await redis.info('memory');
    const usedMemory = memInfo.match(/used_memory_human:(\S+)/)?.[1];
    const maxMemory = memInfo.match(/maxmemory_human:(\S+)/)?.[1];
    
    console.log(`💾 Used Memory: ${usedMemory}`);
    console.log(`💾 Max Memory: ${maxMemory || 'unlimited'}`);
    
    // Stats info
    const statsInfo = await redis.info('stats');
    const totalConnections = statsInfo.match(/total_connections_received:(\d+)/)?.[1];
    const totalCommands = statsInfo.match(/total_commands_processed:(\d+)/)?.[1];
    
    console.log(`📈 Total Connections: ${totalConnections}`);
    console.log(`📈 Total Commands: ${totalCommands}`);
    
  } catch (err) {
    logTest('Redis Info', 'fail', err.message);
  }
}

async function runAllTests() {
  try {
    console.log('Starting Redis connection...\n');
    await redis.connect();
    console.log('✅ Connected to Redis\n');
    
    await testBasicOperations();
    await testCachePatterns();
    await testPresenceSystem();
    await testPipelineOperations();
    await testErrorHandling();
    await testPerformance();
    await testRedisInfo();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Results Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed:  ${testResults.passed}`);
    console.log(`❌ Failed:  ${testResults.failed}`);
    console.log(`⚠️  Warnings: ${testResults.warnings}`);
    console.log(`📝 Total:   ${testResults.tests.length}`);
    
    const passRate = ((testResults.passed / testResults.tests.length) * 100).toFixed(1);
    console.log(`\n🎯 Pass Rate: ${passRate}%`);
    
    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.tests.filter(t => t.status === 'fail').forEach(t => {
        console.log(`   • ${t.name}: ${t.details}`);
      });
    }
    
    if (testResults.failed === 0) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Review above for details.');
      process.exit(1);
    }
    
  } catch (err) {
    console.error('❌ Test suite failed:', err.message);
    process.exit(1);
  } finally {
    await redis.quit();
    console.log('\n👋 Disconnected from Redis');
  }
}

// Handle signals
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Test interrupted by user');
  await redis.quit();
  process.exit(1);
});

runAllTests();
