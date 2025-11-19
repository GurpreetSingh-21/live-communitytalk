// backend/models/DatingProfile.js
const mongoose = require("mongoose");

const GENDERS = ["male", "female", "nonbinary", "other"];

/* ───────────────────── Helpers ───────────────────── */

function normalizeString(v) {
  return typeof v === "string" ? v.trim() : v;
}

function normalizeScopeKey(v) {
  if (typeof v !== "string") return v;
  const trimmed = v.trim().toLowerCase();
  return trimmed || null;
}

function normalizeSeeking(list) {
  if (!Array.isArray(list)) return GENDERS.slice();
  const out = [];
  const seen = new Set();
  for (const g of list) {
    const key = String(g || "").trim().toLowerCase();
    if (!key || !GENDERS.includes(key)) continue;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out.length ? out : GENDERS.slice();
}

/* ───────────────────── Schema ───────────────────── */

const datingProfileSchema = new mongoose.Schema(
  {
    // 1:1 link back to Person
    person: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true,
      unique: true,
      index: true,
    },

    // Identity (denormalized from Person)
    name: {
      type: String,
      required: true,
      trim: true, // primary display name
    },

    // College + faith scope (for feed queries)
    collegeSlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    religionKey: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      default: null,
    },

    // Core Dating Data
    photos: {
      type: [String], // ImageKit / CDN URLs
      default: [],
      validate: {
        validator(val) {
          return Array.isArray(val) && val.length >= 1 && val.length <= 5;
        },
        message: "A dating profile requires between 1 and 5 photos.",
      },
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    gender: {
      type: String,
      enum: GENDERS,
      required: true,
      index: true,
    },

    seeking: {
      type: [String],
      enum: GENDERS,
      default: GENDERS,
      validate: {
        validator(val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: "You must specify at least one gender you are interested in.",
      },
    },

    // e.g. 'freshman', 'senior', 'grad', 'phd', 'alumni', 'other'
    yearOfStudy: {
      type: String,
      trim: true,
      default: "other",
      enum: [
        "freshman",
        "sophomore",
        "junior",
        "senior",
        "grad",
        "phd",
        "alumni",
        "other",
      ],
    },

    // Swiping & Match Data (store other DatingProfile ids)
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DatingProfile",
        index: true,
      },
    ],
    dislikes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DatingProfile",
      },
    ],
    matches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DatingProfile",
      },
    ],

    // Profile visibility / moderation
    isProfileVisible: {
      type: Boolean,
      default: false, // off until approved
      index: true,
    },
    isPhotoApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Optional extra moderation flag if you ever need hard suspend
    isSuspended: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

/* ───────────────────────── Indexes ─────────────────────────
 * Main feed: "show me visible, approved profiles for this college/faith"
 */
datingProfileSchema.index(
  {
    collegeSlug: 1,
    religionKey: 1,
    gender: 1,
    isProfileVisible: 1,
    isPhotoApproved: 1,
    isSuspended: 1,
    createdAt: -1,
  },
  { name: "dating_feed_index" }
);

/* ───────────────────── fullName virtual (back-compat) ─────────────────────
 * Mirrors the Member model pattern; lets you safely use fullName in code.
 */
datingProfileSchema
  .virtual("fullName")
  .get(function () {
    return this.name;
  })
  .set(function (v) {
    this.name = normalizeString(v);
  });

/* ───────────────────── Normalization (save) ───────────────────── */
datingProfileSchema.pre("save", function (next) {
  if (typeof this.name === "string") this.name = this.name.trim();
  if (typeof this.bio === "string") this.bio = this.bio.trim();

  if (typeof this.collegeSlug === "string") {
    this.collegeSlug = normalizeScopeKey(this.collegeSlug);
  }
  if (typeof this.religionKey === "string") {
    this.religionKey = normalizeScopeKey(this.religionKey);
  }

  if (typeof this.gender === "string") {
    const g = this.gender.trim().toLowerCase();
    if (GENDERS.includes(g)) this.gender = g;
  }

  if (Array.isArray(this.seeking)) {
    this.seeking = normalizeSeeking(this.seeking);
  }

  next();
});

/* ───────────────────── Normalization (findOneAndUpdate) ───────────────────── */
datingProfileSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || update;

  if (typeof $set.name === "string") $set.name = $set.name.trim();
  if (typeof $set.bio === "string") $set.bio = $set.bio.trim();

  if (typeof $set.collegeSlug === "string") {
    $set.collegeSlug = normalizeScopeKey($set.collegeSlug);
  }
  if (typeof $set.religionKey === "string") {
    $set.religionKey = normalizeScopeKey($set.religionKey);
  }

  if (typeof $set.gender === "string") {
    const g = $set.gender.trim().toLowerCase();
    if (GENDERS.includes(g)) $set.gender = g;
  }

  if (Array.isArray($set.seeking)) {
    $set.seeking = normalizeSeeking($set.seeking);
  }

  if (update.$set) {
    update.$set = $set;
  } else {
    Object.assign(update, $set);
  }

  this.setUpdate(update);
  next();
});

/* ───────────────────── Serialization Cleanup ───────────────────── */
datingProfileSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("DatingProfile", datingProfileSchema);
