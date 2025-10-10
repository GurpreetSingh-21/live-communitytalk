// backend/middleware/requireAdmin.js
module.exports = function requireAdmin(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // accept either a boolean flag OR a role string
    const isAdmin = req.user?.isAdmin === true || req.user?.role === "admin";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin only" });
    }

    return next();
  } catch (e) {
    console.error("requireAdmin error:", e);
    return res.status(500).json({ error: "Server error" });
  }
};