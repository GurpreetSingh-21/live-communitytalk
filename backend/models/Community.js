// backend/models/Community.js
const mongoose = require("mongoose");

/* ───────────────────── Helpers ───────────────────── */

function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-+/g, "-");
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const out = [];
  const seen = new Set();

  for (const t of tags) {
    const v = String(t || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

    if (!v) continue;
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out.slice(0, 20);
}

/* ───────────────────── Schema ───────────────────── */

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Community name is required"],
      trim: true,
      minlength: [2, "Community name must be at least 2 characters"],
      maxlength: [100, "Community name must be under 100 characters"],
    },

    type: {
      type: String,
      enum: ["college", "religion", "custom"],
      default: "custom",
      required: true,
      index: true,
    },

    // Stable identifier (e.g. "qcny")
    key: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // Slug for URLs
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    isPrivate: {
      type: Boolean,
      default: false,
    },

    tags: {
      type: [String],
      default: [],
      set: normalizeTags,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      default: null,
    },
  },
  { timestamps: true }
);

/* ───────────────────── Validation ───────────────────── */

communitySchema.pre("validate", function requireKeyForTyped(next) {
  if (this.type === "college" || this.type === "religion") {
    if (!this.key) {
      this.invalidate("key", "Key is required for college/religion communities");
    }
  }
  next();
});

/* ───────────────────── Indexes ───────────────────── */
communitySchema.index({ type: 1, key: 1 }, { unique: true, sparse: true });
communitySchema.index({ slug: 1 }, { unique: true, sparse: true });
communitySchema.index({ name: 1 });
communitySchema.index({ createdBy: 1 });
communitySchema.index({ name: "text", description: "text", tags: "text" });

/* ───────────────────── Normalization ───────────────────── */

communitySchema.pre("save", function normalizeOnSave(next) {
  if (this.isModified("key") && this.key) {
    this.key = slugify(this.key);
  }
  if (this.isModified("name") && typeof this.name === "string") {
    this.name = this.name.trim();
  }
  if (!this.slug || this.isModified("name") || this.isModified("key") || this.isModified("type")) {
    if (this.type === "custom") {
      this.slug = this.slug ? slugify(this.slug) : slugify(this.name || this.key || "");
    } else {
      this.slug = slugify(this.key || this.name || "");
    }
  }
  if (this.isModified("tags")) {
    this.tags = normalizeTags(this.tags);
  }
  next();
});

communitySchema.pre("findOneAndUpdate", function normalizeOnUpdate(next) {
  const update = this.getUpdate() || {};
  const $set = update.$set ? { ...update.$set } : {};

  if (typeof $set.name === "string") $set.name = $set.name.trim();
  if (typeof $set.key === "string") $set.key = slugify($set.key);
  if (typeof $set.slug === "string") $set.slug = slugify($set.slug);
  
  // Auto-update slug if identity fields change
  if (($set.name || $set.key) && !$set.slug) {
     const query = this.getQuery();
     // rudimentary fallback logic
     $set.slug = slugify($set.key || $set.name || "");
  }

  if (Object.keys($set).length) {
    update.$set = $set;
    this.setUpdate(update);
  }
  next();
});

module.exports = mongoose.model("Community", communitySchema);