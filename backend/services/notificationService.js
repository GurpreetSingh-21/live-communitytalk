// backend/services/notificationService.js
const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
const expo = new Expo();

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
    console.log('[Notifications] No users to notify');
    return { successCount: 0, failureCount: 0, tickets: [] };
  }

  // Collect all valid Expo push tokens
  const messages = [];
  let totalTokens = 0;
  let invalidTokens = 0;

  for (let user of users) {
    if (!user.pushTokens || user.pushTokens.length === 0) {
      continue;
    }

    for (let pushToken of user.pushTokens) {
      totalTokens++;

      // Check if the token is a valid Expo push token
      if (!Expo.isExpoPushToken(pushToken)) {
        console.warn(`[Notifications] Invalid Expo token: ${pushToken}`);
        invalidTokens++;
        continue;
      }

      // Construct the message
      messages.push({
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
        priority: 'high',
        channelId: 'default',
      });
    }
  }

  console.log(`[Notifications] Prepared ${messages.length} messages for ${users.length} users (${totalTokens} total tokens, ${invalidTokens} invalid)`);

  if (messages.length === 0) {
    console.log('[Notifications] No valid tokens to send to');
    return { successCount: 0, failureCount: invalidTokens, tickets: [] };
  }

  // The Expo push notification service accepts batches of notifications
  // Chunk the messages for efficient delivery
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  let successCount = 0;
  let failureCount = invalidTokens;

  // Send each chunk
  for (let chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);

      // Count successes and failures
      ticketChunk.forEach((ticket) => {
        if (ticket.status === 'ok') {
          successCount++;
        } else {
          failureCount++;
          console.error('[Notifications] Ticket error:', ticket);
        }
      });
    } catch (error) {
      console.error('[Notifications] Error sending chunk:', error);
      failureCount += chunk.length;
    }
  }

  console.log(`[Notifications] Results: ${successCount} success, ${failureCount} failure`);

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
    title: 'Test Notification 🚀',
    body: 'If you see this, your push notifications are working!',
    data: {
      type: 'test',
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = {
  sendPushNotifications,
  sendPushNotificationToUser,
  sendTestNotification,
};