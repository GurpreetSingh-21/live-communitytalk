// backend/models/Community.js
const mongoose = require("mongoose");

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
  return out.slice(0, 20); // cap to something sane
}

const communitySchema = new mongoose.Schema(
  {
    // Display name shown in UI
    name: {
      type: String,
      required: [true, "Community name is required"],
      trim: true,
      minlength: [2, "Community name must be at least 2 characters"],
      maxlength: [100, "Community name must be under 100 characters"],
    },

    // "college" | "religion" | "custom"
    type: {
      type: String,
      enum: ["college", "religion", "custom"],
      default: "custom",
      index: true,
      required: true,
    },

    // Stable identifier (lowercase, hyphenated) e.g., "queens-college", "sikh"
    // For type "college" and "religion" this is REQUIRED (pre-validate below).
    key: { type: String, trim: true, lowercase: true, index: true },

    // Slug for URLs (often equals key). Unique (sparse).
    slug: { type: String, trim: true, lowercase: true, index: true },

    description: { type: String, trim: true, maxlength: 500, default: "" },

    // Visibility / metadata (useful for custom groups)
    isPrivate: { type: Boolean, default: false },

    tags: {
      type: [String],
      default: [],
      set: normalizeTags,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Person", default: null },
  },
  { timestamps: true }
);

/* ───────────────────────── Validation ───────────────────────── */
// Require `key` when type is not "custom"
communitySchema.pre("validate", function requireKeyForTyped(next) {
  if (this.type === "college" || this.type === "religion") {
    if (!this.key) {
      this.invalidate("key", "Key is required for college/religion communities");
    }
  }
  next();
});

/* ───────────────────────── Indexes ─────────────────────────
 * Uniqueness on (type, key) and on slug (sparse so null/undefined allowed).
 * Name is NOT globally unique (two custom groups can share the same display name).
 */
communitySchema.index({ type: 1, key: 1 }, { unique: true, sparse: true });
communitySchema.index({ slug: 1 }, { unique: true, sparse: true });
communitySchema.index({ name: 1 });
communitySchema.index({ createdBy: 1 });
// Text index to support /api/communities?q= searches
communitySchema.index({ name: "text", description: "text", tags: "text" });

/* ───────────────────── Normalization (save) ───────────────────── */
communitySchema.pre("save", function normalizeOnSave(next) {
  if (this.isModified("key") && this.key) this.key = slugify(this.key);
  if (this.isModified("name")) this.name = this.name.trim();

  // For custom groups, if slug is missing, derive from name.
  // For typed groups, prefer slug from key; fall back to name if key missing (shouldn’t happen due to validation).
  if (!this.slug || this.isModified("name") || this.isModified("key") || this.isModified("type")) {
    if (this.type === "custom") {
      this.slug = this.slug ? slugify(this.slug) : slugify(this.name || this.key);
    } else {
      this.slug = slugify(this.key || this.name);
    }
  }

  // Normalize tags
  if (this.isModified("tags")) {
    this.tags = normalizeTags(this.tags);
  }

  next();
});

/* ───────────────── findOneAndUpdate normalization ─────────────────
 * Prevent "ConflictingUpdateOperators" by coalescing top-level fields into $set,
 * then sanitizing the values (slugify/trim) in one place.
 */
communitySchema.pre("findOneAndUpdate", function normalizeOnUpdate(next) {
  const update = this.getUpdate() || {};
  // Move any top-level keys into $set to avoid conflicts
  const $set = update.$set ? { ...update.$set } : {};
  const topLevelKeys = ["name", "type", "key", "slug", "description", "isPrivate", "tags", "createdBy"];

  for (const k of topLevelKeys) {
    if (Object.prototype.hasOwnProperty.call(update, k)) {
      $set[k] = update[k];
      delete update[k];
    }
  }

  // Normalize values being set
  if (typeof $set.name === "string") $set.name = $set.name.trim();
  if (typeof $set.key === "string") $set.key = slugify($set.key);
  if (typeof $set.slug === "string") $set.slug = slugify($set.slug);
  if (typeof $set.description === "string") $set.description = $set.description.trim();
  if (Array.isArray($set.tags)) $set.tags = normalizeTags($set.tags);

  // If we changed name/key/type and slug isn't explicitly set, compute it
  const touchedIdentity = ["name", "key", "type"].some((k) => Object.prototype.hasOwnProperty.call($set, k));
  if (touchedIdentity && !$set.slug) {
    if ($set.type === "custom" || (!$set.type && this.getQuery()?.type === "custom")) {
      $set.slug = slugify($set.name || $set.key);
    } else {
      $set.slug = slugify($set.key || $set.name);
    }
  }

  // Reassign the normalized $set
  if (Object.keys($set).length) {
    update.$set = $set;
  }

  this.setUpdate(update);
  next();
});

/* ───────────────────── Serialization Cleanup ───────────────────── */
communitySchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

/* ───────────────────── Statics / Helpers ───────────────────── */
/**
 * Find or create a community by {type, key}. Name is used on insert.
 * Returns a POJO (lean).
 */
communitySchema.statics.findOrCreateTyped = async function ({ type, key, name, createdBy = null }) {
  if (!type) throw new Error("type is required");
  if (type !== "custom" && !key) throw new Error("key is required for typed communities");

  const normKey = key ? slugify(key) : undefined;
  const normSlug = normKey || slugify(name || "");

  const update = {
    $setOnInsert: {
      type,
      key: normKey,
      name: name || normKey,
      slug: normSlug,
      createdBy,
    },
    $set: {
      name: name || normKey,
    },
  };

  const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
  const doc = await this.findOneAndUpdate({ type, key: normKey }, update, opts).lean();
  return doc;
};

module.exports = mongoose.model("Community", communitySchema);