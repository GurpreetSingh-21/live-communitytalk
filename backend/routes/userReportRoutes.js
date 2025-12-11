//backend/routes/userReportRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

// Assuming these paths are correct relative to where this file is placed
const authenticate = require("../middleware/authenticate"); 
const requireAdmin = require("../middleware/requireAdmin"); // ⭐ ADDED: For admin resolution endpoint

// Define the threshold (must match the one used in the admin panel)
const AUTO_DELETE_THRESHOLD = 7; 

/* ------------------------------------------------------------------ *
 * Helper function to check and initiate permanent ban
 * ------------------------------------------------------------------ */
async function checkAndAutoBan(reportedUserId, threshold) {
    try {
        // 1. Increment the reports received count
        const updatedUser = await prisma.user.update({
            where: { id: reportedUserId },
            data: { 
                reportsReceivedCount: { increment: 1 } 
            }
        });

        if (updatedUser && updatedUser.reportsReceivedCount >= threshold) {
            console.warn(`🚨 User ${reportedUserId} hit auto-delete threshold (${updatedUser.reportsReceivedCount}). Initiating permanent ban.`);
            
            // 2. Perform permanent ban action: Set deletion flag and deactivate
            await prisma.user.update({
                where: { id: reportedUserId },
                data: { 
                    isPermanentlyDeleted: true, 
                    isActive: false // Deactivate account immediately
                }
            });
            
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

    if (!reportedUserId || !reason) {
        return res.status(400).json({ error: "Invalid reported user ID or missing reason." });
    }

    if (String(reporterId) === String(reportedUserId)) {
        return res.status(400).json({ error: "You cannot report yourself." });
    }

    try {
        // Prisma doesn't always throw on duplicate insert unless unique constraint exists.
        // We probably don't have a unique constraint on (reporter, reported) in the Schema `model Report`.
        // Mongoose likely had one. Schema check needed.
        // Schema: `model Report` has no @@unique([reporterId, reportedId]).
        // If we want to prevent duplicates, we should check first.
        
        const existing = await prisma.report.findFirst({
            where: {
                reporterId: reporterId,
                reportedId: reportedUserId,
                status: 'pending' // Only check active requests? Or all?
                // Mongoose logic probably had index on (reporter, reported).
                // Let's assume we want to prevent duplicate PENDING reports.
            }
        });
        
        if (existing) {
             return res.status(400).json({ error: "You have already submitted a pending report for this user." });
        }

        // 1. Create the Report document
        await prisma.report.create({
            data: {
                reporterId: reporterId,
                reportedId: reportedUserId,
                reason: String(reason).trim().substring(0, 255), // Truncate reason for safety
                status: 'pending',
                targetType: 'user',
                targetId: reportedUserId
            }
        });
        
        // 2. Check and execute auto-ban logic asynchronously
        checkAndAutoBan(reportedUserId, AUTO_DELETE_THRESHOLD);

        console.log(`[POST /reports/user] Report successfully submitted by ${reporterId}.`);
        
        // Success response
        res.status(201).json({ message: "User reported and blocked successfully. Review will follow." });

    } catch (e) {
        console.error("💥 POST /api/reports/user ERROR:", e);
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

    try {
        // Find all reports against this user that are currently 'pending' and update their status
        const result = await prisma.report.updateMany({
            where: { reportedId: userId, status: 'pending' },
            data: { status: 'resolved' }
        });

        console.log(`✅ Reports resolved for user ${userId}. Count: ${result.count}`);

        // Note: You must manually refresh the Admin Panel after this action!
        res.json({ 
            message: `${result.count} Reports resolved and cleared from queue.`,
            resolvedCount: result.count
        });

    } catch (e) {
        console.error("💥 PATCH /api/reports/admin/:userId/resolve ERROR:", e);
        res.status(500).json({ error: "Failed to resolve reports." });
    }
});

module.exports = router;