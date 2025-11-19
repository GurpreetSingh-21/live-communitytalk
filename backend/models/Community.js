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
      .replace(/\s+/g, " "); // normalize multi-spaces

    if (!v) continue;
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }

  // Hard cap on tags for sanity
  return out.slice(0, 20);
}

/* ───────────────────── Schema ───────────────────── */

const communitySchema = new mongoose.Schema(
  {
    // Human-facing name
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
      required: true,
      index: true, // we query by type in a few places
    },

    // Stable identifier (e.g. "qcny", "qcny__hindu")
    // For "college" / "religion" this MUST be present.
    key: {
      type: String,
      trim: true,
      lowercase: true,
      // index handled via compound index below
    },

    // Slug for URLs (e.g. "qcny", "hindu-qcny")
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      // index handled via unique sparse index below
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    // Whether this community is discoverable / public
    isPrivate: {
      type: Boolean,
      default: false,
    },

    // Normalized lowercase tags (e.g. ["queens college", "nyc"])
    tags: {
      type: [String],
      default: [],
      set: normalizeTags,
    },

    // Creator (usually an admin)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      default: null,
    },
  },
  { timestamps: true }
);

/* ───────────────────── Validation ───────────────────── */

/**
 * For typed communities ("college" / "religion"), key is required.
 * Custom communities can omit key and just rely on name/slug.
 */
communitySchema.pre("validate", function requireKeyForTyped(next) {
  if (this.type === "college" || this.type === "religion") {
    if (!this.key) {
      this.invalidate("key", "Key is required for college/religion communities");
    }
  }
  next();
});

/* ───────────────────── Indexes ─────────────────────
 * - (type, key) unique => one entry per (type, key)
 * - slug unique => clean URL usage
 * - name, createdBy for common admin queries
 * - text index for search/autocomplete
 * -------------------------------------------------- */

communitySchema.index({ type: 1, key: 1 }, { unique: true, sparse: true });
communitySchema.index({ slug: 1 }, { unique: true, sparse: true });
communitySchema.index({ name: 1 });
communitySchema.index({ createdBy: 1 });
communitySchema.index({ name: "text", description: "text", tags: "text" });

/* ───────────────────── Normalization (save) ───────────────────── */

communitySchema.pre("save", function normalizeOnSave(next) {
  // Normalize key
  if (this.isModified("key") && this.key) {
    this.key = slugify(this.key);
  }

  // Normalize name
  if (this.isModified("name") && typeof this.name === "string") {
    this.name = this.name.trim();
  }

  // Keep slug in sync with identity fields
  if (
    !this.slug ||
    this.isModified("name") ||
    this.isModified("key") ||
    this.isModified("type")
  ) {
    if (this.type === "custom") {
      // For custom groups, prefer the name as slug; fallback to key
      this.slug = this.slug
        ? slugify(this.slug)
        : slugify(this.name || this.key || "");
    } else {
      // For typed communities, slug is derived from key (or name fallback)
      this.slug = slugify(this.key || this.name || "");
    }
  }

  // Normalize tags
  if (this.isModified("tags")) {
    this.tags = normalizeTags(this.tags);
  }

  next();
});

/* ───────────────── findOneAndUpdate normalization ───────────────── */

communitySchema.pre("findOneAndUpdate", function normalizeOnUpdate(next) {
  const update = this.getUpdate() || {};
  const $set = update.$set ? { ...update.$set } : {};

  // Move top-level fields into $set so the logic is consistent
  const topLevelKeys = [
    "name",
    "type",
    "key",
    "slug",
    "description",
    "isPrivate",
    "tags",
    "createdBy",
  ];

  for (const k of topLevelKeys) {
    if (Object.prototype.hasOwnProperty.call(update, k)) {
      $set[k] = update[k];
      delete update[k];
    }
  }

  // Normalize fields
  if (typeof $set.name === "string") $set.name = $set.name.trim();
  if (typeof $set.key === "string") $set.key = slugify($set.key);
  if (typeof $set.slug === "string") $set.slug = slugify($set.slug);
  if (typeof $set.description === "string") $set.description = $set.description.trim();
  if (Array.isArray($set.tags)) $set.tags = normalizeTags($set.tags);

  // If identity fields changed but slug wasn't explicitly set, recompute slug
  const touchedIdentity = ["name", "key", "type"].some((k) =>
    Object.prototype.hasOwnProperty.call($set, k)
  );

  if (touchedIdentity && !$set.slug) {
    const query = this.getQuery() || {};
    const currentType = $set.type || query.type;

    if (currentType === "custom") {
      $set.slug = slugify($set.name || $set.key || "");
    } else {
      $set.slug = slugify($set.key || $set.name || "");
    }
  }

  if (Object.keys($set).length) {
    update.$set = $set;
  }

  this.setUpdate(update);
  next();
});

/* ───────────────────── Virtuals / Serialization ───────────────────── */

communitySchema
  .virtual("isCollege")
  .get(function () {
    return this.type === "college";
  });

communitySchema
  .virtual("isReligion")
  .get(function () {
    return this.type === "religion";
  });

communitySchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

/* ───────────────────── Statics / Helpers ───────────────────── */

/**
 * Find or create a typed community (college / religion / custom).
 * Used for idempotent setup when you just know (type, key, name).
 */
communitySchema.statics.findOrCreateTyped = async function ({
  type,
  key,
  name,
  createdBy = null,
}) {
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

/**
 * Convenience helper: resolve by id or slug.
 */
communitySchema.statics.findByIdOrSlug = function (idOrSlug) {
  if (!idOrSlug) return null;

  if (mongoose.isValidObjectId(idOrSlug)) {
    return this.findById(idOrSlug);
  }

  return this.findOne({ slug: slugify(idOrSlug) });
};

module.exports = mongoose.model("Community", communitySchema);
