const mongoose = require("mongoose");

const collegeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    // Unique identifier (e.g. "qc", "baruch")
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    // The domains associated with this college
    emailDomains: {
      type: [String],
      default: [],
      set: (v) => (Array.isArray(v) ? v.map(s => s.toLowerCase().trim()).filter(Boolean) : []),
    },
    // Link to the actual Community document where chat happens
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },
  },
  { timestamps: true }
);

// Index for fast domain lookup during registration
collegeSchema.index({ emailDomains: 1 });

module.exports = mongoose.model("College", collegeSchema);