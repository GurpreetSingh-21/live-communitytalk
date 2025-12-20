const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const authenticate = require('../middleware/authenticate');

/**
 * @route   POST /api/safety/report
 * @desc    Create a report against another user
 * @access  Private
 */
router.post('/report', authenticate, async (req, res) => {
    try {
        const reporterId = req.user.id;
        const {
            reportedId,
            reason,
            category,
            details,
            targetType,
            targetId,
            screenshots = []
        } = req.body;

        // Validation
        if (!reportedId || !reason) {
            return res.status(400).json({ error: 'reportedId and reason are required' });
        }

        // Cannot report yourself
        if (reporterId === reportedId) {
            return res.status(400).json({ error: 'You cannot report yourself' });
        }

        // Check if reported user exists
        const reportedUser = await prisma.user.findUnique({
            where: { id: reportedId },
            select: { id: true, reportsReceivedCount: true }
        });

        if (!reportedUser) {
            return res.status(404).json({ error: 'Reported user not found' });
        }

        // Create the report
        const report = await prisma.report.create({
            data: {
                reporterId,
                reportedId,
                reason,
                category,
                details,
                targetType: targetType || 'profile',
                targetId,
                screenshots,
                // Auto-prioritize based on previous reports
                priority: reportedUser.reportsReceivedCount >= 3 ? 'URGENT' :
                    reportedUser.reportsReceivedCount >= 1 ? 'HIGH' : 'NORMAL'
            },
            include: {
                reporter: { select: { id: true, fullName: true, email: true } },
                reported: { select: { id: true, fullName: true, email: true, reportsReceivedCount: true } }
            }
        });

        // Update report count
        await prisma.user.update({
            where: { id: reportedId },
            data: { reportsReceivedCount: { increment: 1 } }
        });

        // Auto-suspend if 3+ reports
        if (reportedUser.reportsReceivedCount + 1 >= 3) {
            const suspendUntil = new Date();
            suspendUntil.setDate(suspendUntil.getDate() + 7); // 7 day suspension

            await prisma.user.update({
                where: { id: reportedId },
                data: {
                    accountStatus: 'SUSPENDED',
                    suspendedUntil,
                    suspendedReason: 'Automatic suspension due to multiple reports pending review'
                }
            });

            // Log the action
            await prisma.moderationLog.create({
                data: {
                    action: 'auto_suspend',
                    targetType: 'user',
                    targetId: reportedId,
                    moderatorId: reporterId, // System action triggered by report
                    reason: 'Auto-suspend: 3+ reports received',
                    details: { reportId: report.id, reportCount: reportedUser.reportsReceivedCount + 1 },
                    userId: reportedId
                }
            });
        }

        res.status(201).json({
            message: 'Report submitted successfully',
            report: {
                id: report.id,
                status: report.status,
                createdAt: report.createdAt
            }
        });
    } catch (err) {
        console.error('POST /api/safety/report error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   POST /api/safety/report/photo
 * @desc    Report a dating photo
 * @access  Private
 */
router.post('/report/photo', authenticate, async (req, res) => {
    try {
        const reporterId = req.user.id;
        const { photoId, reason, details } = req.body;

        if (!photoId || !reason) {
            return res.status(400).json({ error: 'photoId and reason are required' });
        }

        // Check if photo exists
        const photo = await prisma.datingPhoto.findUnique({
            where: { id: photoId },
            include: { datingProfile: { select: { userId: true } } }
        });

        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Cannot report your own photo
        if (photo.datingProfile.userId === reporterId) {
            return res.status(400).json({ error: 'You cannot report your own photo' });
        }

        // Create photo report
        const photoReport = await prisma.photoReport.create({
            data: {
                reporterId,
                photoId,
                reason,
                details
            }
        });

        // Auto-reject photo if multiple reports
        const reportCount = await prisma.photoReport.count({
            where: { photoId, status: 'PENDING' }
        });

        if (reportCount >= 2) {
            await prisma.datingPhoto.update({
                where: { id: photoId },
                data: {
                    status: 'REJECTED',
                    rejectionReason: `Auto-rejected: Multiple reports (${reason})`
                }
            });
        }

        res.status(201).json({
            message: 'Photo report submitted successfully',
            reportId: photoReport.id
        });
    } catch (err) {
        console.error('POST /api/safety/report/photo error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   GET /api/safety/reports/my-reports
 * @desc    Get current user's submitted reports
 * @access  Private
 */
router.get('/reports/my-reports', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const reports = await prisma.report.findMany({
            where: { reporterId: userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                createdAt: true,
                reason: true,
                category: true,
                status: true,
                priority: true,
                targetType: true,
                actionTaken: true,
                reported: {
                    select: { fullName: true }
                }
            }
        });

        res.status(200).json({ reports });
    } catch (err) {
        console.error('GET /api/safety/reports/my-reports error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   GET /api/safety/strikes
 * @desc    Get current user's strikes
 * @access  Private
 */
router.get('/strikes', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const strikes = await prisma.strike.findMany({
            where: { userId, active: true },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                createdAt: true,
                reason: true,
                severity: true,
                details: true,
                expiresAt: true
            }
        });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { strikeCount: true, accountStatus: true, suspendedUntil: true }
        });

        res.status(200).json({
            strikes,
            strikeCount: user.strikeCount,
            accountStatus: user.accountStatus,
            suspendedUntil: user.suspendedUntil
        });
    } catch (err) {
        console.error('GET /api/safety/strikes error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   POST /api/safety/appeal
 * @desc    Submit an appeal
 * @access  Private
 */
router.post('/appeal', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, strikeId, reportId, reason } = req.body;

        if (!type || !reason) {
            return res.status(400).json({ error: 'type and reason are required' });
        }

        // Create appeal
        const appeal = await prisma.appeal.create({
            data: {
                userId,
                type,
                strikeId,
                reportId,
                reason
            }
        });

        res.status(201).json({
            message: 'Appeal submitted successfully. We will review it within 48 hours.',
            appealId: appeal.id
        });
    } catch (err) {
        console.error('POST /api/safety/appeal error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   GET /api/safety/appeals
 * @desc    Get current user's appeals
 * @access  Private
 */
router.get('/appeals', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const appeals = await prisma.appeal.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                type: true,
                reason: true,
                status: true,
                decision: true,
                reviewNotes: true,
                reviewedAt: true
            }
        });

        res.status(200).json({ appeals });
    } catch (err) {
        console.error('GET /api/safety/appeals error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/safety/verification/pose
 * @desc    Get a random active verification pose
 * @access  Private
 */
router.get('/verification/pose', authenticate, async (req, res) => {
    try {
        // Get all active poses
        const poses = await prisma.verificationPose.findMany({
            where: { isActive: true },
            select: { id: true, instruction: true, referenceImageUrl: true }
        });

        if (poses.length === 0) {
            return res.status(500).json({ error: 'No verification poses available' });
        }

        // Pick random
        const randomPose = poses[Math.floor(Math.random() * poses.length)];
        res.json(randomPose);
    } catch (err) {
        console.error('GET /api/safety/verification/pose error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   POST /api/safety/verification/submit
 * @desc    Submit a selfie for pose verification
 * @access  Private
 */
router.post('/verification/submit', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { poseId, photoUrl } = req.body;

        if (!poseId || !photoUrl) {
            return res.status(400).json({ error: 'Pose ID and Photo URL are required' });
        }

        // 1. Create Request
        const request = await prisma.verificationRequest.create({
            data: {
                userId,
                poseId,
                photoUrl,
                status: 'PENDING'
            }
        });

        // 2. Log needed? Maybe not yet.

        res.status(201).json({
            message: 'Verification submitted. We will review it shortly.',
            requestId: request.id
        });
    } catch (err) {
        console.error('POST /api/safety/verification/submit error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
