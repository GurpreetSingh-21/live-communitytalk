// backend/middleware/authenticate.js
const jwt = require("jsonwebtoken");
const Person = require("../person");
const Member = require("../models/Member");
const Community = require("../models/Community"); // must expose { type, key/slug }
require("dotenv").config();

/** Extract a JWT from common places */
function getTokenFromRequest(req) {
  // Express normalizes headers to lowercase; req.get handles both safely
  const authHeader = req.get("authorization");

  if (typeof authHeader === "string" && authHeader.trim()) {
    const trimmed = authHeader.trim();

    // Bearer <token>
    if (trimmed.toLowerCase().startsWith("bearer ")) {
      const bearer = trimmed.slice(7).trim();
      if (bearer) return bearer;
    }

    // Raw token (no "Bearer ")
    if (!trimmed.includes(" ")) return trimmed;
  }

  // x-access-token header (legacy/alt)
  if (req.headers["x-access-token"]) {
    const x = String(req.headers["x-access-token"]).trim();
    if (x) return x;
  }

  // Cookie (only if you actually set cookies; requires cookie-parser)
  if (req.cookies && req.cookies.token) {
    const c = String(req.cookies.token).trim();
    if (c) return c;
  }

  // (Optional) query param ?token=... for quick testing
  if (req.query && typeof req.query.token === "string" && req.query.token.trim()) {
    return req.query.token.trim();
  }

  return null;
}

/** Best-effort derivation of collegeSlug / religionKey from memberships */
async function deriveUserScope(userDoc) {
  try {
    // Find active/owner memberships
    const memberships = await Member.find({
      person: userDoc._id,
      status: { $in: ["active", "owner"] },
    })
      .select("community")
      .lean();

    const ids = memberships.map((m) => m.community).filter(Boolean);
    if (!ids.length) return { collegeSlug: null, religionKey: null };

    // Look up the communities by id to inspect type + key/slug
    const comms = await Community.find({ _id: { $in: ids } })
      .select("type key slug")
      .lean();

    const college = comms.find((c) => c.type === "college");
    const religion = comms.find((c) => c.type === "religion");

    const collegeSlug = college ? (college.key || college.slug || null) : null;
    const religionKey = religion ? (religion.key || religion.slug || null) : null;

    return { collegeSlug, religionKey };
  } catch {
    // On any error, just return nulls; routes will handle missing scope gracefully
    return { collegeSlug: null, religionKey: null };
  }
}

async function authenticate(req, res, next) {
  try {
    const secret = process.env.MY_SECRET_KEY;
    if (!secret) {
      return res
        .status(500)
        .json({ error: "Server misconfigured", code: "SERVER_CONFIG_ERROR" });
    }

    const token = getTokenFromRequest(req);
    if (!token) {
      // Use originalUrl so you see the full path (mounted routers often show '/' in req.path)
      return res.status(401).json({ error: "No token provided", code: "NO_TOKEN" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        clockTolerance: 5,
      });
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "Token expired",
          code: "TOKEN_EXPIRED",
          expiredAt: err.expiredAt,
        });
      }
      if (err.name === "JsonWebTokenError") {
        return res.status(401).json({ error: "Invalid token", code: "TOKEN_INVALID" });
      }
      if (err.name === "NotBeforeError") {
        return res.status(401).json({ error: "Token not yet valid", code: "TOKEN_NOT_ACTIVE" });
      }
      return res.status(401).json({ error: "Token verification failed", code: "TOKEN_ERROR" });
    }

    if (!decoded?.id) {
      return res.status(401).json({ error: "Malformed token", code: "MALFORMED_TOKEN" });
    }

    // Load user (not lean so we can access instance fields if needed)
    const userDoc = await Person.findById(decoded.id).exec();
    if (!userDoc) {
      return res.status(401).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }

    // Shape the user object that routes expect
    const user = {
      id: String(userDoc._id),
      _id: String(userDoc._id),
      email: userDoc.email,
      fullName: userDoc.fullName || userDoc.name || "",
      name: userDoc.fullName || userDoc.name || "",
      role: userDoc.role || "user",
      isAdmin: (userDoc.role || "user") === "admin",
      collegeSlug: userDoc.collegeSlug || null,
      religionKey: userDoc.religionKey || null,
      createdAt: userDoc.createdAt,
    };

    // If scope missing on the person record, derive from memberships (non-persistent)
    if (!user.collegeSlug || !user.religionKey) {
      const derived = await deriveUserScope(userDoc);
      user.collegeSlug = user.collegeSlug || derived.collegeSlug;
      user.religionKey = user.religionKey || derived.religionKey;
      // (Optional) you could persist back to the Person doc here if desired:
      // if (derived.collegeSlug && !userDoc.collegeSlug) userDoc.collegeSlug = derived.collegeSlug;
      // if (derived.religionKey && !userDoc.religionKey) userDoc.religionKey = derived.religionKey;
      // await userDoc.save().catch(() => {});
    }

    req.user = user;
    req.userDoc = userDoc;
    res.locals.user = user;

    if (decoded?.exp) {
      res.setHeader("x-token-exp", decoded.exp);
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = authenticate;