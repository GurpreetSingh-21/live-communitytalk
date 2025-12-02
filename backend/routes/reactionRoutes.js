// backend/routes/reactionRoutes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Message = require("../models/Message");
const DirectMessage = require("../models/DirectMessage");
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

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      (r) => String(r.userId) === userId && r.emoji === emoji
    );

    if (existingReaction) {
      return res.status(400).json({ error: "Already reacted with this emoji" });
    }

    // Add reaction
    message.reactions.push({
      emoji,
      userId,
      userName,
      createdAt: new Date()
    });

    await message.save();

    // Emit real-time reaction event
    req.io?.to(`community:${message.communityId}`).emit("reaction:added", {
      messageId,
      reaction: {
        emoji,
        userId,
        userName,
        createdAt: message.reactions[message.reactions.length - 1].createdAt
      }
    });

    return res.status(201).json({
      message: "Reaction added",
      reaction: message.reactions[message.reactions.length - 1]
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

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Find and remove reaction
    const reactionIndex = message.reactions.findIndex(
      (r) => String(r.userId) === userId && r.emoji === decodeURIComponent(emoji)
    );

    if (reactionIndex === -1) {
      return res.status(404).json({ error: "Reaction not found" });
    }

    message.reactions.splice(reactionIndex, 1);
    await message.save();

    // Emit real-time reaction removal event
    req.io?.to(`community:${message.communityId}`).emit("reaction:removed", {
      messageId,
      emoji: decodeURIComponent(emoji),
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

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    const message = await DirectMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Ensure user is part of the conversation
    const isParticipant = 
      String(message.from) === userId || String(message.to) === userId;
    if (!isParticipant) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      (r) => String(r.userId) === userId && r.emoji === emoji
    );

    if (existingReaction) {
      return res.status(400).json({ error: "Already reacted with this emoji" });
    }

    // Add reaction
    message.reactions.push({
      emoji,
      userId,
      userName,
      createdAt: new Date()
    });

    await message.save();

    // Emit real-time reaction event to both participants
    const otherUserId = String(message.from) === userId ? String(message.to) : String(message.from);
    req.io?.to(userId).to(otherUserId).emit("dm:reaction:added", {
      messageId,
      reaction: {
        emoji,
        userId,
        userName,
        createdAt: message.reactions[message.reactions.length - 1].createdAt
      }
    });

    return res.status(201).json({
      message: "Reaction added",
      reaction: message.reactions[message.reactions.length - 1]
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

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    const message = await DirectMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Ensure user is part of the conversation
    const isParticipant = 
      String(message.from) === userId || String(message.to) === userId;
    if (!isParticipant) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Find and remove reaction
    const reactionIndex = message.reactions.findIndex(
      (r) => String(r.userId) === userId && r.emoji === decodeURIComponent(emoji)
    );

    if (reactionIndex === -1) {
      return res.status(404).json({ error: "Reaction not found" });
    }

    message.reactions.splice(reactionIndex, 1);
    await message.save();

    // Emit real-time reaction removal event
    const otherUserId = String(message.from) === userId ? String(message.to) : String(message.from);
    req.io?.to(userId).to(otherUserId).emit("dm:reaction:removed", {
      messageId,
      emoji: decodeURIComponent(emoji),
      userId
    });

    return res.json({ message: "Reaction removed" });
  } catch (err) {
    console.error("💥 DELETE /api/reactions/dm/:messageId/:emoji ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
