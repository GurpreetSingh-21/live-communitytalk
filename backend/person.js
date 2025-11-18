// backend/person.js
const mongoose = require("mongoose");

/* ------------------------- Helpers ------------------------- */
function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-+/g, "-");
}

/* ------------------------- Schema -------------------------- */
const personSchema = new mongoose.Schema(
  {
    // Basic identity
    fullName: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: { type: String, required: true }, // hashed password
    avatar: { type: String, default: "/default-avatar.png" },

    // Optional request field (legacy)
    request: { type: String, unique: true, sparse: true },

    /* ---------------------- Account & Role ---------------------- */
    emailVerified: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["user", "mod", "admin"],
      default: "user",
    },
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    verificationCode: { type: String, select: false },
    verificationCodeExpires: { type: Date, select: false },

    /* ---------------------- College ---------------------- */
    collegeName: { type: String, trim: true, lowercase: true, index: true },
    collegeSlug: { type: String, trim: true, lowercase: true, index: true },

    /* ---------------------- Religion ---------------------- */
    religionKey: { type: String, trim: true, lowercase: true, index: true },

    /* ---------------------- Communities ---------------------- */
    communityIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Community",
      },
    ],

    /* ------------------ Push Notifications ------------------ */
    pushTokens: {
      type: [String],
      default: [],
      index: true,
    },

    // ✅ NEW: Per-user notification preferences (Discord-style)
    notificationPrefs: {
      pushEnabled: {
        type: Boolean,
        default: true, // master kill-switch for app push
      },
      dms: {
        type: Boolean,
        default: true, // direct messages & private threads
      },
      communities: {
        type: Boolean,
        default: true, // community posts / updates / announcements
      },
      mentions: {
        type: Boolean,
        default: true, // @mentions, replies
      },
    },

    /* ---------------------- Other Flags ---------------------- */
    nonEduEmail: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* ------------------------- Indexes -------------------------- */
personSchema.index({ collegeSlug: 1, religionKey: 1 });
personSchema.index({ email: 1 }, { unique: true }); // Correct
personSchema.index({ communityIds: 1 }); // Correct

/* ------------------------- Hooks ---------------------------- */
personSchema.pre("save", function normalize(next) {
  if (
    this.isModified("collegeName") ||
    (this.collegeName && !this.collegeSlug)
  ) {
    this.collegeSlug = slugify(this.collegeName);
  }
  if (this.isModified("religionKey") && this.religionKey) {
    this.religionKey = slugify(this.religionKey);
  }
  next();
});

/* ------------------------- Model ---------------------------- */
module.exports = mongoose.model("Person", personSchema);