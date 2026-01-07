"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = auth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const COOKIE_NAME = process.env.COOKIE_NAME || "edms_token";
async function auth(req, res, next) {
    try {
        const token = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.split(" ")[1];
        if (!token)
            return res.status(401).json({ message: "Unauthorized" });
        const secret = process.env.JWT_SECRET || "secret";
        const payload = jsonwebtoken_1.default.verify(token, secret);
        const user = await User_1.default.findById(payload.id).select("-password");
        if (!user)
            return res.status(401).json({ message: "Unauthorized" });
        if (user.activeOrg) {
            user.org = user.activeOrg;
        }
        else {
            user.activeOrg = user.org;
        }
        req.user = user;
        next();
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Auth error", err);
        res.status(401).json({ message: "Unauthorized" });
    }
}
