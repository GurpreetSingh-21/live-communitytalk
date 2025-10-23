// backend/routes/publicRoutes.js
const express = require("express");
const router = express.Router();
const Community = require("../models/Community");

/**
 * Mount this router at: app.use("/api/public", publicRoutes)
 *
 * GET /api/public/communities
 *   q=                string (search by name/key/slug/description; regex, escaped)
 *   type=             string | string[] (e.g., type=college or type=college&type=religion)
 *   tags=             string | string[] (exact tag match; can repeat)
 *   sort=             "name" | "-name" | "createdAt" | "-createdAt" (default: name)
 *   paginated=        "true" | "false"  (default: "true")
 *   page=             number (1+)
 *   limit=            number (1..200)
 *
 * NOTE: Returns ONLY public communities (isPrivate !== true)
 */
router.get("/communities", async (req, res) => {
  try {
    // -------- helpers --------
    const toArray = (v) =>
      Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [];

    const parseBool = (v, def = true) => {
      if (typeof v === "boolean") return v;
      if (v == null) return def;
      const s = String(v).trim().toLowerCase();
      return s === "true" || s === "1" || s === "yes";
    };

    const clamp = (n, min, max) =>
      Math.min(Math.max(Number.isFinite(+n) ? +n : min, min), max);

    const escapeRegex = (s) =>
      s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // -------- query parsing --------
    const {
      q = "",
      sort = "name",
      page = 1,
      limit = 100,
      type,
      tags,
      paginated = "true",
    } = req.query;

    const pg = clamp(page, 1, 10_000);
    const lim = clamp(limit, 1, 200);
    const doPaginate = parseBool(paginated, true);

    // -------- filters --------
    const filter = { isPrivate: { $ne: true } };

    // type filter (accepts single or many ?type=)
    const types = toArray(type).map((t) => String(t).trim()).filter(Boolean);
    if (types.length) {
      filter.type = { $in: types };
    }

    // tags filter (exact match within tags array; accepts many ?tags=)
    const tagsArr = toArray(tags).map((t) => String(t).trim()).filter(Boolean);
    if (tagsArr.length) {
      filter.tags = { $all: tagsArr };
    }

    // text search (safe regex)
    const qStr = String(q || "").trim();
    if (qStr) {
      const rx = new RegExp(escapeRegex(qStr), "i");
      filter.$or = [
        { name: rx },
        { key: rx },
        { slug: rx },
        { description: rx },
      ];
    }

    // -------- projection & sort --------
    // Keep fields minimal for public endpoint
    const PROJECTION = "_id name type key tags isPrivate createdAt";

    const allowedSorts = new Set([
      "name",
      "-name",
      "createdAt",
      "-createdAt",
    ]);
    const chosenSort = allowedSorts.has(String(sort)) ? String(sort) : "name";

    // convert "field" | "-field" to mongoose sort object
    const sortObj =
      chosenSort.startsWith("-")
        ? { [chosenSort.slice(1)]: -1 }
        : { [chosenSort]: 1 };

    // -------- query --------
    if (!doPaginate) {
      const items = await Community.find(filter)
        .select(PROJECTION)
        .sort(sortObj)
        .lean();

      return res.json(items);
    }

    const [items, total] = await Promise.all([
      Community.find(filter)
        .select(PROJECTION)
        .sort(sortObj)
        .skip((pg - 1) * lim)
        .limit(lim)
        .lean(),
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