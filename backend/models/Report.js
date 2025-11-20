const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    // The user who initiated the report/block action
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Person',
        required: true,
    },
    // The user who is being reported/blocked (the subject of the report)
    reportedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Person',
        required: true,
    },
    // The reason for the report (e.g., 'Harassment', 'Spam', 'Inappropriate content')
    reason: {
        type: String,
        required: true,
        maxlength: 255,
    },
    // Status can be used for moderation workflow (e.g., 'pending', 'resolved', 'ignored')
    status: {
        type: String,
        default: 'pending',
        enum: ['pending', 'resolved', 'ignored'],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// 🔑 CRITICAL: Compound unique index
// This prevents one user from spamming reports against the same target user.
ReportSchema.index({ reporter: 1, reportedUser: 1 }, { unique: true });

module.exports = mongoose.model('Report', ReportSchema);