// backend/presence.js
// ⚠️ This module is now backed by Redis and is safe for multi-instance scaling.

let redis;

// We use Hashes for socket counts and Sets for community/online lists
const SOCKET_COUNT_KEY = "presence:user:sockets"; // HASH: { userId -> count }
const ONLINE_USERS_KEY = "presence:users:online"; // SET:  { userId1, userId2, ... }
const COMMUNITY_KEY_PREFIX = "presence:community:"; // SET: (per-community)
const USER_COMMUNITIES_PREFIX = "presence:user:communities:"; // SET: (per-user)

/**
 * Initialize the presence module with a Redis client.
 * @param {object} redisClient - An ioredis client instance
 */
function init(redisClient) {
  if (!redisClient) {
    throw new Error("Presence module requires a Redis client.");
  }
  redis = redisClient;
  console.log("✅ Presence module initialized with Redis.");
}

const toId = (v) => (v == null ? "" : String(v));

/* ───────────────────────── Core API ───────────────────────── */

/**
 * Register a new socket connection.
 * Returns true if this was the user's first connection (i.e., they were offline).
 */
async function connect(userId) {
  userId = toId(userId);
  if (!userId || !redis) return { isFirstConnection: false };

  // Increment the user's socket count
  const count = await redis.hincrby(SOCKET_COUNT_KEY, userId, 1);

  if (count === 1) {
    // This is their first connection
    await redis.sadd(ONLINE_USERS_KEY, userId);
    return { isFirstConnection: true };
  }

  return { isFirstConnection: false };
}

/**
 * Remove a socket connection.
 * Returns true if this was the user's last connection (i.e., they are now offline).
 */
async function disconnect(userId) {
  userId = toId(userId);
  if (!userId || !redis) return { isLastConnection: false };

  // Decrement the user's socket count
  const count = await redis.hincrby(SOCKET_COUNT_KEY, userId, -1);

  if (count <= 0) {
    // This was their last connection
    await redis.hdel(SOCKET_COUNT_KEY, userId); // Clean up hash
    await redis.srem(ONLINE_USERS_KEY, userId); // Remove from online set
    return { isLastConnection: true };
  }

  return { isLastConnection: false };
}

/**
 * Join a specific community.
 */
async function joinCommunity(userId, communityId) {
  userId = toId(userId);
  communityId = toId(communityId);
  if (!userId || !communityId || !redis) return;

  const communityKey = `${COMMUNITY_KEY_PREFIX}${communityId}`;
  const userKey = `${USER_COMMUNITIES_PREFIX}${userId}`;

  await redis
    .pipeline()
    .sadd(communityKey, userId) // Add user to community roster
    .sadd(userKey, communityId) // Add community to user's roster
    .exec();
}

/**
 * Leave a specific community.
 */
async function leaveCommunity(userId, communityId) {
  userId = toId(userId);
  communityId = toId(communityId);
  if (!userId || !communityId || !redis) return;

  const communityKey = `${COMMUNITY_KEY_PREFIX}${communityId}`;
  const userKey = `${USER_COMMUNITIES_PREFIX}${userId}`;

  await redis
    .pipeline()
    .srem(communityKey, userId) // Remove user from community roster
    .srem(userKey, communityId) // Remove community from user's roster
    .exec();
}

/* ───────────────────────── Batch ops ───────────────────────── */

/**
 * Join multiple communities at once.
 */
async function joinCommunities(userId, communityIds = []) {
  userId = toId(userId);
  if (
    !userId ||
    !Array.isArray(communityIds) ||
    communityIds.length === 0 ||
    !redis
  )
    return;

  const userKey = `${USER_COMMUNITIES_PREFIX}${userId}`;
  const pipeline = redis.pipeline();

  const cleanCommunityIds = communityIds.map(toId);
  pipeline.sadd(userKey, ...cleanCommunityIds); // Add all communities to user's roster

  for (const cid of cleanCommunityIds) {
    const communityKey = `${COMMUNITY_KEY_PREFIX}${cid}`;
    pipeline.sadd(communityKey, userId); // Add user to each community roster
  }
  await pipeline.exec();
}

/**
 * Leave multiple communities at once.
 */
async function leaveCommunities(userId, communityIds = []) {
  userId = toId(userId);
  if (
    !userId ||
    !Array.isArray(communityIds) ||
    communityIds.length === 0 ||
    !redis
  )
    return;

  const userKey = `${USER_COMMUNITIES_PREFIX}${userId}`;
  const pipeline = redis.pipeline();

  const cleanCommunityIds = communityIds.map(toId);
  pipeline.srem(userKey, ...cleanCommunityIds); // Remove all communities from user's roster

  for (const cid of cleanCommunityIds) {
    const communityKey = `${COMMUNITY_KEY_PREFIX}${cid}`;
    pipeline.srem(communityKey, userId); // Remove user from each community roster
  }
  await pipeline.exec();
}

/* ───────────────────────── Queries ───────────────────────── */

async function isOnline(userId) {
  userId = toId(userId);
  if (!userId || !redis) return false;
  return (await redis.sismember(ONLINE_USERS_KEY, userId)) === 1;
}

async function isOnlineInCommunity(userId, communityId) {
  userId = toId(userId);
  communityId = toId(communityId);
  if (!userId || !communityId || !redis) return false;

  const key = `${COMMUNITY_KEY_PREFIX}${communityId}`;
  return (await redis.sismember(key, userId)) === 1;
}

async function listOnlineUsers() {
  if (!redis) return [];
  return await redis.smembers(ONLINE_USERS_KEY);
}

async function listOnlineInCommunity(communityId) {
  communityId = toId(communityId);
  if (!communityId || !redis) return [];

  const key = `${COMMUNITY_KEY_PREFIX}${communityId}`;
  return await redis.smembers(key);
}

async function listCommunitiesForUser(userId) {
  userId = toId(userId);
  if (!userId || !redis) return [];

  const userKey = `${USER_COMMUNITIES_PREFIX}${userId}`;
  return await redis.smembers(userKey);
}

async function countOnline() {
  if (!redis) return 0;
  return await redis.scard(ONLINE_USERS_KEY);
}

// These functions are no longer relevant in a distributed model
// as we don't track individual sockets, only user counts.
// We keep the exports for API compatibility where possible.
async function getLastSeen(userId) {
  userId = toId(userId);
  if (!redis) return null;
  // This is a proxy. If not online, they were "last seen" when they disconnected.
  // For a true "last seen" timestamp, you'd add another HSET on disconnect.
  const online = await isOnline(userId);
  return online ? null : new Date(); // Cannot get historical data from this model
}

async function touch(userId) {
  // In this model, "touching" is implicit. As long as they are connected,
  // they are online. If you need idle tracking, that's a separate
  // mechanism you'd build on top (e.g., using EXPIRE on user keys).
  return;
}

async function socketsForUser(userId) {
  // We no longer track individual socket IDs, only the *count*.
  // Return count for partial compatibility.
  userId = toId(userId);
  if (!redis) return 0;
  const count = await redis.hget(SOCKET_COUNT_KEY, userId);
  return Number(count) || 0;
}

/* ───────────────────────── Admin / Debug ───────────────────────── */

/**
 * Clear all in-memory presence (dev only).
 * NOTE: This clears the *entire* Redis presence state.
 */
async function reset() {
  if (!redis) return;
  console.warn("⚠️ Resetting all presence state in Redis...");
  const keys = await redis.keys("presence:*");
  if (keys && keys.length) {
    await redis.del(keys);
  }
}

/**
 * Quick summary for dashboards/logging.
 */
async function summary() {
  if (!redis) return { totalOnlineUsers: 0 };
  const totalOnlineUsers = await countOnline();
  return {
    totalOnlineUsers,
  };
}

/**
 * Export a shallow snapshot of current presence state (debug only).
 */
async function snapshot() {
  if (!redis) return { users: [], communities: {} };

  const users = await listOnlineUsers();
  const communities = {};

  for (const uid of users) {
    communities[uid] = await listCommunitiesForUser(uid);
  }

  return {
    users,
    communitiesByUser: communities,
  };
}

/* ───────────────────────── Public API ───────────────────────── */

module.exports = {
  // NEW: Init function must be called
  init,

  // Core
  connect,
  disconnect,
  joinCommunity,
  leaveCommunity,

  // Batch
  joinCommunities,
  leaveCommunities,

  // Queries
  isOnline,
  isOnlineInCommunity,
  listOnlineUsers,
  listOnlineInCommunity,
  listCommunitiesForUser,
  socketsForUser, // Note: Returns count, not socket IDs
  countOnline,
  getLastSeen,
  touch,

  // Admin / Debug
  reset,
  summary,
  snapshot,

  // Back-compat alias
  getAllOnline: listOnlineUsers,
};
