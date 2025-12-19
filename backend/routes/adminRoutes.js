// backend/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const authMiddleware = require("../middleware/authenticate");
const requireAdmin = require("../middleware/requireAdmin");

// Apply auth + admin check to all routes in this file
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/admin/reports
 * List all reports (pending first)
 * Returns { items: [] } to match frontend
 */
router.get("/reports", async (req, res) => {
    try {
        const reports = await prisma.report.findMany({
            // where: { status: 'pending' }, // Optional: Filter if needed
            include: {
                reporter: {
                    select: { id: true, firstName: true, email: true }
                },
                reported: {
                    // Flattened 'reportedUser' structure helper might be needed if frontend expects specific shape
                    // Frontend expects: reportedUser: { _id, fullName, email, role, reportsReceivedCount, ... }
                    select: {
                        id: true,
                        firstName: true,
                        fullName: true, // Check if this exists in schema
                        email: true,
                        role: true,
                        reportsReceivedCount: true,
                        isPermanentlyDeleted: true,
                        isActive: true,
                        datingProfile: true
                    }
                }
            },
            orderBy: [
                { status: 'asc' },
                { createdAt: 'desc' }
            ]
        });

        // Transform to match frontend ReportItem type
        const items = reports.map(r => ({
            _id: r.id,
            reportCount: r.reported.reportsReceivedCount, // Or count unique reports from DB relation
            reasons: [r.reason], // Frontend expects array
            lastReportedAt: r.createdAt,
            reportedUser: {
                _id: r.reported.id,
                fullName: r.reported.fullName || r.reported.firstName || "Unknown",
                email: r.reported.email,
                role: r.reported.role,
                reportsReceivedCount: r.reported.reportsReceivedCount,
                isPermanentlyDeleted: r.reported.isPermanentlyDeleted,
                isActive: r.reported.isActive
            }
        }));

        res.json({ items });
    } catch (err) {
        console.error("GET /api/admin/reports error", err);
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * PATCH /api/admin/people/:userId/:action
 * Handle Ban / Deactivate / Unban
 */
router.patch("/people/:userId/:action", async (req, res) => {
    try {
        const { userId, action } = req.params;

        let userUpdate = {};
        let profileUpdate = {};

        switch (action) {
            case 'ban': // Permanent ban
                userUpdate = { isActive: false, isPermanentlyDeleted: true };
                profileUpdate = { isPaused: true, isProfileVisible: false };
                break;
            case 'deactivate': // Mute / Freeze
                userUpdate = { isActive: false };
                profileUpdate = { isProfileVisible: false };
                break;
            case 'unban': // Reactivate
                userUpdate = { isActive: true, isPermanentlyDeleted: false };
                profileUpdate = { isProfileVisible: true }; // Or leave previous state?
                break;
            default:
                return res.status(400).json({ error: "Invalid action" });
        }

        // 1. Update User
        await prisma.user.update({
            where: { id: userId },
            data: userUpdate
        });

        // 2. Update Dating Profile (if exists)
        // Using updateMany to avoid 404 if no dating profile
        await prisma.datingProfile.updateMany({
            where: { userId },
            data: profileUpdate
        });

        res.json({ message: `User ${action} successful` });

    } catch (err) {
        console.error(`PATCH /people/${req.params.userId}/${req.params.action} error`, err);
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * GET /api/admin/stats
 * Quick stats
 */
router.get("/stats", async (req, res) => {
    try {
        const userCount = await prisma.user.count();
        const datingProfileCount = await prisma.datingProfile.count();
        const reportCount = await prisma.report.count({ where: { status: 'pending' } });
        const matchCount = await prisma.datingMatch.count();

        res.json({
            users: userCount,
            datingProfiles: datingProfileCount,
            pendingReports: reportCount,
            matches: matchCount
        });
    } catch (err) {
        console.error("GET /api/admin/stats error", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;