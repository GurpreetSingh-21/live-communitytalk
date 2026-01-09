const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const authenticate = require('../middleware/authenticate');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Middleware to check if user is admin or mod
const requireModerator = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { role: true }
        });

        if (!user || (user.role !== 'admin' && user.role !== 'mod')) {
            console.log('[DEBUG] requireModerator: Access denied for user', req.user.id, 'role:', user ? user.role : 'not found');
            return res.status(403).json({ error: 'Access denied. Moderator privileges required.' });
        }

        req.user.role = user.role;
        next();
    } catch (err) {
        console.error('requireModerator middleware error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * @route   POST /api/admin/login
 * @desc    Login for admin/moderator
 * @access  Admin / Mod
 */
router.post('/login', async (req, res) => {
    console.log('[DEBUG] Admin login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            console.log('[DEBUG] Missing email or password');
            return res.status(400).json({ error: 'Please provide email and password' });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.role !== 'admin' && user.role !== 'mod') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        console.log('[DEBUG] Password match result:', isMatch);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const payload = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        jwt.sign(
            payload,
            process.env.MY_SECRET_KEY,
            { expiresIn: '12h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, name: user.fullName, role: user.role } });
            }
        );
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @route   GET /api/admin/dating/profiles/pending
 * @desc    Get pending dating profiles
 * @access  Admin/Mod
 */
router.get('/dating/profiles/pending', authenticate, requireModerator, async (req, res) => {
    try {
        const profiles = await prisma.datingProfile.findMany({
            where: { approvalStatus: 'PENDING' },
            include: { user: true, photos: true }
        });

        // Map to frontend format with _id
        const items = profiles.map(p => ({
            ...p,
            _id: p.id
        }));

        res.status(200).json({ profiles: items });
    } catch (error) {
        console.error('GET /api/admin/dating/profiles/pending error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @route   PUT /api/admin/dating/profiles/:id/approve
 * @desc    Approve dating profile
 * @access  Admin/Mod
 */
router.put('/dating/profiles/:id/approve', authenticate, requireModerator, async (req, res) => {
    try {
        const updatedProfile = await prisma.datingProfile.update({
            where: { id: req.params.id },
            data: { approvalStatus: 'APPROVED', isProfileVisible: true }
        });
        res.status(200).json(updatedProfile);
    } catch (error) {
        console.error('PUT /api/admin/dating/profiles/:id/approve error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @route   PUT /api/admin/dating/profiles/:id/reject
 * @desc    Reject/Suspend dating profile
 * @access  Admin/Mod
 */
router.put('/dating/profiles/:id/reject', authenticate, requireModerator, async (req, res) => {
    try {
        const updatedProfile = await prisma.datingProfile.update({
            where: { id: req.params.id },
            data: { approvalStatus: 'REJECTED', isProfileVisible: false, rejectionReason: req.body.reason || 'Rejected by moderator' }
        });
        res.status(200).json(updatedProfile);
    } catch (error) {
        console.error('PUT /api/admin/dating/profiles/:id/reject error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @route   GET /api/admin/communities
 * @desc    Get all communities
 * @access  Admin/Mod
 */
router.get('/communities', authenticate, requireModerator, async (req, res) => {
    try {
        const { q, type, includePrivate, limit = 400 } = req.query;

        const where = {};
        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { key: { contains: q, mode: 'insensitive' } }
            ];
        }
        if (type) where.type = type;
        if (includePrivate !== 'true') where.isPrivate = false;

        const communities = await prisma.community.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        });

        // Count by type
        const counts = await prisma.community.groupBy({
            by: ['type'],
            _count: { id: true }
        });

        const summary = {
            total: communities.length,
            byType: counts.reduce((acc, item) => {
                acc[item.type] = item._count.id;
                return acc;
            }, {})
        };

        // Map to frontend format with _id
        // IMPORTANT: Rename 'key' to 'communityKey' to avoid React interpreting it as key prop
        const items = communities.map(c => {
            const { key, ...rest } = c;
            return {
                ...rest,
                _id: c.id,
                communityKey: key  // renamed from 'key' to avoid React conflicts
            };
        });

        const totalCount = await prisma.community.count({ where });

        res.status(200).json({
            items,
            total: totalCount,
            page: 1,
            limit: parseInt(limit),
            pages: Math.ceil(totalCount / parseInt(limit)),
            summary
        });
    } catch (error) {
        console.error('GET /api/admin/communities error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @route   POST /api/admin/communities
 * @desc    Create a new community
 * @access  Admin/Mod
 */
router.post('/communities', authenticate, requireModerator, async (req, res) => {
    try {
        const { name, type, key, isPrivate, tags, imageUrl } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Community name is required' });
        }

        // Generate key from name if not provided
        const communityKey = key?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Generate slug
        const slug = communityKey;

        // Check for duplicate key
        const existing = await prisma.community.findFirst({
            where: { OR: [{ key: communityKey }, { slug }] }
        });

        if (existing) {
            return res.status(400).json({ error: 'A community with this key already exists' });
        }

        const community = await prisma.community.create({
            data: {
                name: name.trim(),
                type: type || 'custom',
                key: communityKey,
                slug,
                isPrivate: isPrivate || false,
                tags: tags || [],
                imageUrl: imageUrl || null,
                createdBy: req.user.id
            }
        });

        res.status(201).json({
            ...community,
            _id: community.id,
            communityKey: community.key
        });
    } catch (error) {
        console.error('POST /api/admin/communities error:', error);
        return res.status(500).json({ error: 'Failed to create community' });
    }
});

/**
 * @route   PATCH /api/admin/communities/bulk/image
 * @desc    Bulk update images for communities matching a name pattern
 * @access  Admin/Mod
 * IMPORTANT: This route MUST come before /communities/:id to avoid route conflicts
 */
router.patch('/communities/bulk/image', authenticate, requireModerator, async (req, res) => {
    try {
        const { communityName, imageUrl } = req.body;

        if (!communityName || !imageUrl) {
            return res.status(400).json({ error: 'communityName and imageUrl are required' });
        }

        // Find all communities with the matching name (case-insensitive)
        const communities = await prisma.community.findMany({
            where: {
                name: { equals: communityName, mode: 'insensitive' }
            }
        });

        if (communities.length === 0) {
            return res.status(404).json({ error: 'No communities found with that name' });
        }

        // Update all matching communities
        const result = await prisma.community.updateMany({
            where: {
                name: { equals: communityName, mode: 'insensitive' }
            },
            data: { imageUrl }
        });

        res.status(200).json({
            message: `Updated ${result.count} communities`,
            count: result.count
        });
    } catch (error) {
        console.error('PATCH /api/admin/communities/bulk/image error:', error);
        return res.status(500).json({ error: 'Failed to bulk update communities' });
    }
});

/**
 * @route   GET /api/admin/communities/names
 * @desc    Get unique community names for bulk operations
 * @access  Admin/Mod
 * IMPORTANT: This route MUST come before /communities/:id to avoid route conflicts
 */
router.get('/communities/names', authenticate, requireModerator, async (req, res) => {
    try {
        const communities = await prisma.community.findMany({
            select: { name: true },
            orderBy: { name: 'asc' }
        });

        // Get unique names with counts
        const nameMap = communities.reduce((acc, c) => {
            acc[c.name] = (acc[c.name] || 0) + 1;
            return acc;
        }, {});

        const uniqueNames = Object.entries(nameMap).map(([name, count]) => ({
            name,
            count
        })).sort((a, b) => a.name.localeCompare(b.name));

        res.status(200).json({ names: uniqueNames });
    } catch (error) {
        console.error('GET /api/admin/communities/names error:', error);
        return res.status(500).json({ error: 'Failed to get community names' });
    }
});

/**
 * @route   PATCH /api/admin/communities/:id
 * @desc    Update a community
 * @access  Admin/Mod
 */
router.patch('/communities/:id', authenticate, requireModerator, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, key, isPrivate, tags, imageUrl } = req.body;

        const existing = await prisma.community.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Community not found' });
        }

        const updateData = {};

        if (name !== undefined) updateData.name = name.trim();
        if (key !== undefined) updateData.key = key.trim();
        if (isPrivate !== undefined) updateData.isPrivate = isPrivate;
        if (tags !== undefined) updateData.tags = tags;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

        const community = await prisma.community.update({
            where: { id },
            data: updateData
        });

        res.status(200).json({
            ...community,
            _id: community.id,
            communityKey: community.key
        });
    } catch (error) {
        console.error('PATCH /api/admin/communities/:id error:', error);
        return res.status(500).json({ error: 'Failed to update community' });
    }
});

/**
 * @route   DELETE /api/admin/communities/:id
 * @desc    Delete a community
 * @access  Admin/Mod
 */
router.delete('/communities/:id', authenticate, requireModerator, async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await prisma.community.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Community not found' });
        }

        await prisma.community.delete({ where: { id } });

        res.status(200).json({ message: 'Community deleted successfully' });
    } catch (error) {
        console.error('DELETE /api/admin/communities/:id error:', error);
        return res.status(500).json({ error: 'Failed to delete community' });
    }
});

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get moderation dashboard statistics
 * @access  Admin/Mod
 */
router.get('/dashboard/stats', authenticate, requireModerator, async (req, res) => {
    try {
        const [
            pendingReports,
            pendingPhotos,
            pendingAppeals,
            activeBans,
            activeSuspensions,
            totalStrikesIssued,
            reportsResolvedToday
        ] = await Promise.all([
            prisma.report.count({ where: { status: 'PENDING' } }),
            prisma.datingPhoto.count({ where: { status: 'PENDING' } }),
            prisma.appeal.count({ where: { status: 'PENDING' } }),
            prisma.user.count({ where: { accountStatus: 'BANNED' } }),
            prisma.user.count({ where: { accountStatus: 'SUSPENDED' } }),
            prisma.strike.count({ where: { active: true } }),
            prisma.report.count({
                where: {
                    status: { in: ['RESOLVED', 'DISMISSED'] },
                    updatedAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            })
        ]);

        // Strike distribution
        const strikeDistribution = await prisma.user.groupBy({
            by: ['strikeCount'],
            _count: { strikeCount: true },
            where: { strikeCount: { gt: 0 } }
        });

        res.status(200).json({
            pendingReviews: {
                reports: pendingReports,
                photos: pendingPhotos,
                appeals: pendingAppeals
            },
            userStatus: {
                activeBans,
                activeSuspensions
            },
            strikes: {
                totalActive: totalStrikesIssued,
                distribution: strikeDistribution
            },
            reportsResolvedToday
        });
    } catch (err) {
        console.error('GET /api/admin/dashboard/stats error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   GET /api/admin/photos/pending
 * @desc    Get pending photos for review
 * @access  Admin/Mod
 */
router.get('/photos/pending', authenticate, requireModerator, async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;

        const photos = await prisma.datingPhoto.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            take: parseInt(limit),
            skip: parseInt(offset),
            include: {
                datingProfile: {
                    select: {
                        userId: true,
                        user: {
                            select: { id: true, fullName: true, email: true }
                        }
                    }
                },
                reports: {
                    where: { status: 'PENDING' },
                    select: { id: true, reason: true, details: true }
                }
            }
        });

        const total = await prisma.datingPhoto.count({ where: { status: 'PENDING' } });

        res.status(200).json({
            items: photos,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: total > parseInt(offset) + photos.length
            }
        });
    } catch (err) {
        console.error('GET /api/admin/photos/pending error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   PUT /api/admin/photos/:id/approve
 * @desc    Approve a photo
 * @access  Admin/Mod
 */
router.put('/photos/:id/approve', authenticate, requireModerator, async (req, res) => {
    try {
        const photoId = req.params.id;
        const moderatorId = req.user.id;

        const photo = await prisma.datingPhoto.update({
            where: { id: photoId },
            data: {
                status: 'APPROVED',
                reviewedBy: moderatorId,
                reviewedAt: new Date()
            }
        });

        // Log the action
        await prisma.moderationLog.create({
            data: {
                action: 'photo_approved',
                targetType: 'photo',
                targetId: photoId,
                moderatorId,
                reason: 'Manual review - approved'
            }
        });

        // Resolve any pending photo reports
        await prisma.photoReport.updateMany({
            where: { photoId, status: 'PENDING' },
            data: {
                status: 'DISMISSED',
                reviewedBy: moderatorId,
                reviewedAt: new Date()
            }
        });

        res.status(200).json({
            message: 'Photo approved successfully',
            photo
        });
    } catch (err) {
        console.error('PUT /api/admin/photos/:id/approve error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   PUT /api/admin/photos/:id/reject
 * @desc    Reject a photo
 * @access  Admin/Mod
 */
router.put('/photos/:id/reject', authenticate, requireModerator, async (req, res) => {
    try {
        const photoId = req.params.id;
        const moderatorId = req.user.id;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        const photo = await prisma.datingPhoto.update({
            where: { id: photoId },
            data: {
                status: 'REJECTED',
                rejectionReason: reason,
                reviewedBy: moderatorId,
                reviewedAt: new Date()
            },
            include: {
                datingProfile: { select: { userId: true } }
            }
        });

        // Log the action
        await prisma.moderationLog.create({
            data: {
                action: 'photo_rejected',
                targetType: 'photo',
                targetId: photoId,
                moderatorId,
                reason,
                userId: photo.datingProfile.userId
            }
        });

        // Resolve photo reports
        await prisma.photoReport.updateMany({
            where: { photoId, status: 'PENDING' },
            data: {
                status: 'RESOLVED',
                reviewedBy: moderatorId,
                reviewedAt: new Date()
            }
        });

        res.status(200).json({
            message: 'Photo rejected successfully',
            photo
        });
    } catch (err) {
        console.error('PUT /api/admin/photos/:id/reject error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   GET /api/admin/reports
 * @desc    Get all reports for review
 * @access  Admin/Mod
 */
router.get('/reports', authenticate, requireModerator, async (req, res) => {
    try {
        const { status = 'PENDING', priority, limit = 50, offset = 0 } = req.query;

        const where = {};
        if (status !== 'ALL') where.status = status;
        if (priority) where.priority = priority;

        const reports = await prisma.report.findMany({
            where,
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'asc' }
            ],
            take: parseInt(limit),
            skip: parseInt(offset),
            include: {
                reporter: {
                    select: { id: true, fullName: true, email: true }
                },
                reported: {
                    select: { id: true, fullName: true, email: true, reportsReceivedCount: true, strikeCount: true }
                }
            }
        });

        const total = await prisma.report.count({ where });

        res.status(200).json({
            items: reports,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: total > parseInt(offset) + reports.length
            }
        });
    } catch (err) {
        console.error('GET /api/admin/reports error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   GET /api/admin/reports/:id
 * @desc    Get detailed report information
 * @access  Admin/Mod
 */
router.get('/reports/:id', authenticate, requireModerator, async (req, res) => {
    try {
        const report = await prisma.report.findUnique({
            where: { id: req.params.id },
            include: {
                reporter: {
                    select: { id: true, fullName: true, email: true }
                },
                reported: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        reportsReceivedCount: true,
                        strikeCount: true,
                        accountStatus: true,
                        datingProfile: {
                            select: {
                                id: true,
                                photos: {
                                    select: { id: true, url: true, status: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Get reported user's previous strikes
        const previousStrikes = await prisma.strike.findMany({
            where: { userId: report.reportedId, active: true },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        res.status(200).json({
            report,
            previousStrikes
        });
    } catch (err) {
        console.error('GET /api/admin/reports/:id error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   PUT /api/admin/reports/:id/resolve
 * @desc    Resolve a report with action
 * @access  Admin/Mod
 */
router.put('/reports/:id/resolve', authenticate, requireModerator, async (req, res) => {
    try {
        const reportId = req.params.id;
        const moderatorId = req.user.id;
        const { action, reviewNotes, strikeSeverity, suspendDays, banPermanent } = req.body;

        // Valid actions: warning, strike, suspend, ban, dismissed
        if (!['warning', 'strike', 'suspend', 'ban', 'dismissed'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action type' });
        }

        const report = await prisma.report.findUnique({
            where: { id: reportId },
            select: { reportedId: true, reason: true }
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Update report
        await prisma.report.update({
            where: { id: reportId },
            data: {
                status: action === 'dismissed' ? 'DISMISSED' : 'RESOLVED',
                reviewedBy: moderatorId,
                reviewedAt: new Date(),
                reviewNotes,
                actionTaken: action
            }
        });

        const reportedId = report.reportedId;

        // Execute action
        if (action === 'warning' || action === 'strike') {
            // Issue strike
            const strike = await prisma.strike.create({
                data: {
                    userId: reportedId,
                    reason: `Report resolved: ${report.reason}`,
                    severity: strikeSeverity || 'MINOR',
                    details: reviewNotes,
                    reportId,
                    issuedBy: moderatorId,
                    expiresAt: action === 'warning' ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : null // Warnings expire in 90 days
                }
            });

            // Update user strike count
            const user = await prisma.user.update({
                where: { id: reportedId },
                data: {
                    strikeCount: { increment: 1 },
                    lastStrikeAt: new Date()
                },
                select: { strikeCount: true }
            });

            // Auto-escalate based on strike count
            if (user.strikeCount >= 3) {
                // 3 strikes = permanent ban
                await prisma.user.update({
                    where: { id: reportedId },
                    data: {
                        accountStatus: 'BANNED',
                        bannedAt: new Date(),
                        bannedReason: 'Three strikes - permanent ban'
                    }
                });
            } else if (user.strikeCount === 2) {
                // 2 strikes = 30 day suspension
                const suspendUntil = new Date();
                suspendUntil.setDate(suspendUntil.getDate() + 30);

                await prisma.user.update({
                    where: { id: reportedId },
                    data: {
                        accountStatus: 'SUSPENDED',
                        suspendedUntil,
                        suspendedReason: 'Second strike - 30 day suspension'
                    }
                });
            }

            // Log strike
            await prisma.moderationLog.create({
                data: {
                    action: action === 'warning' ? 'warning_issued' : 'strike_issued',
                    targetType: 'user',
                    targetId: reportedId,
                    moderatorId,
                    reason: reviewNotes,
                    details: { reportId, strikeId: strike.id },
                    userId: reportedId,
                    reportId,
                    strikeId: strike.id
                }
            });
        } else if (action === 'suspend') {
            // Suspend user
            const suspendUntil = new Date();
            suspendUntil.setDate(suspendUntil.getDate() + (suspendDays || 7));

            await prisma.user.update({
                where: { id: reportedId },
                data: {
                    accountStatus: 'SUSPENDED',
                    suspendedUntil,
                    suspendedReason: reviewNotes || 'Violation of community guidelines'
                }
            });

            await prisma.moderationLog.create({
                data: {
                    action: 'user_suspended',
                    targetType: 'user',
                    targetId: reportedId,
                    moderatorId,
                    reason: reviewNotes,
                    details: { reportId, suspendDays: suspendDays || 7 },
                    userId: reportedId,
                    reportId
                }
            });
        } else if (action === 'ban') {
            // Ban user
            await prisma.user.update({
                where: { id: reportedId },
                data: {
                    accountStatus: 'BANNED',
                    bannedAt: new Date(),
                    bannedReason: reviewNotes || 'Violation of community guidelines'
                }
            });

            await prisma.moderationLog.create({
                data: {
                    action: 'user_banned',
                    targetType: 'user',
                    targetId: reportedId,
                    moderatorId,
                    reason: reviewNotes,
                    details: { reportId, permanent: banPermanent !== false },
                    userId: reportedId,
                    reportId
                }
            });
        } else if (action === 'dismissed') {
            // Just log the dismissal
            await prisma.moderationLog.create({
                data: {
                    action: 'report_dismissed',
                    targetType: 'report',
                    targetId: reportId,
                    moderatorId,
                    reason: reviewNotes,
                    details: { reportId },
                    reportId
                }
            });
        }

        res.status(200).json({
            message: `Report resolved with action: ${action}`,
            reportId
        });
    } catch (err) {
        console.error('PUT /api/admin/reports/:id/resolve error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   GET /api/admin/appeals
 * @desc    Get all appeals
 * @access  Admin/Mod
 */
router.get('/appeals', authenticate, requireModerator, async (req, res) => {
    try {
        const { status = 'PENDING', limit = 50, offset = 0 } = req.query;

        const where = status !== 'ALL' ? { status } : {};

        const appeals = await prisma.appeal.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: parseInt(limit),
            skip: parseInt(offset),
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        strikeCount: true,
                        accountStatus: true
                    }
                }
            }
        });

        const total = await prisma.appeal.count({ where });

        res.status(200).json({
            items: appeals,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: total > parseInt(offset) + appeals.length
            }
        });
    } catch (err) {
        console.error('GET /api/admin/appeals error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   PUT /api/admin/appeals/:id/review
 * @desc    Review an appeal
 * @access  Admin
 */
router.put('/appeals/:id/review', authenticate, requireModerator, async (req, res) => {
    try {
        const appealId = req.params.id;
        const moderatorId = req.user.id;
        const { decision, reviewNotes } = req.body;

        if (!['approved', 'denied', 'partial'].includes(decision)) {
            return res.status(400).json({ error: 'Invalid decision. Must be approved, denied, or partial' });
        }

        const appeal = await prisma.appeal.update({
            where: { id: appealId },
            data: {
                status: decision === 'approved' ? 'APPROVED' : decision === 'denied' ? 'DENIED' : 'UNDER_REVIEW',
                reviewedBy: moderatorId,
                reviewedAt: new Date(),
                reviewNotes,
                decision
            },
            include: { user: { select: { id: true } } }
        });

        // If approved, take action
        if (decision === 'approved') {
            if (appeal.type === 'STRIKE' && appeal.strikeId) {
                // Deactivate strike
                await prisma.strike.update({
                    where: { id: appeal.strikeId },
                    data: { active: false }
                });

                // Reduce strike count
                await prisma.user.update({
                    where: { id: appeal.userId },
                    data: { strikeCount: { decrement: 1 } }
                });
            } else if (appeal.type === 'SUSPENSION' || appeal.type === 'BAN') {
                // Restore account
                await prisma.user.update({
                    where: { id: appeal.userId },
                    data: {
                        accountStatus: 'ACTIVE',
                        suspendedUntil: null,
                        suspendedReason: null,
                        bannedAt: null,
                        bannedReason: null
                    }
                });
            }

            // Log
            await prisma.moderationLog.create({
                data: {
                    action: 'appeal_approved',
                    targetType: 'appeal',
                    targetId: appealId,
                    moderatorId,
                    reason: reviewNotes,
                    details: { appealType: appeal.type },
                    userId: appeal.userId
                }
            });
        }

        res.status(200).json({
            message: `Appeal ${decision}`,
            appeal
        });
    } catch (err) {
        console.error('PUT /api/admin/appeals/:id/review error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   GET /api/admin/logs
 * @desc    Get moderation logs
 * @access  Admin/Mod
 */
router.get('/logs', authenticate, requireModerator, async (req, res) => {
    try {
        const { limit = 100, offset = 0, action, moderatorId } = req.query;

        const where = {};
        if (action) where.action = action;
        if (moderatorId) where.moderatorId = moderatorId;

        const logs = await prisma.moderationLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset),
            include: {
                moderator: {
                    select: { id: true, fullName: true, email: true }
                }
            }
        });

        const total = await prisma.moderationLog.count({ where });

        res.status(200).json({
            items: logs,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: total > parseInt(offset) + logs.length
            }
        });
    } catch (err) {
        console.error('GET /api/admin/logs error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   GET /api/admin/users
 * @desc    Get users with filters
 * @access  Admin/Mod
 */
router.get('/users', authenticate, requireModerator, async (req, res) => {
    console.log('[DEBUG] GET /users endpoint hit');
    try {
        const { accountStatus, search, limit = 50, offset = 0 } = req.query;

        const where = {};
        if (accountStatus) where.accountStatus = accountStatus;
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        const users = await prisma.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset),
            select: {
                id: true,
                fullName: true,
                email: true,
                createdAt: true,
                accountStatus: true,
                strikeCount: true,
                reportsReceivedCount: true,
                suspendedUntil: true,
                bannedAt: true,
                profileVerified: true,
                photoVerified: true,
                role: true
            }
        });

        // Compute stats for summary
        const totalCount = await prisma.user.count({ where });
        const adminsCount = await prisma.user.count({ where: { role: 'admin' } });
        const modsCount = await prisma.user.count({ where: { role: 'mod' } });
        const datingCount = await prisma.user.count({ where: { hasDatingProfile: true } });

        // Map users to include _id for frontend compatibility
        const items = users.map(u => ({
            ...u,
            _id: u.id
        }));

        res.status(200).json({
            users, // Keep original for safely
            items, // Add items for frontend
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: totalCount > parseInt(offset) + users.length
            },
            summary: {
                total: totalCount,
                admins: adminsCount,
                mods: modsCount,
                withDating: datingCount
            }
        });
    } catch (err) {
        console.error('GET /api/admin/users error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   PUT /api/admin/users/:id/suspend
 * @desc    Suspend a user
 * @access  Admin
 */
router.put('/users/:id/suspend', authenticate, requireModerator, async (req, res) => {
    try {
        const userId = req.params.id;
        const moderatorId = req.user.id;
        const { days = 7, reason } = req.body;

        const suspendUntil = new Date();
        suspendUntil.setDate(suspendUntil.getDate() + parseInt(days));

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                accountStatus: 'SUSPENDED',
                suspendedUntil,
                suspendedReason: reason || 'Suspended by administrator'
            }
        });

        // Log
        await prisma.moderationLog.create({
            data: {
                action: 'user_suspended',
                targetType: 'user',
                targetId: userId,
                moderatorId,
                reason,
                details: { days: parseInt(days) },
                userId
            }
        });

        res.status(200).json({
            message: `User suspended until ${suspendUntil.toISOString()}`,
            user
        });
    } catch (err) {
        console.error('PUT /api/admin/users/:id/suspend error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   PUT /api/admin/users/:id/ban
 * @desc    Ban a user permanently
 * @access  Admin
 */
router.put('/users/:id/ban', authenticate, requireModerator, async (req, res) => {
    try {
        const userId = req.params.id;
        const moderatorId = req.user.id;
        const { reason } = req.body;

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                accountStatus: 'BANNED',
                bannedAt: new Date(),
                bannedReason: reason || 'Banned by administrator'
            }
        });

        // Log
        await prisma.moderationLog.create({
            data: {
                action: 'user_banned',
                targetType: 'user',
                targetId: userId,
                moderatorId,
                reason,
                details: { permanent: true },
                userId
            }
        });

        res.status(200).json({
            message: 'User permanently banned',
            user
        });
    } catch (err) {
        console.error('PUT /api/admin/users/:id/ban error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   PUT /api/admin/users/:id/restore
 * @desc    Restore a suspended/banned account
 * @access  Admin
 */
router.put('/users/:id/restore', authenticate, requireModerator, async (req, res) => {
    try {
        const userId = req.params.id;
        const moderatorId = req.user.id;

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                accountStatus: 'ACTIVE',
                suspendedUntil: null,
                suspendedReason: null,
                bannedAt: null,
                bannedReason: null
            }
        });

        // Log
        await prisma.moderationLog.create({
            data: {
                action: 'user_restored',
                targetType: 'user',
                targetId: userId,
                moderatorId,
                reason: 'Account restored to active status',
                userId
            }
        });

        res.status(200).json({
            message: 'User account restored',
            user
        });
    } catch (err) {
        console.error('PUT /api/admin/users/:id/restore error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;