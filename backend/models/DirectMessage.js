// backend/models/DirectMessage.js
const mongoose = require("mongoose");

const directMessageSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true,
      index: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true,
      index: true,
    },

    // Text body (routes should enforce text-or-attachments)
    content: { type: String, trim: true, maxlength: 4000 },

    // Optional attachments
    attachments: [
      {
        url: { type: String },
        type: { type: String }, // "image", "file", etc.
        name: { type: String },
        size: { type: Number },
      },
    ],

    // Lifecycle + read state
    status: {
      type: String,
      enum: ["sent", "read", "edited", "deleted"],
      default: "sent",
      index: true,
    },
    readAt: { type: Date },
    editedAt: { type: Date },
    deletedAt: { type: Date },
    isDeleted: { type: Boolean, default: false, index: true }, // quick check for clients

    // Client-friendly timestamp (kept in sync)
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// ─────────────── Indexes for speed ───────────────
// Common thread fetches & ordering
directMessageSchema.index({ from: 1, to: 1, createdAt: -1 });
// Unread queries (e.g., count unread for inbox)
directMessageSchema.index({ to: 1, status: 1, createdAt: -1 });
directMessageSchema.index({ createdAt: -1 });

// Optional guard: prevent self-DM (routes also check; this is extra safety)
directMessageSchema.pre("validate", function (next) {
  if (this.from && this.to && String(this.from) === String(this.to)) {
    return next(new Error("Cannot message yourself"));
  }
  next();
});

// Keep timestamp in sync and auto-mark edits/deletes
directMessageSchema.pre("save", function (next) {
  if (!this.timestamp) this.timestamp = new Date();

  if (this.isDeleted) {
    this.status = "deleted";
    if (!this.deletedAt) this.deletedAt = new Date();
    // Optional but safer: blank content once deleted so old text never leaks
    this.content = "";
  } else if (!this.isNew && this.isModified("content")) {
    this.status = "edited";
    this.editedAt = new Date();
  }

  next();
});

// Instance helpers
directMessageSchema.methods.markDeleted = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.status = "deleted";
  this.content = ""; // keep attachments meta if you want to show "file removed" later
  return this.save();
};

directMessageSchema.methods.markRead = async function () {
  if (this.status !== "deleted") {
    this.status = "read";
    this.readAt = new Date();
  }
  return this.save();
};

module.exports = mongoose.model("DirectMessage", directMessageSchema);