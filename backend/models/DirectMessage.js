// backend/models/DirectMessage.js
const mongoose = require("mongoose");

// ✅ Define Attachment Schema separately to avoid 'type' keyword conflict
const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String, default: 'file' }, // stores "photo", "video", "file", "audio"
  name: String,
  size: Number
}, { _id: false }); // Prevents creating a separate _id for each attachment

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

    // Text body (or Image URL in your current setup)
    content: { type: String, trim: true, maxlength: 4000 },

    // ✅ Message Type field
    type: { 
      type: String, 
      enum: ["text", "photo", "video", "audio", "file"], 
      default: "text" 
    },

    // ✅ Use the sub-schema for attachments (Fixes the CastError)
    attachments: [attachmentSchema],

    status: {
      type: String,
      enum: ["sent", "delivered", "read", "edited", "deleted"],
      default: "sent",
      index: true,
    },

    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "Person", 
          required: true 
        },
        userName: String,
        createdAt: { type: Date, default: Date.now }
      }
    ],

    deliveredAt: Date,
    readAt: Date,
    editedAt: Date,
    deletedAt: Date,
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
directMessageSchema.index({ from: 1, to: 1, createdAt: -1 });
directMessageSchema.index({ to: 1, status: 1, createdAt: -1 });

directMessageSchema.pre("validate", function (next) {
  if (this.from && this.to && String(this.from) === String(this.to)) {
    return next(new Error("Cannot message yourself"));
  }
  next();
});

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

directMessageSchema.methods.markDelivered = async function () {
  if (this.status === "sent") {
    this.status = "delivered";
    this.deliveredAt = new Date();
  }
  return this.save();
};

module.exports = mongoose.model("DirectMessage", directMessageSchema);