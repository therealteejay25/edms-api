import { Request, Response, NextFunction } from "express";

export function requireOrgAdmin(
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });
  next();
}

export function requireDepartmentLead(
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role !== "department_lead" && req.user.role !== "admin")
    return res
      .status(403)
      .json({ message: "Department lead or admin required" });
  next();
}

export function checkRole(roles: string | string[]) {
  return (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const allowedRoles = typeof roles === "string" ? [roles] : roles;
    if (!allowedRoles.includes(req.user.role))
      return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

export function checkDepartmentAccess(
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
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

export function checkDocumentOwnership(
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  // This middleware will be used after fetching the document
  // Attach the check function to request
  (req as any).checkOwner = (ownerId: any) => {
    if (req.user.role === "admin") return true;
    return String(ownerId) === String(req.user._id);
  };
  next();
}

export default {
  requireOrgAdmin,
  requireDepartmentLead,
  checkRole,
  checkDepartmentAccess,
  checkDocumentOwnership,
};
