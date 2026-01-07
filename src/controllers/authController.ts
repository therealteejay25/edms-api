import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import Organization from "../models/Organization";
import * as ZohoOAuth from "../services/zoho/oauth";

const COOKIE_NAME = process.env.COOKIE_NAME || "edms_token";

export async function startZohoAuth(_req: Request, res: Response) {
  const url = ZohoOAuth.getAuthUrl();
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

    // Derive org from email domain (simple org scoping for MVP)
    const domain = email.split("@")[1] || "default";
    let org = await Organization.findOne({ name: domain });
    if (!org) {
      org = await Organization.create({
        name: domain,
        zoho: { enabled: true },
      });
    }

    // find or create user
    let user = await User.findOne({ email: email.toLowerCase(), org: org._id });
    const isFirstUser = !(await User.countDocuments({ org: org._id }));
    if (!user) {
      user = await User.create({
        email: email.toLowerCase(),
        name: name || email,
        org: org._id,
        role: isFirstUser ? "admin" : "user",
        zohoId: userInfo?.ZUID || userInfo?.User_Id || undefined,
        zohoAccessToken: accessToken,
        zohoRefreshToken: refreshToken,
      });
    } else {
      // update tokens
      user.zohoAccessToken = accessToken;
      if (refreshToken) user.zohoRefreshToken = refreshToken;
      if (!user.zohoId && (userInfo?.ZUID || userInfo?.User_Id))
        user.zohoId = userInfo?.ZUID || userInfo?.User_Id;
      await user.save();
    }

    // issue JWT and set cookie
    const payload = { id: user._id, org: user.org };
    const secret = process.env.JWT_SECRET || "secret";
    const token = jwt.sign(
      payload as any,
      secret as any,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } as any
    );
    res.cookie(COOKIE_NAME, token, {
  httpOnly: true,
  secure: true,          // REQUIRED for HTTPS
  sameSite: "none",      // REQUIRED for cross-site cookies
  maxAge: 1000 * 60 * 60 * 24 * 7,
});


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

export async function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
  res.json({ ok: true });
}
