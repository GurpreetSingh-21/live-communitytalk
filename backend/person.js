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
      index: true,
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
    isAdmin: { type: Boolean, default: false }, // used for JWT + adminRoutes
    isActive: { type: Boolean, default: true }, // for banning/deactivation

    /* ---------------------- College ---------------------- */
    collegeName: { type: String, trim: true, lowercase: true, index: true },
    collegeSlug: { type: String, trim: true, lowercase: true, index: true },

    /* ---------------------- Religion ---------------------- */
    religionKey: { type: String, trim: true, lowercase: true, index: true },

    /* ---------------------- Communities ---------------------- */
    communityIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Community", index: true },
    ],
  
    /* ------------------ Push Notifications ------------------ */
    // Array of Expo Push Tokens from user's devices
    pushTokens: {
      type: [String],
      default: [],
      index: true,
    },

    /* ---------------------- Other Flags ---------------------- */
    nonEduEmail: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* ------------------------- Indexes -------------------------- */
personSchema.index({ collegeSlug: 1, religionKey: 1 });
personSchema.index({ email: 1 });
personSchema.index({ communityIds: 1 });

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