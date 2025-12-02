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
    /* ---------------------- Basic identity ---------------------- */
    fullName: { type: String, required: true, trim: true },

    bio: { 
      type: String, 
      trim: true, 
      maxlength: 500,
      default: "" 
    },

    email: {
      type: String,
      required: true,
      unique: true, // ✅ Index defined here (no need to duplicate later)
      lowercase: true,
      trim: true,
    },

    // hashed password (never selected by default)
    password: {
      type: String,
      required: true,
      select: false,
    },

    avatar: { type: String, default: "/default-avatar.png" },

    // Optional legacy request field (can stay sparse+unique)
    request: { type: String, unique: true, sparse: true },

    /* ---------------------- Account & Role ---------------------- */
    emailVerified: { type: Boolean, default: false },

    role: {
      type: String,
      enum: ["user", "mod", "admin"],
      default: "user",
    },

    // Legacy convenience flag (DO NOT RELY; use role instead)
    isAdmin: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true },

    verificationCode: { type: String, select: false },
    verificationCodeExpires: { type: Date, select: false },

    // ⭐ NEW: Moderation Fields (for report/block tracking)
    reportsReceivedCount: {
      type: Number,
      default: 0,
      required: true,
      index: true, // Index for easy lookups in admin panel
    },
    isPermanentlyDeleted: {
      type: Boolean,
      default: false,
      required: true,
      index: true, // Index for quickly filtering banned users
    },

    /* ---------------- Dating Integration ---------------- */
    hasDatingProfile: { type: Boolean, default: false },
    datingProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DatingProfile",
      default: null,
    },

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
    },

    // Per-user notification preferences (for /profile/notifications screen)
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

    // Privacy preferences (for /profile/security screen)
    privacyPrefs: {
      showOnlineStatus: { type: Boolean, default: false },
      allowDMsFromSameCollege: { type: Boolean, default: true },
      allowDMsFromOthers: { type: Boolean, default: false },
    },

    /* ---------------------- Two-Factor Authentication ---------------------- */
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    twoFactorBackupCodes: { type: [String], select: false, default: [] },

    /* ---------------------- Other Flags ---------------------- */
    nonEduEmail: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* ------------------------- Indexes -------------------------- */

// Moderation
personSchema.index({ reportsReceivedCount: 1 });
personSchema.index({ isPermanentlyDeleted: 1 });

// Scope & lookups
personSchema.index({ collegeSlug: 1, religionKey: 1 });
personSchema.index({ communityIds: 1 });

// Push tokens for notification fan-out
personSchema.index({ pushTokens: 1 });

/* ------------------------- Hooks ---------------------------- */

function normalizeObj(doc) {
  if (typeof doc.fullName === "string") {
    doc.fullName = doc.fullName.trim();
  }
  if (typeof doc.email === "string") {
    doc.email = doc.email.trim().toLowerCase();
  }
  if (typeof doc.collegeName === "string") {
    doc.collegeName = doc.collegeName.trim().toLowerCase();
  }
  if (typeof doc.collegeSlug === "string") {
    doc.collegeSlug = doc.collegeSlug.trim().toLowerCase();
  }
  if (typeof doc.religionKey === "string" && doc.religionKey) {
    doc.religionKey = slugify(doc.religionKey);
  }
}

personSchema.pre("save", function normalizeOnSave(next) {
  normalizeObj(this);

  // Auto-derive collegeSlug from collegeName if missing or changed
  if (
    this.isModified("collegeName") ||
    (this.collegeName && !this.collegeSlug)
  ) {
    this.collegeSlug = slugify(this.collegeName);
  }

  next();
});

personSchema.pre("findOneAndUpdate", function normalizeOnUpdate(next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || update;

  if ($set && typeof $set === "object") {
    normalizeObj($set);

    // keep collegeSlug in sync if collegeName changed
    if (
      Object.prototype.hasOwnProperty.call($set, "collegeName") &&
      $set.collegeName
    ) {
      $set.collegeSlug = slugify($set.collegeName);
    }

    if (!update.$set && $set !== update) {
      update.$set = $set;
    }
    this.setUpdate(update);
  }

  next();
});

/* ------------------------- Serialization ---------------------------- */
personSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.verificationCode;
    delete ret.verificationCodeExpires;
    delete ret.__v;
    return ret;
  },
});

/* Optional: back-compat virtual 'name' if any legacy code uses it */
personSchema
  .virtual("name")
  .get(function () {
    return this.fullName;
  })
  .set(function (v) {
    this.fullName = typeof v === "string" ? v.trim() : v;
  });

/* ------------------------- Model ---------------------------- */
module.exports = mongoose.model("Person", personSchema);