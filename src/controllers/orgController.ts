import { Request, Response } from "express";
import Organization from "../models/Organization";

export async function getOrg(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const org = await Organization.findById(user.org);
    if (!org) return res.status(404).json({ message: "Org not found" });
    res.json({ org });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to get org" });
  }
}

export async function updateOrg(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const body = req.body || {};
    const org = await Organization.findById(user.org);
    if (!org) return res.status(404).json({ message: "Org not found" });
    // only allow certain fields
    if (body.name) org.name = body.name;
    org.settings = org.settings || {};
    if (body.notificationUrls) org.settings.notificationUrls = body.notificationUrls;
    org.zoho = org.zoho || {};
    if (body.zoho) {
      if (body.zoho.creatorFormId) org.zoho.creatorFormId = body.zoho.creatorFormId;
      if (body.zoho.workdriveFolderId) org.zoho.workdriveFolderId = body.zoho.workdriveFolderId;
      if (body.zoho.webhookUrl) org.zoho.webhookUrl = body.zoho.webhookUrl;
      if (typeof body.zoho.enabled === "boolean") org.zoho.enabled = body.zoho.enabled;
    }
    await org.save();
    res.json({ ok: true, org });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to update org" });
  }
}

export default { getOrg, updateOrg };
