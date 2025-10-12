// backend/routes/events.js
const express = require('express');
const Event = require('../models/event');

const router = express.Router();

/**
 * GET /api/events?limit=20&cursor=ISO8601
 * Scopes by req.user.collegeSlug & req.user.religionKey.
 *
 * Auth is applied in server.js:
 *   app.use("/api/events", authenticate, eventRoutes);
 */
router.get('/', async (req, res) => {
  try {
    console.log('📥 [GET /api/events] Request received');
    console.log('→ Headers.authorization:', req.headers?.authorization);
    console.log('→ Auth user:', req.user);
    console.log('→ Query params:', req.query);

    const user = req.user || {};
    if (!user.collegeSlug || !user.religionKey) {
      console.log('⚠️ Missing user scope:', { collegeSlug: user.collegeSlug, religionKey: user.religionKey });
      return res.status(400).json({ error: 'Missing user scope' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const cursor = req.query.cursor;

    const q = {
      collegeId: user.collegeSlug,
      faithId: user.religionKey,
    };
    if (cursor) {
      const d = new Date(cursor);
      if (!isNaN(d.getTime())) q.startsAt = { $gte: d };
    }

    console.log('🔍 Mongo query:', q);

    // Fetch limit+1 to know if there's another page
    const raw = await Event.find(q)
      .sort({ startsAt: 1, _id: 1 })
      .limit(limit + 1)
      .lean();

    const hasMore = raw.length > limit;
    const items = hasMore ? raw.slice(0, limit) : raw;
    const nextCursor = hasMore
      ? new Date(items[items.length - 1].startsAt).toISOString()
      : null;

    console.log(`✅ Found ${items.length} event(s)`);
    console.log('➡️ hasMore:', hasMore, 'nextCursor:', nextCursor);

    res.json({ items, nextCursor, hasMore });
  } catch (e) {
    console.error('💥 GET /api/events error:', e);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * (Optional) GET /api/events/:id
 * Returns a single event (also scoped to the user’s college/faith).
 */
router.get('/:id', async (req, res) => {
  try {
    console.log('📥 [GET /api/events/:id] Request received');
    console.log('→ Params:', req.params);
    console.log('→ Auth user:', req.user);

    const user = req.user || {};
    if (!user.collegeSlug || !user.religionKey) {
      console.log('⚠️ Missing user scope:', { collegeSlug: user.collegeSlug, religionKey: user.religionKey });
      return res.status(400).json({ error: 'Missing user scope' });
    }

    const ev = await Event.findOne({
      _id: req.params.id,
      collegeId: user.collegeSlug,
      faithId: user.religionKey,
    }).lean();

    if (!ev) {
      console.log('❌ Event not found:', req.params.id);
      return res.status(404).json({ error: 'Event not found' });
    }

    console.log('✅ Event found:', ev._id);
    res.json(ev);
  } catch (e) {
    console.error('💥 GET /api/events/:id error:', e);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

module.exports = router;