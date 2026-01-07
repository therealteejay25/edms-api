"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startZohoAuth = startZohoAuth;
exports.zohoCallback = zohoCallback;
exports.me = me;
exports.listOrgs = listOrgs;
exports.switchOrg = switchOrg;
exports.logout = logout;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const Organization_1 = __importDefault(require("../models/Organization"));
const ZohoOAuth = __importStar(require("../services/zoho/oauth"));
const COOKIE_NAME = process.env.COOKIE_NAME || "edms_token";
function decodeState(state) {
    if (!state)
        return null;
    try {
        const raw = Buffer.from(String(state), "base64").toString("utf8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function encodeState(value) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}
function setAuthCookie(res, user) {
    const payload = { id: user._id, org: user.org };
    const secret = process.env.JWT_SECRET || "secret";
    const token = jsonwebtoken_1.default.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 1000 * 60 * 60 * 24 * 7,
    });
}
async function startZohoAuth(_req, res) {
    const reqAny = _req;
    const { orgId, orgName } = (reqAny.query || {});
    const state = orgId || orgName ? encodeState({ orgId, orgName }) : undefined;
    const url = ZohoOAuth.getAuthUrl(state);
    res.redirect(url);
}
async function zohoCallback(req, res) {
    try {
        const { code, state } = req.query;
        if (!code)
            return res.status(400).json({ message: "Missing code" });
        const tokenResp = await ZohoOAuth.exchangeCode(code);
        const accessToken = tokenResp.access_token;
        const refreshToken = tokenResp.refresh_token;
        // fetch user info
        const userInfo = await ZohoOAuth.getUserInfo(accessToken);
        // userInfo structure may vary; try to extract email and name
        const email = userInfo?.Email ||
            userInfo?.email ||
            (userInfo?.data && userInfo.data.email);
        const name = userInfo?.Name ||
            userInfo?.name ||
            (userInfo?.data && userInfo.data.display_name) ||
            email;
        if (!email)
            return res
                .status(400)
                .json({ message: "Unable to get user email from Zoho" });
        const stateData = decodeState(state);
        // Default org from email domain
        const domain = email.split("@")[1] || "default";
        let defaultOrg = await Organization_1.default.findOne({ name: domain });
        if (!defaultOrg) {
            defaultOrg = await Organization_1.default.create({
                name: domain,
                zoho: { enabled: true },
            });
        }
        // Find user (email is unique)
        let user = await User_1.default.findOne({ email: email.toLowerCase() });
        if (!user) {
            // If this is the first user in defaultOrg, make them admin
            const isFirstUserInDefaultOrg = !(await User_1.default.countDocuments({ org: defaultOrg._id }));
            user = await User_1.default.create({
                email: email.toLowerCase(),
                name: name || email,
                org: defaultOrg._id,
                activeOrg: defaultOrg._id,
                orgs: [defaultOrg._id],
                role: isFirstUserInDefaultOrg ? "admin" : "user",
                zohoId: userInfo?.ZUID || userInfo?.User_Id || undefined,
                zohoAccessToken: accessToken,
                zohoRefreshToken: refreshToken,
            });
        }
        else {
            user.zohoAccessToken = accessToken;
            if (refreshToken)
                user.zohoRefreshToken = refreshToken;
            if (!user.zohoId && (userInfo?.ZUID || userInfo?.User_Id)) {
                user.zohoId = userInfo?.ZUID || userInfo?.User_Id;
            }
            if (!user.activeOrg)
                user.activeOrg = user.org;
            if (!Array.isArray(user.orgs) || user.orgs.length === 0) {
                user.orgs = [user.activeOrg];
            }
            await user.save();
        }
        // Admin org selection/create
        if (user.role === "admin" && stateData) {
            let targetOrg = null;
            const orgId = stateData.orgId ? String(stateData.orgId) : "";
            const orgName = stateData.orgName ? String(stateData.orgName).trim() : "";
            if (orgId) {
                targetOrg = await Organization_1.default.findById(orgId);
                if (!targetOrg)
                    return res.status(400).json({ message: "Invalid orgId" });
            }
            else if (orgName) {
                targetOrg = await Organization_1.default.findOne({ name: orgName });
                if (!targetOrg) {
                    targetOrg = await Organization_1.default.create({ name: orgName });
                }
            }
            if (targetOrg) {
                if (!user.orgs.some((o) => String(o) === String(targetOrg._id))) {
                    user.orgs.push(targetOrg._id);
                }
                user.activeOrg = targetOrg._id;
                user.org = targetOrg._id;
                await user.save();
            }
        }
        setAuthCookie(res, user);
        // redirect to frontend
        const FRONTEND = process.env.FRONTEND_URL || "http://localhost:3000";
        return res.redirect(`${FRONTEND}/dashboard`);
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Zoho callback error", err);
        return res.status(500).json({ message: "Zoho auth failed", err });
    }
}
async function me(req, res) {
    // @ts-ignore
    const user = req.user;
    if (!user)
        return res.status(401).json({ message: "Unauthorized" });
    res.json({ user });
}
async function listOrgs(_req, res) {
    try {
        const orgs = await Organization_1.default.find({}).select("_id name").sort({ name: 1 });
        res.json({ orgs });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to list orgs" });
    }
}
async function switchOrg(req, res) {
    try {
        // @ts-ignore
        const currentUser = req.user;
        const { orgId } = req.body;
        if (!orgId)
            return res.status(400).json({ message: "orgId is required" });
        const user = await User_1.default.findById(currentUser._id);
        if (!user)
            return res.status(401).json({ message: "Unauthorized" });
        const allowed = Array.isArray(user.orgs)
            ? user.orgs.some((o) => String(o) === String(orgId))
            : false;
        if (!allowed)
            return res.status(403).json({ message: "Forbidden" });
        const org = await Organization_1.default.findById(orgId).select("_id");
        if (!org)
            return res.status(404).json({ message: "Org not found" });
        user.activeOrg = org._id;
        user.org = org._id;
        await user.save();
        setAuthCookie(res, user);
        res.json({ ok: true, activeOrg: user.activeOrg });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to switch org" });
    }
}
async function logout(_req, res) {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
    });
    res.json({ ok: true });
}
