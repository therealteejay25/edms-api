"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOrgAdmin = requireOrgAdmin;
exports.requireDepartmentLead = requireDepartmentLead;
exports.checkRole = checkRole;
exports.checkDepartmentAccess = checkDepartmentAccess;
exports.checkDocumentOwnership = checkDocumentOwnership;
function requireOrgAdmin(req, res, next) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "admin")
        return res.status(403).json({ message: "Admin only" });
    next();
}
function requireDepartmentLead(req, res, next) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "department_lead" && req.user.role !== "admin")
        return res
            .status(403)
            .json({ message: "Department lead or admin required" });
    next();
}
function checkRole(roles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const allowedRoles = typeof roles === "string" ? [roles] : roles;
        if (!allowedRoles.includes(req.user.role))
            return res.status(403).json({ message: "Forbidden" });
        next();
    };
}
function checkDepartmentAccess(req, res, next) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    // Admin can access all departments
    if (req.user.role === "admin") {
        return next();
    }
    // Department lead or user can access their own department
    const { department } = req.query;
    if (department && req.user.department !== department) {
        return res.status(403).json({ message: "Cannot access other departments" });
    }
    next();
}
function checkDocumentOwnership(req, res, next) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    // This middleware will be used after fetching the document
    // Attach the check function to request
    req.checkOwner = (ownerId) => {
        if (req.user.role === "admin")
            return true;
        return String(ownerId) === String(req.user._id);
    };
    next();
}
exports.default = {
    requireOrgAdmin,
    requireDepartmentLead,
    checkRole,
    checkDepartmentAccess,
    checkDocumentOwnership,
};
