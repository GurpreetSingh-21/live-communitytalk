const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const authenticate = require("../middleware/authenticate");
const requireAdmin = require("../middleware/requireAdmin");
const prisma = require("../prisma/client");

const AUTO_DELETE_THRESHOLD = 7;
const ROOM = (id) => `community:${id}`;

const slugify = (s = "") =>
    String(s)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "")
        .replace(/\-+/g, "-");

const JWT_SECRET =
    process.env.MY_SECRET_KEY || process.env.JWT_SECRET || "devsecret";

console.log("[adminRoutes] Loaded. JWT_SECRET present:", !!JWT_SECRET);

/* ------------------------------------------------------------------ *
 * PUBLIC: Admin Login
 * ------------------------------------------------------------------ */

// POST /api/admin/login
router.post("/login", async (req, res) => {
    console.log("========================================");
    console.log("🔥 [/api/admin/login] HIT");

    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const em = String(email).trim().toLowerCase();

        // 1. Find user by email
        const user = await prisma.user.findUnique({
            where: { email: em }
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        if (user.role !== "admin") {
            return res.status(403).json({ error: "Not an admin account" });
        }

        // 2. Validate password
        const ok = await bcrypt.compare(password, user.passwordHash || "");
        if (!ok) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // 3. Generate Token
        const tokenPayload = { id: user.id, role: user.role };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

        return res.json({
            token,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
            },
        });
    } catch (e) {
        console.error("💥 POST /api/admin/login ERROR:", e);
        res.status(500).json({ error: "Server error" });
    }
});

// 🔐 Everything below this line requires a valid admin JWT
router.use(authenticate, requireAdmin);

/* ------------------------------------------------------------------ *
 * Communities: list / create / update / delete
 * ------------------------------------------------------------------ */

// GET /api/admin/communities
router.get("/communities", async (req, res) => {
    try {
        const {
            q = "",
            type,
            page = 1,
            limit = 50,
            includePrivate = "true",
        } = req.query;

        const pg = Math.max(parseInt(page, 10) || 1, 1);
        const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

        const where = {};
        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { key: { contains: q, mode: 'insensitive' } },
                { slug: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ];
        }
        if (type) where.type = type;
        if (includePrivate !== "true") where.isPrivate = false;

        const [items, total] = await Promise.all([
            prisma.community.findMany({
                where,
                skip: (pg - 1) * lim,
                take: lim,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    key: true,
                    slug: true,
                    isPrivate: true,
                    tags: true,
                    createdAt: true,
                    updatedAt: true
                }
            }),
            prisma.community.count({ where })
        ]);

        const mapped = items.map(c => ({
            _id: c.id,
            ...c
        }));

        res.json({
            items: mapped,
            page: pg,
            limit: lim,
            total,
            pages: Math.max(Math.ceil(total / lim), 1),
        });
    } catch (e) {
        console.error("💥 GET /api/admin/communities ERROR", e);
        res.status(500).json({ error: "Server error" });
    }
});

// POST /api/admin/communities
router.post("/communities", async (req, res) => {
    try {
        let {
            name,
            type = "custom",
            key,
            isPrivate = false,
            tags = [],
            collegeId,
            collegeKey,
        } = req.body || {};

        if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
        if (!["college", "religion", "custom"].includes(type)) {
            return res.status(400).json({ error: "Invalid type" });
        }

        const baseTags = Array.isArray(tags) ? tags.slice(0, 20) : [];

        let finalKey = key?.trim() || slugify(name);
        let finalName = name.trim();

        if (type === "religion") {
            const religionName = name.trim();
            const religionKey = slugify(key?.trim() || religionName);
            finalName = religionName;
            finalKey = religionKey;

            const tagset = new Set(baseTags);

            if (collegeId || collegeKey) {
                const colFilter = collegeId
                    ? { id: collegeId, type: "college" }
                    : { key: slugify(collegeKey), type: "college" };

                const college = await prisma.community.findFirst({ where: colFilter });

                if (!college) {
                    return res.status(400).json({ error: "College not found" });
                }

                finalName = `${religionName} @ ${college.name}`;
                finalKey = `${college.key}__${religionKey}`;
                tagset.add(`college:${college.key}`);
            }
            tags = Array.from(tagset).slice(0, 20);
        } else {
            tags = baseTags;
        }

        const created = await prisma.community.create({
            data: {
                name: finalName,
                type,
                key: finalKey,
                slug: finalKey,
                isPrivate: !!isPrivate,
                tags: tags,
            }
        });

        const commObj = {
            _id: created.id,
            ...created
        };

        req.io?.emit("admin:communityChanged", {
            action: "create",
            community: commObj,
        });
        return res.status(201).json(commObj);

    } catch (e) {
        console.error("💥 POST /api/admin/communities ERROR", e);
        if (e.code === 'P2002') {
            return res.status(400).json({ error: "Duplicate (type,key) or slug" });
        }
        res.status(500).json({ error: "Server error" });
    }
});

// PATCH /api/admin/communities/:id
router.patch("/communities/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const data = {};

        if (typeof req.body.name === "string" && req.body.name.trim()) {
            data.name = req.body.name.trim();
        }
        if (typeof req.body.key === "string") {
            data.key = req.body.key.trim();
        }
        if (typeof req.body.isPrivate === "boolean") {
            data.isPrivate = req.body.isPrivate;
        }
        if (Array.isArray(req.body.tags)) {
            data.tags = req.body.tags.slice(0, 20);
        }

        const saved = await prisma.community.update({
            where: { id },
            data
        });

        const commObj = {
            _id: saved.id,
            ...saved
        };

        req.io?.emit("admin:communityChanged", {
            action: "update",
            community: commObj,
        });

        res.json(commObj);
    } catch (e) {
        console.error("💥 PATCH /api/admin/communities/:id ERROR", e);
        if (e.code === 'P2002') return res.status(400).json({ error: "Duplicate (type,key) or slug" });
        if (e.code === 'P2025') return res.status(404).json({ error: "Not found" });
        res.status(500).json({ error: "Server error" });
    }
});

// DELETE /api/admin/communities/:id
router.delete("/communities/:id", async (req, res) => {
    try {
        const { id } = req.params;

        try {
            await prisma.community.delete({ where: { id } });
        } catch (e) {
            if (e.code === 'P2025') return res.status(404).json({ error: "Not found" });
            throw e;
        }

        req.io?.emit("admin:communityChanged", {
            action: "delete",
            communityId: id,
        });
        req.io?.to(ROOM(id)).emit("community:deleted", { communityId: id });

        res.json({ message: "Deleted" });
    } catch (e) {
        console.error("💥 DELETE /api/admin/communities/:id ERROR", e);
        res.status(500).json({ error: "Server error" });
    }
});

/* ------------------------------------------------------------------ *
 * Reports: list
 * ------------------------------------------------------------------ */

// GET /api/admin/reports
router.get("/reports", async (req, res) => {
    try {
        const { q = "", page = 1, limit = 50 } = req.query;
        const pg = Math.max(parseInt(page, 10) || 1, 1);
        const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

        const groups = await prisma.report.groupBy({
            by: ['reportedId'],
            where: { status: 'pending' },
            _count: { reportedId: true },
            _max: { createdAt: true },
        });

        let reportSummaries = groups.map(g => ({
            reportedId: g.reportedId,
            reportCount: g._count.reportedId,
            lastReportedAt: g._max.createdAt,
        })).sort((a, b) => b.reportCount - a.reportCount || new Date(b.lastReportedAt) - new Date(a.lastReportedAt));

        const total = reportSummaries.length;
        const pagedSummaries = reportSummaries.slice((pg - 1) * lim, (pg - 1) * lim + lim);

        const items = await Promise.all(pagedSummaries.map(async (summary) => {
            const user = await prisma.user.findUnique({
                where: { id: summary.reportedId },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    role: true,
                    reportsReceivedCount: true,
                    isPermanentlyDeleted: true,
                    isActive: true
                }
            });

            if (!user) return null;

            const recentReports = await prisma.report.findMany({
                where: { reportedId: summary.reportedId, status: 'pending' },
                select: { reason: true },
                distinct: ['reason'],
                take: 10
            });
            const uniqueReasons = recentReports.map(r => r.reason);

            return {
                _id: summary.reportedId,
                reportCount: summary.reportCount,
                reasons: uniqueReasons,
                lastReportedAt: summary.lastReportedAt,
                reportedUser: {
                    _id: user.id,
                    fullName: user.fullName || "",
                    email: user.email,
                    role: user.role,
                    reportsReceivedCount: user.reportsReceivedCount,
                    isPermanentlyDeleted: user.isPermanentlyDeleted,
                    isActive: user.isActive
                }
            };
        }));

        const finalItems = items.filter(Boolean);

        res.json({
            items: finalItems,
            page: pg,
            limit: lim,
            total,
            pages: Math.max(Math.ceil(total / lim), 1),
        });

    } catch (e) {
        console.error("💥 GET /api/admin/reports ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});

/* ------------------------------------------------------------------ *
 * Users/People: list / update
 * ------------------------------------------------------------------ */

// GET /api/admin/users
router.get("/users", async (req, res) => {
    try {
        const { q = "", role, page = 1, limit = 50 } = req.query;

        const where = {};
        if (q) {
            where.OR = [
                { fullName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } }
            ];
        }
        if (role && ["user", "mod", "admin"].includes(role)) {
            where.role = role;
        }

        const pg = Math.max(parseInt(page, 10) || 1, 1);
        const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: (pg - 1) * lim,
                take: lim,
                orderBy: { createdAt: 'desc' },
                include: {
                    members: { select: { communityId: true } },
                    datingProfile: { select: { id: true } }
                }
            }),
            prisma.user.count({ where })
        ]);

        const items = users.map(p => ({
            _id: p.id,
            fullName: p.fullName,
            email: p.email,
            role: p.role || "user",
            isActive: p.isActive,
            collegeSlug: p.collegeSlug,
            religionKey: p.religionKey,
            hasDatingProfile: !!p.datingProfile,
            datingProfileId: p.datingProfile?.id || null,
            createdAt: p.createdAt,
            reportsReceivedCount: p.reportsReceivedCount,
            isPermanentlyDeleted: p.isPermanentlyDeleted,
            communitiesCount: p.members.length
        }));

        res.json({
            items,
            page: pg,
            limit: lim,
            total,
            pages: Math.max(Math.ceil(total / lim), 1),
        });
    } catch (e) {
        console.error("💥 GET /api/admin/users ERROR", e);
        res.status(500).json({ error: "Server error" });
    }
});

// GET /api/admin/people
router.get("/people", async (req, res) => {
    try {
        const { q = "", page = 1, limit = 50 } = req.query;
        const pg = Math.max(parseInt(page, 10) || 1, 1);
        const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

        const where = {};
        if (q) {
            where.OR = [
                { fullName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } }
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: (pg - 1) * lim,
                take: lim,
                orderBy: { createdAt: 'desc' },
                include: {
                    members: { select: { communityId: true } }
                }
            }),
            prisma.user.count({ where })
        ]);

        const items = users.map(p => ({
            _id: p.id,
            fullName: p.fullName,
            email: p.email,
            role: p.role,
            communityIds: p.members.map(m => m.communityId),
            createdAt: p.createdAt
        }));

        res.json({
            items,
            page: pg,
            limit: lim,
            total,
            pages: Math.max(Math.ceil(total / lim), 1),
        });
    } catch (e) {
        console.error("💥 GET /api/admin/people ERROR", e);
        res.status(500).json({ error: "Server error" });
    }
});

// PATCH /api/admin/people/:id
router.patch("/people/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const data = {};

        if (typeof req.body.fullName === "string") data.fullName = req.body.fullName.trim();
        if (typeof req.body.email === "string") data.email = req.body.email.trim().toLowerCase();
        if (typeof req.body.role === "string") {
            if (["user", "mod", "admin"].includes(req.body.role)) {
                data.role = req.body.role;
            }
        }

        const saved = await prisma.user.update({
            where: { id },
            data,
            include: { members: { select: { communityId: true } } }
        });

        const userObj = {
            _id: saved.id,
            fullName: saved.fullName,
            email: saved.email,
            role: saved.role,
            communityIds: saved.members.map(m => m.communityId)
        };

        req.io?.emit("admin:userChanged", { action: "update", user: userObj });
        res.json(userObj);

    } catch (e) {
        console.error("💥 PATCH /api/admin/people/:id ERROR", e);
        if (e.code === 'P2025') return res.status(404).json({ error: "User not found" });
        res.status(500).json({ error: "Server error" });
    }
});

// PATCH /api/admin/people/:id/ban
router.patch("/people/:id/ban", async (req, res) => {
    try {
        const { id } = req.params;
        if (id === req.user.id) {
            return res.status(400).json({ error: "You cannot ban your own account." });
        }

        const saved = await prisma.user.update({
            where: { id },
            data: {
                isActive: false,
                isPermanentlyDeleted: true
            }
        });

        const userObj = {
            _id: saved.id,
            fullName: saved.fullName,
            email: saved.email,
            role: saved.role,
            isActive: saved.isActive,
            isPermanentlyDeleted: saved.isPermanentlyDeleted
        };

        req.io?.emit("admin:userChanged", { action: "ban", user: userObj });
        res.json({ message: "User permanently banned/deleted.", user: userObj });

    } catch (e) {
        console.error("💥 PATCH /api/admin/people/:id/ban ERROR:", e);
        if (e.code === 'P2025') return res.status(404).json({ error: "User not found" });
        res.status(500).json({ error: "Server error" });
    }
});

// PATCH /api/admin/people/:id/unban
router.patch("/people/:id/unban", async (req, res) => {
    try {
        const { id } = req.params;

        const saved = await prisma.user.update({
            where: { id },
            data: {
                isActive: true,
                isPermanentlyDeleted: false
            }
        });

        const userObj = {
            _id: saved.id,
            fullName: saved.fullName,
            email: saved.email,
            role: saved.role,
            isActive: saved.isActive,
            isPermanentlyDeleted: saved.isPermanentlyDeleted,
            reportsReceivedCount: saved.reportsReceivedCount
        };

        req.io?.emit("admin:userChanged", { action: "unban", user: userObj });
        res.json({ message: "User account reactivated.", user: userObj });

    } catch (e) {
        console.error("💥 PATCH /api/admin/people/:id/unban ERROR:", e);
        if (e.code === 'P2025') return res.status(404).json({ error: "User not found" });
        res.status(500).json({ error: "Server error" });
    }
});

// PATCH /api/admin/people/:id/deactivate
router.patch("/people/:id/deactivate", async (req, res) => {
    try {
        const { id } = req.params;
        const saved = await prisma.user.update({
            where: { id },
            data: { isActive: false }
        });

        const userObj = {
            _id: saved.id,
            fullName: saved.fullName,
            email: saved.email,
            role: saved.role,
            isActive: saved.isActive,
            isPermanentlyDeleted: saved.isPermanentlyDeleted
        };

        req.io?.emit("admin:userChanged", { action: "deactivate", user: userObj });
        res.json({ message: "User account deactivated (muted).", user: userObj });

    } catch (e) {
        console.error("💥 PATCH /api/admin/people/:id/deactivate ERROR:", e);
        if (e.code === 'P2025') return res.status(404).json({ error: "User not found" });
        res.status(500).json({ error: "Server error" });
    }
});

/* ------------------------------------------------------------------ *
 * Membership ops: add / remove
 * ------------------------------------------------------------------ */

router.post("/memberships", async (req, res) => {
    try {
        const { personId, communityId } = req.body || {};

        if (!personId || !communityId) {
            return res.status(400).json({ error: "Invalid ids" });
        }

        const member = await prisma.member.upsert({
            where: {
                userId_communityId: { userId: personId, communityId }
            },
            create: {
                userId: personId,
                communityId,
                memberStatus: "active",
                role: "member"
            },
            update: {
                memberStatus: "active"
            },
            include: {
                user: true,
                community: true
            }
        });

        const memberObj = {
            _id: member.id,
            person: member.userId,
            community: member.communityId,
            memberStatus: member.memberStatus,
            role: member.role,
            name: member.user.fullName,
            email: member.user.email,
            avatar: "/default-avatar.png",
        };

        req.io?.to(ROOM(communityId)).emit("members:changed", {
            communityId: String(communityId),
            action: "upsert",
            member: memberObj,
        });
        req.io?.emit("admin:membershipChanged", { action: "upsert", member: memberObj });

        res.status(201).json(memberObj);

    } catch (e) {
        console.error("💥 POST /api/admin/memberships ERROR", e);
        if (e.code === 'P2003') return res.status(404).json({ error: "User or community not found" });
        res.status(500).json({ error: "Server error" });
    }
});

router.delete("/memberships/:memberId", async (req, res) => {
    try {
        const { memberId } = req.params;

        const m = await prisma.member.delete({
            where: { id: memberId }
        });

        req.io?.to(ROOM(m.communityId)).emit("members:changed", {
            communityId: String(m.communityId),
            action: "delete",
            memberId: String(m.id),
        });
        req.io?.emit("admin:membershipChanged", {
            action: "delete",
            memberId: String(m.id),
        });

        res.json({ message: "Removed" });

    } catch (e) {
        console.error("💥 DELETE /api/admin/memberships/:memberId ERROR", e);
        if (e.code === 'P2025') return res.status(404).json({ error: "Membership not found" });
        res.status(500).json({ error: "Server error" });
    }
});

// DELETE /api/admin/people/:id
router.delete("/people/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (id === req.user.id) {
            return res.status(400).json({ error: "You cannot delete your own account." });
        }

        const target = await prisma.user.findUnique({ where: { id } });
        if (!target) return res.status(404).json({ error: "User not found" });

        if (target.role === "admin") {
            const adminsLeft = await prisma.user.count({
                where: { role: "admin", id: { not: id } }
            });
            if (adminsLeft === 0) {
                return res.status(400).json({ error: "Cannot delete the last remaining admin." });
            }
        }

        const memberships = await prisma.member.findMany({ where: { userId: id } });

        await prisma.user.delete({ where: { id } });

        for (const m of memberships) {
            req.io?.to(ROOM(m.communityId)).emit("members:changed", {
                communityId: String(m.communityId),
                action: "delete",
                memberId: String(m.id),
            });
        }

        req.io?.emit("admin:userChanged", {
            action: "delete",
            userId: String(id),
        });

        res.json({ message: "User deleted" });

    } catch (e) {
        console.error("💥 DELETE /api/admin/people/:id ERROR", e);
        res.status(500).json({ error: "Server error" });
    }
});

/* ------------------------------------------------------------------ *
 * Dating profile moderation
 * ------------------------------------------------------------------ */

router.get("/dating/profiles/pending", async (req, res) => {
    try {
        const { q = "", page = 1, limit = 50 } = req.query;
        const pg = Math.max(parseInt(page, 10) || 1, 1);
        const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

        const where = {
            OR: [
                { isPhotoApproved: false },
                { isProfileVisible: false }
            ],
            isSuspended: false
        };

        if (q) {
            where.user = {
                OR: [
                    { fullName: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } }
                ]
            };
        }

        const [profiles, total] = await Promise.all([
            prisma.datingProfile.findMany({
                where,
                skip: (pg - 1) * lim,
                take: lim,
                orderBy: { createdAt: 'desc' },
                include: { user: true }
            }),
            prisma.datingProfile.count({ where })
        ]);

        const items = profiles.map(p => ({
            _id: p.id,
            person: p.userId,
            personName: p.user.fullName || p.user.email || "Unknown",
            personEmail: p.user.email,
            photos: p.photos,
            bio: p.bio,
            gender: p.gender,
            seeking: p.seeking,
            yearOfStudy: p.yearOfStudy,
            isPhotoApproved: p.isPhotoApproved,
            isProfileVisible: p.isProfileVisible,
            isSuspended: p.isSuspended,
            createdAt: p.createdAt
        }));

        res.json({
            items,
            page: pg,
            limit: lim,
            total,
            pages: Math.max(Math.ceil(total / lim), 1),
        });
    } catch (e) {
        console.error("💥 GET /api/admin/dating/profiles/pending ERROR", e);
        res.status(500).json({ error: "Server error" });
    }
});

router.patch("/dating/profiles/:id/approve", async (req, res) => {
    try {
        const { id } = req.params;
        const profile = await prisma.datingProfile.update({
            where: { id },
            data: {
                isPhotoApproved: true,
                isProfileVisible: true,
                isSuspended: false
            },
            include: { user: true }
        });

        const pObj = {
            ...profile,
            person: {
                _id: profile.user.id,
                fullName: profile.user.fullName,
                email: profile.user.email,
                role: profile.user.role,
                collegeSlug: profile.user.collegeSlug,
                religionKey: profile.user.religionKey
            }
        };

        req.io?.emit("admin:datingProfileChanged", {
            action: "approve",
            profile: pObj,
        });

        res.json({ message: "Profile approved", profile: pObj });

    } catch (e) {
        console.error("💥 PATCH /api/admin/dating/profiles/:id/approve ERROR", e);
        if (e.code === 'P2025') return res.status(404).json({ error: "Profile not found" });
        res.status(500).json({ error: "Server error" });
    }
});

router.patch("/dating/profiles/:id/suspend", async (req, res) => {
    try {
        const { id } = req.params;
        const profile = await prisma.datingProfile.update({
            where: { id },
            data: {
                isSuspended: true,
                isProfileVisible: false
            },
            include: { user: true }
        });

        const pObj = {
            ...profile,
            person: {
                _id: profile.user.id,
                fullName: profile.user.fullName,
                email: profile.user.email,
                role: profile.user.role,
                collegeSlug: profile.user.collegeSlug,
                religionKey: profile.user.religionKey
            }
        };

        req.io?.emit("admin:datingProfileChanged", {
            action: "suspend",
            profile: pObj,
        });

        res.json({ message: "Profile suspended", profile: pObj });

    } catch (e) {
        console.error("💥 PATCH /api/admin/dating/profiles/:id/suspend ERROR", e);
        if (e.code === 'P2025') return res.status(404).json({ error: "Profile not found" });
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;