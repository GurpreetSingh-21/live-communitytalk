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

    // Text body
    content: { type: String, trim: true, maxlength: 4000 },

    // Optional attachments
    attachments: [
      {
        url: String,
        type: String, // "image", "file", etc.
        name: String,
        size: Number,
      },
    ],

    status: {
      type: String,
      enum: ["sent", "read", "edited", "deleted"],
      default: "sent",
      index: true,
    },

    readAt: Date,
    editedAt: Date,
    deletedAt: Date,

    // quick check for clients
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true, // gives createdAt / updatedAt
  }
);

/* ───── Indexes for speed ───── */
// 1) recent messages in a conversation
directMessageSchema.index({ from: 1, to: 1, createdAt: -1 });
// 2) unread inbox
directMessageSchema.index({ to: 1, status: 1, createdAt: -1 });

// Optional guard: prevent self-DM
directMessageSchema.pre("validate", function (next) {
  if (this.from && this.to && String(this.from) === String(this.to)) {
    return next(new Error("Cannot message yourself"));
  }
  next();
});

// Keep status in sync
directMessageSchema.pre("save", function (next) {
  if (this.isDeleted) {
    this.status = "deleted";
    if (!this.deletedAt) this.deletedAt = new Date();
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
  this.content = "";
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