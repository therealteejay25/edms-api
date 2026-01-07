"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrg = getOrg;
exports.listDepartments = listDepartments;
exports.addDepartment = addDepartment;
exports.removeDepartment = removeDepartment;
exports.updateOrg = updateOrg;
const Organization_1 = __importDefault(require("../models/Organization"));
async function getOrg(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const org = await Organization_1.default.findById(user.org);
        if (!org)
            return res.status(404).json({ message: "Org not found" });
        res.json({ org });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to get org" });
    }
}
async function listDepartments(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const org = await Organization_1.default.findById(user.org).select("departments");
        if (!org)
            return res.status(404).json({ message: "Org not found" });
        res.json({ departments: org.departments || [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to list departments" });
    }
}
async function addDepartment(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const { name } = req.body;
        const dept = String(name || "").trim();
        if (!dept)
            return res.status(400).json({ message: "Department name is required" });
        const org = await Organization_1.default.findById(user.org);
        if (!org)
            return res.status(404).json({ message: "Org not found" });
        const departments = Array.isArray(org.departments) ? org.departments : [];
        const exists = departments.some((d) => String(d).toLowerCase() === dept.toLowerCase());
        if (!exists) {
            departments.push(dept);
            org.departments = departments;
            await org.save();
        }
        res.json({ ok: true, departments: org.departments || [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to add department" });
    }
}
async function removeDepartment(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const { name } = req.params;
        const dept = String(name || "").trim();
        if (!dept)
            return res.status(400).json({ message: "Department name is required" });
        const org = await Organization_1.default.findById(user.org);
        if (!org)
            return res.status(404).json({ message: "Org not found" });
        org.departments = (org.departments || []).filter((d) => String(d).toLowerCase() !== dept.toLowerCase());
        await org.save();
        res.json({ ok: true, departments: org.departments || [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to remove department" });
    }
}
async function updateOrg(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const body = req.body || {};
        const org = await Organization_1.default.findById(user.org);
        if (!org)
            return res.status(404).json({ message: "Org not found" });
        // only allow certain fields
        if (body.name)
            org.name = body.name;
        org.settings = org.settings || {};
        if (body.notificationUrls)
            org.settings.notificationUrls = body.notificationUrls;
        if (body?.settings?.retentionPolicies) {
            const rp = body.settings.retentionPolicies || {};
            org.settings.retentionPolicies = {
                ...(org.settings.retentionPolicies || {}),
                ...(rp || {}),
            };
        }
        org.zoho = org.zoho || {};
        if (body.zoho) {
            if (body.zoho.creatorFormId)
                org.zoho.creatorFormId = body.zoho.creatorFormId;
            if (body.zoho.workdriveFolderId)
                org.zoho.workdriveFolderId = body.zoho.workdriveFolderId;
            if (body.zoho.webhookUrl)
                org.zoho.webhookUrl = body.zoho.webhookUrl;
            if (typeof body.zoho.enabled === "boolean")
                org.zoho.enabled = body.zoho.enabled;
        }
        await org.save();
        res.json({ ok: true, org });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to update org" });
    }
}
exports.default = { getOrg, updateOrg, listDepartments, addDepartment, removeDepartment };
