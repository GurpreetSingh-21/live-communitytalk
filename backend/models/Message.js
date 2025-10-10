// backend/models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // Basic sender info
    sender: { type: String, required: true, trim: true },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true,
      index: true,
    },
    avatar: { type: String, default: "/default-avatar.png" },

    // Message body
    content: { type: String, required: true, trim: true, maxlength: 4000 },

    // Optional attachments (future)
    attachments: [
      {
        url: { type: String },
        type: { type: String }, // "image", "file", etc.
        name: { type: String },
        size: { type: Number },
      },
    ],

    // Community association
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },

    // Message lifecycle
    timestamp: { type: Date, default: Date.now, index: true },
    editedAt: { type: Date },
    deletedAt: { type: Date },

    // Soft-delete flag (used by frontend; faster than checking deletedAt)
    isDeleted: { type: Boolean, default: false, index: true },

    // Optional status tracking (kept for clarity/analytics)
    status: {
      type: String,
      enum: ["sent", "edited", "deleted"],
      default: "sent",
      index: true,
    },
  },
  { timestamps: true }
);

// ───────────── Indexes ─────────────
messageSchema.index({ communityId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, communityId: 1 });

// ───────────── Virtuals ─────────────
messageSchema.virtual("senderDetails", {
  ref: "Person",
  localField: "senderId",
  foreignField: "_id",
  justOne: true,
});

// ───────────── Hooks ─────────────
messageSchema.pre("save", function (next) {
  if (!this.timestamp) this.timestamp = new Date();

  // If we're soft-deleted, ensure status stays aligned
  if (this.isDeleted) {
    this.status = "deleted";
    if (!this.deletedAt) this.deletedAt = new Date();
  } else if (!this.isNew && this.isModified("content")) {
    // Mark edits only on updates (not on create)
    this.status = "edited";
    this.editedAt = new Date();
  }

  next();
});

// ───────────── Instance helpers ─────────────
messageSchema.methods.markDeleted = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.status = "deleted";
  // Optional: blank content so clients never see old text
  this.content = "";
  return this.save();
};

module.exports = mongoose.model("Message", messageSchema);