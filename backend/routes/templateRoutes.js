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
 * @route   GET /api/admin/templates
 * @desc    Get all unique custom and religion communities (Templates)
 * @access  Admin/Mod
 */
router.get('/templates', authenticate, requireModerator, async (req, res) => {
    try {
        const communities = await prisma.community.findMany({
            where: {
                type: { in: ['custom', 'religion'] }
            },
            select: { name: true, type: true, imageUrl: true }
        });

        // Group by name
        const templateMap = {};
        for (const c of communities) {
            if (!templateMap[c.name]) {
                templateMap[c.name] = {
                    name: c.name,
                    type: c.type,
                    imageUrl: c.imageUrl,
                    count: 0
                };
            }
            templateMap[c.name].count += 1;
            // If any instance has an image, use it for the template
            if (c.imageUrl && !templateMap[c.name].imageUrl) {
                templateMap[c.name].imageUrl = c.imageUrl;
            }
        }

        const templates = Object.values(templateMap).sort((a, b) => a.name.localeCompare(b.name));

        res.status(200).json({ items: templates });
    } catch (error) {
        console.error('GET /api/admin/templates error:', error);
        return res.status(500).json({ error: 'Failed to get templates' });
    }
});

/**
 * @route   PATCH /api/admin/templates/bulk-image
 * @desc    Bulk update images for all communities matching a template name
 * @access  Admin/Mod
 */
router.patch('/templates/bulk-image', authenticate, requireModerator, async (req, res) => {
    try {
        const { templateName, imageUrl } = req.body;

        if (!templateName || !imageUrl) {
            return res.status(400).json({ error: 'templateName and imageUrl are required' });
        }

        const result = await prisma.community.updateMany({
            where: {
                name: { equals: templateName, mode: 'insensitive' }
            },
            data: { imageUrl }
        });

        res.status(200).json({
            message: `Updated ${result.count} communities`,
            count: result.count
        });
    } catch (error) {
        console.error('PATCH /api/admin/templates/bulk-image error:', error);
        return res.status(500).json({ error: 'Failed to bulk update communities' });
    }
});

/**
 * Helper to slugify
 */
function slugify(str = "") {
    return String(str)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "")
        .replace(/\-+/g, "-");
}

/**
 * @route   POST /api/admin/colleges
 * @desc    Create a new college and auto-seed its template communities
 * @access  Admin/Mod
 */
router.post('/colleges', authenticate, requireModerator, async (req, res) => {
    try {
        const { name, key, emailDomains } = req.body;

        if (!name || !key || !emailDomains) {
            return res.status(400).json({ error: 'name, key, and emailDomains are required' });
        }

        // Check if college exists
        const existing = await prisma.college.findFirst({
            where: { OR: [{ name }, { key }] }
        });

        if (existing) {
            return res.status(400).json({ error: 'College with this name or key already exists' });
        }

        // 1. Create the primary community for the college
        const collegeCommunity = await prisma.community.create({
            data: {
                name,
                key: key,
                slug: key,
                type: 'college',
                isPrivate: false,
                tags: ['college', key]
            }
        });

        // 2. Create the college
        const college = await prisma.college.create({
            data: {
                name,
                key,
                emailDomains: Array.isArray(emailDomains) ? emailDomains : emailDomains.split(',').map(d => d.trim()),
                communityId: collegeCommunity.id
            }
        });

        // 3. Auto-seed the templates
        const uniqueTemplates = await prisma.community.findMany({
            where: { type: 'custom' }, // We only auto-seed custom (countries). Religions are global.
            select: { name: true, type: true, tags: true, imageUrl: true },
            distinct: ['name']
        });

        const createdCommunities = [];

        for (const template of uniqueTemplates) {
            const templateSlug = slugify(template.name);
            const uniqueSlug = `${college.key}-${templateSlug}`;
            const tags = ["country", "international", templateSlug, college.key];

            // Create college-specific custom community
            const comm = await prisma.community.upsert({
                where: { slug: uniqueSlug },
                update: {
                    name: template.name,
                    key: uniqueSlug,
                    type: "custom",
                    isPrivate: false,
                    tags,
                    imageUrl: template.imageUrl
                },
                create: {
                    name: template.name,
                    key: uniqueSlug,
                    slug: uniqueSlug,
                    type: "custom",
                    isPrivate: false,
                    tags,
                    imageUrl: template.imageUrl
                }
            });
            createdCommunities.push(comm);
        }

        res.status(201).json({
            college,
            collegeCommunity,
            autoSeededCount: createdCommunities.length
        });
    } catch (error) {
        console.error('POST /api/admin/colleges error:', error);
        return res.status(500).json({ error: 'Failed to create college' });
    }
});

module.exports = router;
