"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = isAdmin;
function isAdmin(req, res, next) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "admin")
        return res.status(403).json({ message: "Admin only" });
    next();
}
