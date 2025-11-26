import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

const COOKIE_NAME = process.env.COOKIE_NAME || "edms_token";

export interface AuthedRequest extends Request {
  user?: any;
}

export async function auth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token =
      req.cookies?.[COOKIE_NAME] || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const secret = process.env.JWT_SECRET || "secret";
    const payload: any = jwt.verify(token, secret);
    const user = await User.findById(payload.id).select("-password");
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    req.user = user;
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Auth error", err);
    res.status(401).json({ message: "Unauthorized" });
  }
}
