// backend/routes/reactionRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const authenticate = require("../middleware/authenticate");

router.use(authenticate);

/* ---------------------- Community Message Reactions ---------------------- */

// POST /api/reactions/messages/:messageId
router.post("/messages/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;
    const userName = req.user.fullName || req.user.email;

    if (!emoji || typeof emoji !== "string") {
      return res.status(400).json({ error: "Emoji is required" });
    }

    const message = await prisma.message.findUnique({
        where: { id: messageId }
    });
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check existing
    const existing = await prisma.reaction.findFirst({
        where: {
            messageId,
            userId,
            emoji
        }
    });

    if (existing) {
      return res.status(400).json({ error: "Already reacted with this emoji" });
    }

    // Create reaction
    const reaction = await prisma.reaction.create({
        data: {
            emoji,
            messageId,
            userId
        }
    });

    // Populate user/message? No, we just need payload.
    // Frontend expects { emoji, userId, userName, createdAt }
    // We can return the created reaction + userName from helper
    
    const reactionPayload = {
        emoji: reaction.emoji,
        userId: reaction.userId,
        userName: userName, // Pass from Auth context
        createdAt: reaction.createdAt
    };

    req.io?.to(`community:${message.communityId}`).emit("reaction:added", {
      messageId,
      reaction: reactionPayload
    });

    return res.status(201).json({
      message: "Reaction added",
      reaction: reactionPayload
    });
  } catch (err) {
    console.error("💥 POST /api/reactions/messages/:messageId ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/reactions/messages/:messageId/:emoji
router.delete("/messages/:messageId/:emoji", async (req, res) => {
  try {
    const { messageId, emoji } = req.params;
    const userId = req.user.id;

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    const decodedEmoji = decodeURIComponent(emoji);

    const result = await prisma.reaction.deleteMany({
        where: {
            messageId,
            userId,
            emoji: decodedEmoji
        }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Reaction not found" });
    }

    // Emit real-time reaction removal event
    req.io?.to(`community:${message.communityId}`).emit("reaction:removed", {
      messageId,
      emoji: decodedEmoji,
      userId
    });

    return res.json({ message: "Reaction removed" });
  } catch (err) {
    console.error("💥 DELETE /api/reactions/messages/:messageId/:emoji ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------------------- Direct Message Reactions ---------------------- */

// POST /api/reactions/dm/:messageId
router.post("/dm/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;
    const userName = req.user.fullName || req.user.email;

    if (!emoji || typeof emoji !== "string") {
      return res.status(400).json({ error: "Emoji is required" });
    }

    const message = await prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Ensure user is part of the conversation
    const isParticipant = (message.fromId === userId || message.toId === userId);
    if (!isParticipant) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Check existing
    const existing = await prisma.directMessageReaction.findFirst({
        where: {
            dmId: messageId,
            userId,
            emoji
        }
    });

    if (existing) {
      return res.status(400).json({ error: "Already reacted with this emoji" });
    }

    const reaction = await prisma.directMessageReaction.create({
        data: {
            emoji,
            dmId: messageId,
            userId
        }
    });
    
    const reactionPayload = {
        emoji: reaction.emoji,
        userId: reaction.userId,
        userName,
        createdAt: reaction.createdAt
    };

    // Emit real-time reaction event to both participants
    const otherUserId = message.fromId === userId ? message.toId : message.fromId;
    req.io?.to(userId).to(otherUserId).emit("dm:reaction:added", {
      messageId,
      reaction: reactionPayload
    });

    return res.status(201).json({
      message: "Reaction added",
      reaction: reactionPayload
    });
  } catch (err) {
    console.error("💥 POST /api/reactions/dm/:messageId ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/reactions/dm/:messageId/:emoji
router.delete("/dm/:messageId/:emoji", async (req, res) => {
  try {
    const { messageId, emoji } = req.params;
    const userId = req.user.id;

    const message = await prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Ensure user is part of the conversation
    const isParticipant = (message.fromId === userId || message.toId === userId);
    if (!isParticipant) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    const decodedEmoji = decodeURIComponent(emoji);

    // Find and remove reaction
    const result = await prisma.directMessageReaction.deleteMany({
        where: {
            dmId: messageId,
            userId,
            emoji: decodedEmoji
        }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Reaction not found" });
    }

    // Emit real-time reaction removal event
    const otherUserId = message.fromId === userId ? message.toId : message.fromId;
    req.io?.to(userId).to(otherUserId).emit("dm:reaction:removed", {
      messageId,
      emoji: decodedEmoji,
      userId
    });

    return res.json({ message: "Reaction removed" });
  } catch (err) {
    console.error("💥 DELETE /api/reactions/dm/:messageId/:emoji ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
