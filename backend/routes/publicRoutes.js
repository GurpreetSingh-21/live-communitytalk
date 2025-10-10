// backend/routes/publicRoutes.js
const express = require("express");
const router = express.Router();
const Community = require("../models/Community");

// GET /api/public/communities?q=&type=&paginated=&page=&limit=
// Returns ONLY public communities (isPrivate !== true)
router.get("/communities", async (req, res) => {
  try {
    const {
      q = "",
      type,
      paginated = "true",
      page = 1,
      limit = 100,
    } = req.query;

    const filter = { isPrivate: { $ne: true } };
    if (type) filter.type = type;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { key: rx }, { slug: rx }, { description: rx }];
    }

    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    // Only the fields the Registration page needs
    const baseSel = "_id name type key tags isPrivate createdAt";

    if (String(paginated) !== "true") {
      const items = await Community.find(filter).select(baseSel).sort({ name: 1 }).lean();
      return res.json(items);
    }

    const [items, total] = await Promise.all([
      Community.find(filter).select(baseSel).sort({ name: 1 }).skip((pg - 1) * lim).limit(lim).lean(),
      Community.countDocuments(filter),
    ]);

    res.json({
      items,
      page: pg,
      limit: lim,
      total,
      pages: Math.max(Math.ceil(total / lim), 1),
    });
  } catch (e) {
    console.error("GET /api/public/communities", e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;