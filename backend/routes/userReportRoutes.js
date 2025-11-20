//backend/routes/userReportRoutes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// Assuming these paths are correct relative to where this file is placed
const authenticate = require("../middleware/authenticate"); 
const requireAdmin = require("../middleware/requireAdmin"); // ⭐ ADDED: For admin resolution endpoint
const Person = require("../person"); 
const Report = require("../models/Report"); 

// Define the threshold (must match the one used in the admin panel)
const AUTO_DELETE_THRESHOLD = 7; 

/* ------------------------------------------------------------------ *
 * Helper function to check and initiate permanent ban
 * ------------------------------------------------------------------ */
async function checkAndAutoBan(reportedUserId, threshold) {
    try {
        // 1. Increment the reports received count
        const updatedUser = await Person.findByIdAndUpdate(
            reportedUserId,
            { $inc: { reportsReceivedCount: 1 } },
            { new: true }
        );

        if (updatedUser && updatedUser.reportsReceivedCount >= threshold) {
            console.warn(`🚨 User ${reportedUserId} hit auto-delete threshold (${updatedUser.reportsReceivedCount}). Initiating permanent ban.`);
            
            // 2. Perform permanent ban action: Set deletion flag and deactivate
            await Person.findByIdAndUpdate(
                reportedUserId,
                { $set: { 
                    isPermanentlyDeleted: true, 
                    isActive: false // Deactivate account immediately
                } }
            );
            
            // Note: If you have socket services enabled (req.io), you should emit a ban event here.
        }
    } catch (e) {
        console.error(`[Report:AutoBan Check Failed] for user ${reportedUserId}:`, e);
    }
}

/* ------------------------------------------------------------------ *
 * USER API: Report/Block Endpoints (Authenticated)
 * ------------------------------------------------------------------ */

// POST /api/reports/user
// This route is called when a logged-in user reports/blocks another user.
router.post("/user", authenticate, async (req, res) => {
    console.log("🔥 [POST /api/reports/user] HIT");
    
    // The reporting user's ID is available via the 'authenticate' middleware
    const reporterId = req.user.id; 
    const { reportedUserId, reason } = req.body || {};

    if (!mongoose.isValidObjectId(reportedUserId) || !reason) {
        return res.status(400).json({ error: "Invalid reported user ID or missing reason." });
    }

    if (String(reporterId) === String(reportedUserId)) {
        return res.status(400).json({ error: "You cannot report yourself." });
    }

    try {
        // 1. Create the Report document (This enforces the unique index: one report per user pair)
        const report = new Report({
            reporter: reporterId,
            reportedUser: reportedUserId,
            reason: String(reason).trim().substring(0, 255), // Truncate reason for safety
            status: 'pending',
        });

        await report.save();
        
        // 2. Check and execute auto-ban logic asynchronously
        checkAndAutoBan(reportedUserId, AUTO_DELETE_THRESHOLD);

        console.log(`[POST /reports/user] Report successfully submitted by ${reporterId}.`);
        
        // Success response
        res.status(201).json({ message: "User reported and blocked successfully. Review will follow." });

    } catch (e) {
        console.error("💥 POST /api/reports/user ERROR:", e);

        // Check for MongoDB duplicate key error (code 11000)
        if (e && e.code === 11000) {
            return res.status(400).json({ error: "You have already submitted a report for this user." });
        }
        
        res.status(500).json({ error: "Failed to process report." });
    }
});

/* ------------------------------------------------------------------ *
 * ADMIN API: Report Resolution Endpoints (Requires Admin Role)
 * ------------------------------------------------------------------ */

// PATCH /api/reports/admin/:userId/resolve - Marks all pending reports as resolved/cleared
router.patch("/admin/:userId/resolve", authenticate, requireAdmin, async (req, res) => {
    console.log("📡 [PATCH /api/reports/admin/:userId/resolve] HIT");
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ error: "Invalid user ID." });
    }

    try {
        // Find all reports against this user that are currently 'pending' and update their status
        const result = await Report.updateMany(
            { reportedUser: userId, status: 'pending' },
            { $set: { status: 'resolved' } }
        );

        console.log(`✅ Reports resolved for user ${userId}. Count: ${result.modifiedCount}`);

        // Note: You must manually refresh the Admin Panel after this action!
        res.json({ 
            message: `${result.modifiedCount} Reports resolved and cleared from queue.`,
            resolvedCount: result.modifiedCount
        });

    } catch (e) {
        console.error("💥 PATCH /api/reports/admin/:userId/resolve ERROR:", e);
        res.status(500).json({ error: "Failed to resolve reports." });
    }
});

module.exports = router;