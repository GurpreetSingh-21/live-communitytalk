// backend/middleware/authenticate.js
const jwt = require("jsonwebtoken");
const Person = require("../person");
require("dotenv").config();

function getTokenFromRequest(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader === "string") {
    const trimmed = authHeader.trim();
    
    if (trimmed.toLowerCase().startsWith("bearer ")) {
      const token = trimmed.slice(7).trim();
      if (token) return token;
    }
    
    if (trimmed && !trimmed.includes(" ")) {
      return trimmed;
    }
  }

  if (req.headers?.["x-access-token"]) {
    return String(req.headers["x-access-token"]).trim();
  }

  if (req.cookies?.token) {
    return String(req.cookies.token).trim();
  }

  return null;
}

async function authenticate(req, res, next) {
  try {
    const secret = process.env.MY_SECRET_KEY;
    if (!secret) {
      console.error("❌ Missing MY_SECRET_KEY in .env");
      return res.status(500).json({ error: "Server misconfigured", code: "SERVER_CONFIG_ERROR" });
    }

    const token = getTokenFromRequest(req);
    if (!token) {
      console.log(`[Auth] No token: ${req.method} ${req.path}`);
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
          expiredAt: err.expiredAt 
        });
      }
      if (err.name === "JsonWebTokenError") {
        return res.status(401).json({ error: "Invalid token", code: "TOKEN_INVALID" });
      }
      if (err.name === "NotBeforeError") {
        return res.status(401).json({ error: "Token not yet valid", code: "TOKEN_NOT_ACTIVE" });
      }
      console.error("JWT verification failed:", err);
      return res.status(401).json({ error: "Token verification failed", code: "TOKEN_ERROR" });
    }

    if (!decoded?.id) {
      console.error("[Auth] Token missing 'id' field:", decoded);
      return res.status(401).json({ error: "Malformed token", code: "MALFORMED_TOKEN" });
    }

    const userDoc = await Person.findById(decoded.id).lean(false).exec();
    if (!userDoc) {
      console.log(`[Auth] User not found: ${decoded.id}`);
      return res.status(401).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }

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

    req.user = user;
    req.userDoc = userDoc;
    res.locals.user = user;

    if (decoded?.exp) {
      res.setHeader("x-token-exp", decoded.exp);
    }

    return next();
  } catch (err) {
    console.error("❌ authenticate() error:", err);
    return res.status(500).json({ error: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = authenticate;