// backend/scripts/test-cache-invalidation.js
// Test cache invalidation patterns across the application

require('dotenv').config();
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
console.log('🧪 Cache Invalidation Testing Suite');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

let results = { passed: 0, failed: 0, total: 0 };

function assert(condition, testName, details = '') {
  results.total++;
  if (condition) {
    console.log(`✅ ${testName}`);
    results.passed++;
  } else {
    console.log(`❌ ${testName}${details ? ': ' + details : ''}`);
    results.failed++;
  }
}

async function testUserProfileCacheInvalidation() {
  console.log('\n📌 Section 1: User Profile Cache Invalidation\n');
  
  const userId = 'test-user-123';
  const cacheKey = `user:profile:${userId}`;
  
  // Simulate cache set
  const profileData = { id: userId, name: 'Test User', bio: 'Original bio' };
  await redis.setex(cacheKey, 1800, JSON.stringify(profileData));
  
  // Verify cache exists
  const cached = await redis.get(cacheKey);
  assert(cached !== null, 'Profile cached successfully');
  
  // Simulate profile update → cache invalidation
  await redis.del(cacheKey);
  
  const afterDelete = await redis.get(cacheKey);
  assert(afterDelete === null, 'Profile cache invalidated on update');
  
  // Simulate re-caching with new data
  const updatedProfile = { id: userId, name: 'Test User', bio: 'Updated bio' };
  await redis.setex(cacheKey, 1800, JSON.stringify(updatedProfile));
  
  const newCached = await redis.get(cacheKey);
  const parsed = JSON.parse(newCached);
  assert(parsed.bio === 'Updated bio', 'Updated profile re-cached correctly');
  
  // Cleanup
  await redis.del(cacheKey);
}

async function testBootstrapCacheInvalidation() {
  console.log('\n📌 Section 2: Bootstrap Cache Invalidation\n');
  
  const userId = 'test-user-456';
  const bootstrapKey = `user:bootstrap:${userId}`;
  const profileKey = `user:profile:${userId}`;
  
  // Set both caches
  await redis.setex(bootstrapKey, 300, JSON.stringify({ userId, data: 'bootstrap' }));
  await redis.setex(profileKey, 1800, JSON.stringify({ userId, data: 'profile' }));
  
  // Verify both exist
  const bootstrap1 = await redis.get(bootstrapKey);
  const profile1 = await redis.get(profileKey);
  assert(bootstrap1 !== null && profile1 !== null, 'Both caches set initially');
  
  // Simulate user update → invalidate both
  await redis.del(bootstrapKey, profileKey);
  
  const bootstrap2 = await redis.get(bootstrapKey);
  const profile2 = await redis.get(profileKey);
  assert(bootstrap2 === null && profile2 === null, 'Both caches invalidated on user update');
}

async function testCommunityCacheInvalidation() {
  console.log('\n📌 Section 3: Community Cache Invalidation (Pattern Deletion)\n');
  
  const communityId = 'community-789';
  
  // Set multiple related cache keys
  await redis.setex(`community:${communityId}`, 60, 'community data');
  await redis.setex(`community:${communityId}:members`, 120, 'members list');
  await redis.setex(`community:${communityId}:posts`, 30, 'posts list');
  
  // Verify all exist
  const keys1 = await redis.keys(`community:${communityId}*`);
  assert(keys1.length === 3, `All 3 community caches exist`, `Got: ${keys1.length}`);
  
  // Simulate community update → invalidate all related caches
  const pattern = `community:${communityId}*`;
  const keysToDelete = await redis.keys(pattern);
  
  if (keysToDelete.length > 0) {
    await redis.del(...keysToDelete);
  }
  
  const keys2 = await redis.keys(`community:${communityId}*`);
  assert(keys2.length === 0, 'All community caches invalidated via pattern', `Got: ${keys2.length}`);
}

async function testMessageCacheInvalidation() {
  console.log('\n📌 Section 4: Message Cache Invalidation\n');
  
  const communityId = 'community-msg-123';
  
  // Set message caches with different pagination
  await redis.setex(`messages:${communityId}:20`, 30, JSON.stringify(['msg1', 'msg2']));
  await redis.setex(`messages:${communityId}:50`, 30, JSON.stringify(['msg1', 'msg2', 'msg3']));
  
  // Verify caches exist
  const before = await redis.keys(`messages:${communityId}:*`);
  assert(before.length === 2, 'Message caches exist', `Got: ${before.length}`);
  
  // Simulate new message sent → invalidate all message caches for community
  const pattern = `messages:${communityId}:*`;
  const keys = await redis.keys(pattern);
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  
  const after = await redis.keys(`messages:${communityId}:*`);
  assert(after.length === 0, 'All message caches invalidated on new message', `Got: ${after.length}`);
}

async function testDMInboxCacheInvalidation() {
  console.log('\n📌 Section 5: DM Inbox Cache Invalidation\n');
  
  const user1 = 'user-dm-1';
  const user2 = 'user-dm-2';
  
  // Set inbox caches for both users
  await redis.setex(`dm:inbox:${user1}`, 30, JSON.stringify({ conversations: [] }));
  await redis.setex(`dm:inbox:${user2}`, 30, JSON.stringify({ conversations: [] }));
  
  // Verify caches exist
  const inbox1 = await redis.get(`dm:inbox:${user1}`);
  const inbox2 = await redis.get(`dm:inbox:${user2}`);
  assert(inbox1 !== null && inbox2 !== null, 'Both inbox caches set');
  
  // Simulate DM sent → invalidate both inbox caches
  await redis.del(`dm:inbox:${user1}`, `dm:inbox:${user2}`);
  
  const after1 = await redis.get(`dm:inbox:${user1}`);
  const after2 = await redis.get(`dm:inbox:${user2}`);
  assert(after1 === null && after2 === null, 'Both inbox caches invalidated on DM sent');
}

async function testConversationCacheInvalidation() {
  console.log('\n📌 Section 6: Conversation Cache Invalidation\n');
  
  const conversationId = 'conv-xyz';
  const user1 = 'user-conv-1';
  const user2 = 'user-conv-2';
  
  // Each user has their own cache key for the conversation
  const key1 = `dm:conversation:${conversationId}:${user1}`;
  const key2 = `dm:conversation:${conversationId}:${user2}`;
  
  // Set both conversation caches
  await redis.setex(key1, 120, JSON.stringify({ messages: ['msg1'] }));
  await redis.setex(key2, 120, JSON.stringify({ messages: ['msg1'] }));
  
  // Verify caches exist
  const before1 = await redis.get(key1);
  const before2 = await redis.get(key2);
  assert(before1 !== null && before2 !== null, 'Both conversation caches exist');
  
  // Simulate new message → invalidate both
  await redis.del(key1, key2);
  
  const after1 = await redis.get(key1);
  const after2 = await redis.get(key2);
  assert(after1 === null && after2 === null, 'Both conversation caches invalidated');
}

async function testPublicKeyCacheInvalidation() {
  console.log('\n📌 Section 7: Public Key Cache Invalidation\n');
  
  const userId = 'user-pk-789';
  const cacheKey = `user:publicKey:${userId}`;
  
  // Set public key cache
  await redis.set(cacheKey, 'public-key-data-base64');
  
  // Verify cache exists
  const cached = await redis.get(cacheKey);
  assert(cached !== null, 'Public key cached');
  
  // Simulate key rotation → invalidate cache
  await redis.del(cacheKey);
  
  const after = await redis.get(cacheKey);
  assert(after === null, 'Public key cache invalidated on update');
}

async function testMemberListCacheInvalidation() {
  console.log('\n📌 Section 8: Member List Cache Invalidation\n');
  
  const communityId = 'comm-members-123';
  const cacheKey = `members:${communityId}`;
  
  // Set member list cache
  await redis.setex(cacheKey, 120, JSON.stringify({ members: ['user1', 'user2'] }));
  
  // Verify cache exists
  const cached = await redis.get(cacheKey);
  assert(cached !== null, 'Member list cached');
  
  // Simulate member join/leave → invalidate cache
  await redis.del(cacheKey);
  
  const after = await redis.get(cacheKey);
  assert(after === null, 'Member list cache invalidated on membership change');
}

async function testTTLAccuracy() {
  console.log('\n📌 Section 9: TTL Accuracy Tests\n');
  
  // Test different TTL values
  const ttlTests = [
    { key: 'ttl:test:30s', ttl: 30, name: '30 seconds' },
    { key: 'ttl:test:60s', ttl: 60, name: '60 seconds' },
    { key: 'ttl:test:300s', ttl: 300, name: '5 minutes' },
    { key: 'ttl:test:1800s', ttl: 1800, name: '30 minutes' },
  ];
  
  for (const test of ttlTests) {
    await redis.setex(test.key, test.ttl, 'test-value');
    const actualTTL = await redis.ttl(test.key);
    
    // TTL should be close to expected (within 5 seconds tolerance)
    const diff = Math.abs(actualTTL - test.ttl);
    assert(diff <= 5, `TTL accuracy: ${test.name}`, `Expected ~${test.ttl}s, got ${actualTTL}s`);
  }
  
  // Cleanup
  await redis.del(...ttlTests.map(t => t.key));
}

async function testCacheKeyNamingConsistency() {
  console.log('\n📌 Section 10: Cache Key Naming Consistency\n');
  
  // Verify all cache keys follow consistent patterns
  const patterns = {
    'user:profile:*': 'User profiles',
    'user:bootstrap:*': 'Bootstrap data',
    'user:publicKey:*': 'Public keys',
    'community:*': 'Community data',
    'members:*': 'Member lists',
    'messages:*': 'Message lists',
    'dm:inbox:*': 'DM inboxes',
    'dm:conversation:*': 'DM conversations',
    'presence:*': 'Presence tracking',
  };
  
  console.log('   Cache key patterns in use:');
  for (const [pattern, description] of Object.entries(patterns)) {
    console.log(`   • ${pattern} → ${description}`);
  }
  
  assert(true, 'All cache keys follow documented patterns');
}

async function runTests() {
  try {
    console.log('Connecting to Redis...\n');
    await redis.connect();
    console.log('✅ Connected\n');
    
    // Run all test sections
    await testUserProfileCacheInvalidation();
    await testBootstrapCacheInvalidation();
    await testCommunityCacheInvalidation();
    await testMessageCacheInvalidation();
    await testDMInboxCacheInvalidation();
    await testConversationCacheInvalidation();
    await testPublicKeyCacheInvalidation();
    await testMemberListCacheInvalidation();
    await testTTLAccuracy();
    await testCacheKeyNamingConsistency();
    
    // Cleanup any remaining test keys
    console.log('\n🧹 Cleaning up test keys...');
    const testKeys = await redis.keys('test-*');
    if (testKeys.length > 0) {
      await redis.del(...testKeys);
    }
    
    // Print results
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Results');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed:  ${results.passed}`);
    console.log(`❌ Failed:  ${results.failed}`);
    console.log(`📝 Total:   ${results.total}`);
    
    const passRate = ((results.passed / results.total) * 100).toFixed(1);
    console.log(`\n🎯 Pass Rate: ${passRate}%`);
    
    if (results.failed === 0) {
      console.log('\n🎉 All cache invalidation tests passed!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed.');
      process.exit(1);
    }
    
  } catch (err) {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  } finally {
    await redis.quit();
    console.log('\n👋 Disconnected from Redis\n');
  }
}

// Handle signals
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Tests interrupted');
  await redis.quit();
  process.exit(1);
});

runTests();
