import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import Organization from "../models/Organization";
import * as ZohoOAuth from "../services/zoho/oauth";

const COOKIE_NAME = process.env.COOKIE_NAME || "edms_token";

function decodeState(state?: string) {
  if (!state) return null;
  try {
    const raw = Buffer.from(String(state), "base64").toString("utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function encodeState(value: any) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function setAuthCookie(res: Response, user: any) {
  const payload = { id: user._id, org: user.org };
  const secret = process.env.JWT_SECRET || "secret";
  const token = jwt.sign(
    payload as any,
    secret as any,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } as any
  );
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

export async function startZohoAuth(_req: Request, res: Response) {
  const reqAny: any = _req;
  const { orgId, orgName } = (reqAny.query || {}) as any;
  const state = orgId || orgName ? encodeState({ orgId, orgName }) : undefined;
  const url = ZohoOAuth.getAuthUrl(state);
  res.redirect(url);
}

export async function zohoCallback(req: Request, res: Response) {
  try {
    const { code, state } = req.query as any;
    if (!code) return res.status(400).json({ message: "Missing code" });
    const tokenResp = await ZohoOAuth.exchangeCode(code);
    const accessToken = tokenResp.access_token;
    const refreshToken = tokenResp.refresh_token;
    // fetch user info
    const userInfo = await ZohoOAuth.getUserInfo(accessToken);
    // userInfo structure may vary; try to extract email and name
    const email =
      userInfo?.Email ||
      userInfo?.email ||
      (userInfo?.data && userInfo.data.email);
    const name =
      userInfo?.Name ||
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
    let defaultOrg = await Organization.findOne({ name: domain });
    if (!defaultOrg) {
      defaultOrg = await Organization.create({
        name: domain,
        zoho: { enabled: true },
      });
    }

    // Find user (email is unique)
    let user: any = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // If this is the first user in defaultOrg, make them admin
      const isFirstUserInDefaultOrg =
        !(await User.countDocuments({ org: defaultOrg._id }));
      user = await User.create({
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
    } else {
      user.zohoAccessToken = accessToken;
      if (refreshToken) user.zohoRefreshToken = refreshToken;
      if (!user.zohoId && (userInfo?.ZUID || userInfo?.User_Id)) {
        user.zohoId = userInfo?.ZUID || userInfo?.User_Id;
      }
      if (!user.activeOrg) user.activeOrg = user.org;
      if (!Array.isArray(user.orgs) || user.orgs.length === 0) {
        user.orgs = [user.activeOrg];
      }
      await user.save();
    }

    // Admin org selection/create
    if (user.role === "admin" && stateData) {
      let targetOrg: any = null;
      const orgId = stateData.orgId ? String(stateData.orgId) : "";
      const orgName = stateData.orgName ? String(stateData.orgName).trim() : "";
      if (orgId) {
        targetOrg = await Organization.findById(orgId);
        if (!targetOrg)
          return res.status(400).json({ message: "Invalid orgId" });
      } else if (orgName) {
        targetOrg = await Organization.findOne({ name: orgName });
        if (!targetOrg) {
          targetOrg = await Organization.create({ name: orgName });
        }
      }

      if (targetOrg) {
        if (!user.orgs.some((o: any) => String(o) === String(targetOrg._id))) {
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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Zoho callback error", err);
    return res.status(500).json({ message: "Zoho auth failed", err });
  }
}

export async function me(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  res.json({ user });
}

export async function listOrgs(_req: Request, res: Response) {
  try {
    const orgs = await Organization.find({}).select("_id name").sort({ name: 1 });
    res.json({ orgs });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to list orgs" });
  }
}

export async function switchOrg(req: Request, res: Response) {
  try {
    // @ts-ignore
    const currentUser = req.user;
    const { orgId } = req.body as { orgId?: string };
    if (!orgId) return res.status(400).json({ message: "orgId is required" });

    const user: any = await User.findById(currentUser._id);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const allowed = Array.isArray(user.orgs)
      ? user.orgs.some((o: any) => String(o) === String(orgId))
      : false;
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const org = await Organization.findById(orgId).select("_id");
    if (!org) return res.status(404).json({ message: "Org not found" });

    user.activeOrg = org._id;
    user.org = org._id;
    await user.save();

    setAuthCookie(res, user);
    res.json({ ok: true, activeOrg: user.activeOrg });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to switch org" });
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
  res.json({ ok: true });
}
