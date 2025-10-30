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
  return out.slice(0, 20);
}

const communitySchema = new mongoose.Schema(
  {
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
      index: true,                 // ✅ keep this, we query by type
      required: true,
    },

    // stable identifier
    key: {
      type: String,
      trim: true,
      lowercase: true,
      // ❌ remove inline index — we add a compound index below
      // index: true,
    },

    // slug for URLs
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      // ❌ remove inline index — we add a unique sparse index below
      // index: true,
    },

    description: { type: String, trim: true, maxlength: 500, default: "" },

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
communitySchema.pre("validate", function requireKeyForTyped(next) {
  if (this.type === "college" || this.type === "religion") {
    if (!this.key) {
      this.invalidate("key", "Key is required for college/religion communities");
    }
  }
  next();
});

/* ───────────────────────── Indexes ───────────────────────── */
// ✅ keep these explicit ones
communitySchema.index({ type: 1, key: 1 }, { unique: true, sparse: true });
communitySchema.index({ slug: 1 }, { unique: true, sparse: true });
communitySchema.index({ name: 1 });
communitySchema.index({ createdBy: 1 });
communitySchema.index({ name: "text", description: "text", tags: "text" });

/* ───────────────────── Normalization (save) ───────────────────── */
communitySchema.pre("save", function normalizeOnSave(next) {
  if (this.isModified("key") && this.key) this.key = slugify(this.key);
  if (this.isModified("name")) this.name = this.name.trim();

  if (!this.slug || this.isModified("name") || this.isModified("key") || this.isModified("type")) {
    if (this.type === "custom") {
      this.slug = this.slug ? slugify(this.slug) : slugify(this.name || this.key);
    } else {
      this.slug = slugify(this.key || this.name);
    }
  }

  if (this.isModified("tags")) {
    this.tags = normalizeTags(this.tags);
  }

  next();
});

/* ───────────────── findOneAndUpdate normalization ───────────────── */
communitySchema.pre("findOneAndUpdate", function normalizeOnUpdate(next) {
  const update = this.getUpdate() || {};
  const $set = update.$set ? { ...update.$set } : {};
  const topLevelKeys = ["name", "type", "key", "slug", "description", "isPrivate", "tags", "createdBy"];

  for (const k of topLevelKeys) {
    if (Object.prototype.hasOwnProperty.call(update, k)) {
      $set[k] = update[k];
      delete update[k];
    }
  }

  if (typeof $set.name === "string") $set.name = $set.name.trim();
  if (typeof $set.key === "string") $set.key = slugify($set.key);
  if (typeof $set.slug === "string") $set.slug = slugify($set.slug);
  if (typeof $set.description === "string") $set.description = $set.description.trim();
  if (Array.isArray($set.tags)) $set.tags = normalizeTags($set.tags);

  const touchedIdentity = ["name", "key", "type"].some((k) => Object.prototype.hasOwnProperty.call($set, k));
  if (touchedIdentity && !$set.slug) {
    if ($set.type === "custom" || (!$set.type && this.getQuery()?.type === "custom")) {
      $set.slug = slugify($set.name || $set.key);
    } else {
      $set.slug = slugify($set.key || $set.name);
    }
  }

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