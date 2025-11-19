// backend/models/Member.js
const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    // Pointer to the Person collection (preferred)
    person: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      default: null,
      index: true,
    },

    // Primary display name for UI (denormalized for speed)
    name: { type: String, default: "", trim: true },

    // Legacy: keep an email copy; also keep a normalized hidden lower copy for unique index
    email: { type: String, default: "", trim: true },
    emailLower: { type: String, default: "", select: false },

    // Avatar URL (may mirror Person.avatar or be custom)
    avatar: { type: String, default: "/default-avatar.png" },

    // Push notifications token (optional)
    fcmToken: { type: String, default: null, index: true },

    // Community this membership belongs to
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },

    // Authorization role within the community
    // - "member"  -> normal user
    // - "admin"   -> elevated permissions
    // - "owner"   -> creator / full control
    role: {
      type: String,
      enum: ["member", "admin", "owner"],
      default: "member",
      index: true,
    },

    // ✅ MERGED SOLUTION: Use memberStatus as the primary field name
    // This matches what most of your codebase expects (server.js, memberRoutes.js, etc.)
    memberStatus: {
      type: String,
      enum: ["active", "invited", "banned", "online", "owner"],
      default: "active",
      index: true,
    },

    // ✅ Legacy 'status' field kept as virtual for backwards compatibility
    // Some older code may still reference 'status' instead of 'memberStatus'
  },
  { timestamps: true }
);

/* ───────────────────────── Indexes ─────────────────────────
 * - Fast lookups by community
 * - Enforce one membership per (community, person) when person is present
 * - Enforce one membership per (community, emailLower) for legacy rows
 */
memberSchema.index(
  { community: 1, person: 1 },
  { unique: true, partialFilterExpression: { person: { $type: "objectId" } } }
);

memberSchema.index(
  { community: 1, emailLower: 1 },
  {
    unique: true,
    partialFilterExpression: {
      emailLower: { $exists: true, $type: "string", $ne: "" },
    },
  }
);

// Helpful for "who's active here" queries
memberSchema.index({ community: 1, memberStatus: 1 });

/* ───────────────────── Normalization Helpers ───────────────────── */
function normalizeObj(obj) {
  if (typeof obj.name === "string") obj.name = obj.name.trim();
  if (typeof obj.email === "string") {
    const trimmed = obj.email.trim();
    obj.email = trimmed;
    obj.emailLower = trimmed ? trimmed.toLowerCase() : "";
  }
}

/* Keep emailLower & name normalized on save/findOneAndUpdate */
memberSchema.pre("save", function (next) {
  normalizeObj(this);
  next();
});

memberSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || update;
  if ($set) normalizeObj($set);
  next();
});

/* ───────────────────── Back-compat Virtuals ─────────────────────
 * Some existing code may still read/write these fields. Map them for compatibility.
 */

// Virtual: fullName → name
memberSchema
  .virtual("fullName")
  .get(function () {
    return this.name;
  })
  .set(function (v) {
    this.name = typeof v === "string" ? v.trim() : v;
  });

// ✅ Virtual: status → memberStatus (for backwards compatibility)
memberSchema
  .virtual("status")
  .get(function () {
    return this.memberStatus;
  })
  .set(function (v) {
    this.memberStatus = v;
  });

/* ───────────────────── Serialization Cleanup ───────────────────── */
memberSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.emailLower; // internal only
    return ret;
  },
});

module.exports = mongoose.model("Member", memberSchema);