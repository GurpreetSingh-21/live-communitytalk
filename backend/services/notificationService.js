// backend/services/notificationService.js
const { Expo } = require("expo-server-sdk");

// Create a new Expo SDK client (server side)
const expo = new Expo();

/**
 * If you ever want to read allowed experience from env, use this.
 * For now your project is: @debugdragons4/community-talk
 */
const ALLOWED_EXPERIENCE = process.env.EXPO_ALLOWED_EXPERIENCE || "@debugdragons4/campustry-debugdragons";

/**
 * Tokens we already saw in the logs that belong to ANOTHER Expo project
 * (the ones that caused PUSH_TOO_MANY_EXPERIENCE_IDS).
 * If you see new ones in the error, just add them here.
 */
const BLOCKED_TOKENS = new Set([
  // from earlier errors
  "ExponentPushToken[H6YaRvHni1SJk32XsUu-vc]",
  "ExponentPushToken[peNJBBH2GbenLX0OOtNOaC]",
  "ExponentPushToken[6R77fvHAhjIQLBIa1JUvsT]",
  "ExponentPushToken[STJTLgEf83MzeSi357VERL]",
  // keep adding if backend prints more
]);

/**
 * Send push notifications to multiple users
 * @param {Array} users - Array of user objects with pushTokens
 * @param {Object} notificationData - Notification content
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.body - Notification body
 * @param {Object} notificationData.data - Additional data to send
 * @returns {Promise<Object>} Result with success/failure counts
 */
async function sendPushNotifications(users, notificationData) {
  const { title, body, data = {} } = notificationData;

  if (!users || users.length === 0) {
    console.log("[Notifications] No users to notify");
    return { successCount: 0, failureCount: 0, tickets: [] };
  }

  const messages = [];
  let totalTokens = 0;
  let invalidTokens = 0;
  let blockedTokens = 0;

  for (const user of users) {
    if (!user.pushTokens || user.pushTokens.length === 0) {
      continue;
    }

    for (const pushToken of user.pushTokens) {
      totalTokens++;

      // 1) skip tokens we already know belong to someone else's Expo project
      if (BLOCKED_TOKENS.has(pushToken)) {
        blockedTokens++;
        console.log("[Notifications] ⛔ blocked known foreign token:", pushToken);
        continue;
      }

      // 2) validate Expo token format
      if (!Expo.isExpoPushToken(pushToken)) {
        console.warn("[Notifications] Invalid Expo token:", pushToken);
        invalidTokens++;
        continue;
      }

      // 3) build the message – we can also tag our experience here
      messages.push({
        to: pushToken,
        sound: "default",
        title,
        body,
        data: {
          ...data,
          experienceName: ALLOWED_EXPERIENCE, // helps you see which project it’s for
        },
        priority: "high",
        channelId: "default",
      });
    }
  }

  console.log(
    `[Notifications] Prepared ${messages.length} messages for ${users.length} users (${totalTokens} total tokens, ${invalidTokens} invalid, ${blockedTokens} blocked)`
  );

  if (messages.length === 0) {
    console.log("[Notifications] No valid tokens to send to");
    return {
      successCount: 0,
      failureCount: invalidTokens + blockedTokens,
      tickets: [],
    };
  }

  // Expo wants batched chunks
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  let successCount = 0;
  let failureCount = invalidTokens + blockedTokens;

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);

      ticketChunk.forEach((ticket) => {
        if (ticket.status === "ok") {
          successCount++;
        } else {
          failureCount++;
          console.error("[Notifications] Ticket error:", ticket);
        }
      });
    } catch (error) {
      console.error("[Notifications] Error sending chunk:", error);
      // if a whole chunk fails, count all of them as failed
      failureCount += chunk.length;
    }
  }

  console.log(
    `[Notifications] Results: ${successCount} success, ${failureCount} failure`
  );

  return {
    successCount,
    failureCount,
    tickets,
  };
}

/**
 * Send a notification to a single user
 * @param {Object} user - User object with pushTokens
 * @param {Object} notificationData - Notification content
 * @returns {Promise<Object>} Result with success/failure counts
 */
async function sendPushNotificationToUser(user, notificationData) {
  return sendPushNotifications([user], notificationData);
}

/**
 * Send a test notification
 * @param {Object} user - User object with pushTokens
 * @returns {Promise<Object>} Result with success/failure counts
 */
async function sendTestNotification(user) {
  return sendPushNotificationToUser(user, {
    title: "Test Notification 🚀",
    body: "If you see this, your push notifications are working!",
    data: {
      type: "test",
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = {
  sendPushNotifications,
  sendPushNotificationToUser,
  sendTestNotification,
};