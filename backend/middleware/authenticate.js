// backend/middleware/authenticate.js
const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");
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

  // 🔒 SECURITY FIX (Flaw 4): Removed token retrieval from query param (?token=...).
  // This prevents token leakage in logs and browser history.
  /*
  if (req.query && typeof req.query.token === "string" && req.query.token.trim()) {
    return req.query.token.trim();
  }
  */

  return null;
}

/** Best-effort derivation of collegeSlug / religionKey from memberships */
/** Best-effort derivation of collegeSlug / religionKey from memberships */
async function deriveUserScope(userDoc) {
  try {
    // Find active/owner memberships
    const memberships = await prisma.member.findMany({
      where: {
        userId: userDoc.id,
        memberStatus: { in: ["active", "owner"] },
      },
      select: { communityId: true },
    });

    const ids = memberships.map((m) => m.communityId).filter(Boolean);
    if (!ids.length) return { collegeSlug: null, religionKey: null };

    // Look up the communities by id to inspect type + key/slug
    const comms = await prisma.community.findMany({
      where: { id: { in: ids } },
      select: { type: true, key: true, slug: true },
    });

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
      console.log('[DEBUG] authenticate: No token provided');
      return res.status(401).json({ error: "No token provided", code: "NO_TOKEN" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        clockTolerance: 5,
      });
    } catch (err) {
      console.log('[DEBUG] authenticate: Token verification failed:', err.name, err.message);
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
      console.log('[DEBUG] authenticate: Malformed token (no id)');
      return res.status(401).json({ error: "Malformed token", code: "MALFORMED_TOKEN" });
    }

    // Load user
    const userDoc = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!userDoc) {
      return res.status(401).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }

    // Shape the user object that routes expect
    const user = {
      id: userDoc.id,
      _id: userDoc.id,
      email: userDoc.email,
      fullName: userDoc.fullName || userDoc.name || "",
      name: userDoc.fullName || userDoc.name || "",
      role: userDoc.role || "user",
      isAdmin: (userDoc.role || "user") === "admin",
      collegeSlug: userDoc.collegeSlug || null,
      religionKey: userDoc.religionKey || null,
      createdAt: userDoc.createdAt,
    };

    // 🚀 PERFORMANCE FIX: Removed expensive deriveUserScope()
    // Previously ran 2 DB queries (Member + Community) on EVERY authenticated request
    // This added 100-250ms to every API call
    // These fields should be set on the user record at registration/login
    // If missing, routes that need them can handle it individually

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