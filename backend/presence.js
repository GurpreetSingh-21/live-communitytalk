// backend/presence.js
// In-memory presence tracker (per Node process).
// ⚠️ If you scale to multiple Node instances, back this with Redis or another shared store.

const socketsByUser = new Map();      // userId -> Set<socketId>
const communitiesByUser = new Map();  // userId -> Set<communityId>
const lastSeen = new Map();           // userId -> Date

/* ───────────────────────── Helpers ───────────────────────── */
const toId = (v) => (v == null ? "" : String(v));
const toSet = (iterable) => {
  const s = new Set();
  if (Array.isArray(iterable)) for (const x of iterable) s.add(toId(x));
  return s;
};

/* ───────────────────────── Core API ───────────────────────── */

/**
 * Register a new socket connection.
 * Optionally associate the user with communities (array).
 */
function connect(userId, socketId, communities = []) {
  userId = toId(userId);
  socketId = toId(socketId);
  if (!userId || !socketId) return;

  // Track sockets
  const sockSet = socketsByUser.get(userId) || new Set();
  sockSet.add(socketId);
  socketsByUser.set(userId, sockSet);

  // Track communities (optional initial list)
  if (communities && communities.length) {
    const commSet = communitiesByUser.get(userId) || new Set();
    for (const cid of communities) commSet.add(toId(cid));
    communitiesByUser.set(userId, commSet);
  }

  // User is online → clear last seen
  lastSeen.delete(userId);
}

/**
 * Remove a socket connection. If this was the last socket, user goes offline.
 */
function disconnect(userId, socketId) {
  userId = toId(userId);
  socketId = toId(socketId);
  if (!userId || !socketId) return;

  const sockSet = socketsByUser.get(userId);
  if (sockSet) {
    sockSet.delete(socketId);
    if (sockSet.size === 0) {
      socketsByUser.delete(userId);
      communitiesByUser.delete(userId);
      lastSeen.set(userId, new Date()); // record last seen
    }
  }
}

/**
 * Join a specific community.
 */
function joinCommunity(userId, communityId) {
  userId = toId(userId);
  communityId = toId(communityId);
  if (!userId || !communityId) return;
  const commSet = communitiesByUser.get(userId) || new Set();
  commSet.add(communityId);
  communitiesByUser.set(userId, commSet);
}

/**
 * Leave a specific community.
 */
function leaveCommunity(userId, communityId) {
  userId = toId(userId);
  communityId = toId(communityId);
  if (!userId || !communityId) return;
  const commSet = communitiesByUser.get(userId);
  if (!commSet) return;
  commSet.delete(communityId);
  if (commSet.size === 0) {
    communitiesByUser.delete(userId);
  }
}

/* ───────────────────────── Batch ops ───────────────────────── */

/**
 * Join multiple communities at once.
 */
function joinCommunities(userId, communityIds = []) {
  userId = toId(userId);
  if (!userId || !Array.isArray(communityIds) || communityIds.length === 0) return;
  const commSet = communitiesByUser.get(userId) || new Set();
  for (const cid of communityIds) commSet.add(toId(cid));
  communitiesByUser.set(userId, commSet);
}

/**
 * Leave multiple communities at once.
 */
function leaveCommunities(userId, communityIds = []) {
  userId = toId(userId);
  if (!userId || !Array.isArray(communityIds) || communityIds.length === 0) return;
  const commSet = communitiesByUser.get(userId);
  if (!commSet) return;
  for (const cid of communityIds) commSet.delete(toId(cid));
  if (commSet.size === 0) communitiesByUser.delete(userId);
}

/* ───────────────────────── Queries ───────────────────────── */

function isOnline(userId) {
  userId = toId(userId);
  return socketsByUser.has(userId);
}

function isOnlineInCommunity(userId, communityId) {
  userId = toId(userId);
  communityId = toId(communityId);
  const commSet = communitiesByUser.get(userId);
  return !!(commSet && commSet.has(communityId));
}

function listOnlineUsers() {
  return Array.from(socketsByUser.keys());
}

function listOnlineInCommunity(communityId) {
  communityId = toId(communityId);
  const online = [];
  for (const [uid, commSet] of communitiesByUser.entries()) {
    if (commSet.has(communityId)) online.push(uid);
  }
  return online;
}

function listCommunitiesForUser(userId) {
  userId = toId(userId);
  const set = communitiesByUser.get(userId);
  return set ? Array.from(set) : [];
}

function socketsForUser(userId) {
  userId = toId(userId);
  const set = socketsByUser.get(userId);
  return set ? Array.from(set) : [];
}

function countOnline() {
  return socketsByUser.size;
}

function getLastSeen(userId) {
  userId = toId(userId);
  return isOnline(userId) ? null : lastSeen.get(userId) || null;
}

/**
 * Touch a user (update last seen timestamp to now without marking offline).
 * Useful when you want to record activity without disconnecting.
 */
function touch(userId) {
  userId = toId(userId);
  if (!userId) return;
  if (!isOnline(userId)) lastSeen.set(userId, new Date());
}

/* ───────────────────────── Admin / Debug ───────────────────────── */

/**
 * Clear all in-memory presence (useful on dev hot reload).
 */
function reset() {
  socketsByUser.clear();
  communitiesByUser.clear();
  lastSeen.clear();
}

/**
 * Quick summary for dashboards/logging.
 */
function summary() {
  return {
    totalOnlineUsers: socketsByUser.size,
    usersWithCommunities: communitiesByUser.size,
    lastSeenTracked: lastSeen.size,
  };
}

/**
 * Export a shallow snapshot of current presence state (debug only).
 */
function snapshot() {
  const users = Array.from(socketsByUser.keys());
  return {
    users,
    socketsByUser: users.reduce((acc, uid) => {
      acc[uid] = Array.from(socketsByUser.get(uid) || []);
      return acc;
    }, {}),
    communitiesByUser: users.reduce((acc, uid) => {
      acc[uid] = Array.from(communitiesByUser.get(uid) || []);
      return acc;
    }, {}),
  };
}

/* ───────────────────────── Public API ───────────────────────── */

module.exports = {
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
  socketsForUser,
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