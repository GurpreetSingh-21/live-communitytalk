// backend/routes/publicRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

/**
 * GET /api/public/colleges
 * Returns list of colleges for registration dropdown
 * Fetches from Community table where type='college'.
 * Note: emailDomains might rely on 'key' or 'tags' or specific field if we migrated it.
 * Mongoose model 'College' might have had 'emailDomains'. 
 * In Prisma Schema, Community has no 'emailDomains'.
 * However, the requirement is to use Prisma.
 * If 'emailDomains' was critical, it should be in Schema.
 * Checking Schema: Community has: id, type, key, slug, name, icon, description, tags, isPrivate...
 * No emailDomains. 
 * But checking `backend/models/College.js` (deleted) might have shown it.
 * IF we need email domains for validation logic elsewhere, we might be missing data.
 * For now, we will return list of colleges.
 */
router.get("/colleges", async (req, res) => {
  try {
    // Correctly fetch from College table which has emailDomains and the correct ID expected by register
    const colleges = await prisma.college.findMany({
      select: {
        id: true,
        name: true,
        key: true,
        emailDomains: true,
      },
      orderBy: { name: 'asc' }
    });

    // Convert to frontend shape
    const items = colleges.map(c => ({
      _id: c.id,
      name: c.name,
      key: c.key,
      emailDomains: c.emailDomains || []
    }));

    return res.json(items);
  } catch (e) {
    console.error("GET /api/public/colleges error", e);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/public/communities
 * General search for public communities
 */
router.get("/communities", async (req, res) => {
  try {
    const {
      q = "",
      sort = "name",
      page = 1,
      limit = 100,
      type,
      tags,
      paginated = "true",
    } = req.query;

    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
    const doPaginate = paginated === "true" || paginated === true;

    const where = {
      isPrivate: false // Public only
    };

    // Type filter
    if (type) {
      if (Array.isArray(type)) where.type = { in: type };
      else where.type = type;
    }

    // Tags filter: Prisma "hasEvery" for arrays (Postgres)
    if (tags) {
      const tArr = Array.isArray(tags) ? tags : [tags];
      if (tArr.length > 0) {
        where.tags = { hasEvery: tArr };
      }
    }

    // CollegeSlug filter: ONLY show communities that have this college in their tags
    // This is an EXCLUSIVE filter - communities MUST have the college tag to be shown
    const collegeSlug = req.query.collegeSlug;
    if (collegeSlug && typeof collegeSlug === 'string' && collegeSlug.trim()) {
      // Use 'has' to check if the college slug is in the tags array
      where.tags = {
        ...where.tags, // Preserve any existing tag filters
        has: collegeSlug.toLowerCase().trim()
      };
    }

    // Text search - use AND to combine with existing filters
    if (q && q.trim()) {
      const qs = q.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: qs, mode: 'insensitive' } },
            { key: { contains: qs, mode: 'insensitive' } },
            { slug: { contains: qs, mode: 'insensitive' } },
            { description: { contains: qs, mode: 'insensitive' } },
          ]
        }
      ];
    }

    // Sort
    const orderBy = {};
    const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
    const sortDir = sort.startsWith("-") ? 'desc' : 'asc';

    // Map sort fields
    if (['name', 'createdAt'].includes(sortField)) {
      orderBy[sortField] = sortDir;
    } else {
      orderBy.name = 'asc';
    }

    const select = {
      id: true,
      name: true,
      type: true,
      key: true,
      tags: true,
      isPrivate: true,
      createdAt: true
    };

    if (!doPaginate) {
      const items = await prisma.community.findMany({
        where,
        orderBy,
        select
      });
      return res.json(items.map(i => ({ _id: i.id, ...i })));
    }

    const [items, total] = await Promise.all([
      prisma.community.findMany({
        where,
        orderBy,
        skip: (pg - 1) * lim,
        take: lim,
        select
      }),
      prisma.community.count({ where })
    ]);

    res.json({
      items: items.map(i => ({ _id: i.id, ...i })),
      page: pg,
      limit: lim,
      total,
      pages: Math.max(Math.ceil(total / lim), 1),
    });

  } catch (e) {
    console.error("GET /api/public/communities error", e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;