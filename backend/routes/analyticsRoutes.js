const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const authenticate = require('../middleware/authenticate');

// Middleware to check if user is admin or mod
const requireModerator = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { role: true }
        });

        if (!user || (user.role !== 'admin' && user.role !== 'mod')) {
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
 * @route   GET /api/admin/analytics/overview
 * @desc    Get high-level system analytics
 * @access  Admin/Mod
 */
router.get('/overview', authenticate, requireModerator, async (req, res) => {
    try {
        // Time boundaries
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Core counts
        const [
            totalUsers,
            usersToday,
            totalMessages,
            messagesToday,
            totalCommunities,
            totalColleges,
            activeDatingProfiles,
            totalMatches
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
            prisma.message.count(),
            prisma.message.count({ where: { createdAt: { gte: startOfToday } } }),
            prisma.community.count(),
            prisma.college.count(),
            prisma.datingProfile.count({ where: { approvalStatus: 'APPROVED', isPaused: false } }),
            prisma.datingMatch.count({ where: { isActive: true } })
        ]);

        // Daily users chart data (last 7 days)
        const userGrowthRaw = await prisma.$queryRaw`
            SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*) as count
            FROM "users"
            WHERE "createdAt" >= ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY day ASC
        `;

        const userGrowth = userGrowthRaw.map(r => ({
            date: new Date(r.day).toISOString().split('T')[0],
            count: Number(r.count)
        }));

        res.status(200).json({
            users: {
                total: totalUsers,
                today: usersToday,
                growth: userGrowth
            },
            engagement: {
                totalMessages,
                messagesToday
            },
            dating: {
                activeProfiles: activeDatingProfiles,
                matches: totalMatches
            },
            infrastructure: {
                colleges: totalColleges,
                communities: totalCommunities
            }
        });
    } catch (err) {
        console.error('GET /api/admin/analytics/overview error:', err);
        return res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

module.exports = router;
