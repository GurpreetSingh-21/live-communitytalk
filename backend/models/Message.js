// backend/models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, required: true, trim: true },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true,
      index: true,
    },

    avatar: { type: String, default: "/default-avatar.png" },

    content: { type: String, required: true, trim: true, maxlength: 4000 },

    attachments: [
      {
        url: { type: String },
        type: { type: String }, // Explicitly define 'type' field
        name: { type: String },
        size: { type: Number },
      },
    ],

    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },

    editedAt: Date,
    deletedAt: Date,
    isDeleted: { type: Boolean, default: false, index: true },

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
  },
  {
    timestamps: true, // -> createdAt, updatedAt
  }
);

// latest messages per community
messageSchema.index({ communityId: 1, createdAt: -1 });
// messages by user inside a community
messageSchema.index({ senderId: 1, communityId: 1 });

messageSchema.virtual("senderDetails", {
  ref: "Person",
  localField: "senderId",
  foreignField: "_id",
  justOne: true,
});

messageSchema.pre("save", function (next) {
  if (this.isDeleted) {
    this.status = "deleted";
    if (!this.deletedAt) this.deletedAt = new Date();
  } else if (!this.isNew && this.isModified("content")) {
    this.status = "edited";
    this.editedAt = new Date();
  }
  next();
});

messageSchema.methods.markDeleted = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.status = "deleted";
  this.content = "";
  return this.save();
};

messageSchema.methods.markDelivered = async function () {
  if (this.status === "sent") {
    this.status = "delivered";
    this.deliveredAt = new Date();
  }
  return this.save();
};

messageSchema.methods.markRead = async function () {
  if (this.status !== "deleted") {
    this.status = "read";
    this.readAt = new Date();
  }
  return this.save();
};

module.exports = mongoose.model("Message", messageSchema);