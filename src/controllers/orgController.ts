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

export async function listDepartments(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const org = await Organization.findById(user.org).select("departments");
    if (!org) return res.status(404).json({ message: "Org not found" });
    res.json({ departments: org.departments || [] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to list departments" });
  }
}

export async function addDepartment(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const { name } = req.body as { name?: string };
    const dept = String(name || "").trim();
    if (!dept) return res.status(400).json({ message: "Department name is required" });

    const org = await Organization.findById(user.org);
    if (!org) return res.status(404).json({ message: "Org not found" });

    const departments = Array.isArray(org.departments) ? org.departments : [];
    const exists = departments.some((d) => String(d).toLowerCase() === dept.toLowerCase());
    if (!exists) {
      departments.push(dept);
      org.departments = departments;
      await org.save();
    }

    res.json({ ok: true, departments: org.departments || [] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to add department" });
  }
}

export async function removeDepartment(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const { name } = req.params as any;
    const dept = String(name || "").trim();
    if (!dept) return res.status(400).json({ message: "Department name is required" });

    const org = await Organization.findById(user.org);
    if (!org) return res.status(404).json({ message: "Org not found" });

    org.departments = (org.departments || []).filter(
      (d: any) => String(d).toLowerCase() !== dept.toLowerCase()
    );
    await org.save();

    res.json({ ok: true, departments: org.departments || [] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to remove department" });
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
    if (body?.settings?.retentionPolicies) {
      const rp = body.settings.retentionPolicies || {};
      org.settings.retentionPolicies = {
        ...(org.settings.retentionPolicies || {}),
        ...(rp || {}),
      };
    }
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

export default { getOrg, updateOrg, listDepartments, addDepartment, removeDepartment };
