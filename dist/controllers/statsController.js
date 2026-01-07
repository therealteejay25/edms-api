"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = getDashboardStats;
exports.getAnalyticsStats = getAnalyticsStats;
const Document_1 = __importDefault(require("../models/Document"));
const Approval_1 = __importDefault(require("../models/Approval"));
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Get dashboard statistics
 */
async function getDashboardStats(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const org = user.org;
        const [totalDocuments, activeDocuments, pendingApprovals, expiringSoon, recentActivity,] = await Promise.all([
            Document_1.default.countDocuments({ org }),
            Document_1.default.countDocuments({ org, status: "active" }),
            Approval_1.default.countDocuments({ org, status: "pending" }),
            Document_1.default.countDocuments({
                org,
                expiryDate: {
                    $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    $gte: new Date(),
                },
                status: { $ne: "archived" },
            }),
            Document_1.default.countDocuments({
                org,
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            }),
        ]);
        res.json({
            totalDocuments,
            activeDocuments,
            pendingApprovals,
            expiringSoon,
            recentActivity,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to get stats" });
    }
}
async function getAnalyticsStats(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const org = new mongoose_1.default.Types.ObjectId(user.org);
        const now = new Date();
        const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const [totals, byTypeAgg, byDepartmentAgg, statusAgg, expiringSoon, docsTrend30d, approvalsByStatusAgg, approvalSlaAgg, topTagsAgg,] = await Promise.all([
            Document_1.default.aggregate([
                { $match: { org } },
                {
                    $group: {
                        _id: null,
                        totalDocuments: { $sum: 1 },
                        activeDocuments: {
                            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
                        },
                        archivedDocuments: {
                            $sum: { $cond: [{ $eq: ["$status", "archived"] }, 1, 0] },
                        },
                        expiredDocuments: {
                            $sum: { $cond: [{ $eq: ["$status", "expired"] }, 1, 0] },
                        },
                        draftDocuments: {
                            $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
                        },
                    },
                },
            ]),
            Document_1.default.aggregate([
                { $match: { org } },
                { $group: { _id: "$type", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            Document_1.default.aggregate([
                { $match: { org } },
                { $group: { _id: "$department", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            Document_1.default.aggregate([
                { $match: { org } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
            Document_1.default.countDocuments({
                org,
                expiryDate: {
                    $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    $gte: new Date(),
                },
                status: { $ne: "archived" },
            }),
            Document_1.default.aggregate([
                { $match: { org, createdAt: { $gte: since30d } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
            Approval_1.default.aggregate([
                { $match: { org } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
            Approval_1.default.aggregate([
                {
                    $match: {
                        org,
                        decidedAt: { $exists: true, $ne: null },
                        requestedAt: { $gte: since30d },
                    },
                },
                {
                    $project: {
                        durationMs: { $subtract: ["$decidedAt", "$requestedAt"] },
                    },
                },
                {
                    $group: {
                        _id: null,
                        avgDurationMs: { $avg: "$durationMs" },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Document_1.default.aggregate([
                { $match: { org } },
                { $unwind: "$tags" },
                { $group: { _id: "$tags", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
        ]);
        const t = totals?.[0] || {};
        const byType = {};
        for (const row of byTypeAgg || []) {
            if (row?._id)
                byType[String(row._id)] = Number(row.count || 0);
        }
        const byDepartment = {};
        for (const row of byDepartmentAgg || []) {
            if (row?._id)
                byDepartment[String(row._id)] = Number(row.count || 0);
        }
        const byStatus = {};
        for (const row of statusAgg || []) {
            if (row?._id)
                byStatus[String(row._id)] = Number(row.count || 0);
        }
        const approvalsByStatus = {};
        for (const row of approvalsByStatusAgg || []) {
            if (row?._id)
                approvalsByStatus[String(row._id)] = Number(row.count || 0);
        }
        const approvalSla = approvalSlaAgg?.[0] || null;
        const avgApprovalTimeHours = approvalSla?.avgDurationMs
            ? Number(approvalSla.avgDurationMs) / (1000 * 60 * 60)
            : null;
        const p95ApprovalTimeHours = null;
        const docsCreatedLast30Days = (docsTrend30d || []).map((r) => ({
            date: r._id,
            count: Number(r.count || 0),
        }));
        const topTags = (topTagsAgg || []).map((r) => ({
            tag: String(r._id),
            count: Number(r.count || 0),
        }));
        res.json({
            totalDocuments: Number(t.totalDocuments || 0),
            activeDocuments: Number(t.activeDocuments || 0),
            archivedDocuments: Number(t.archivedDocuments || 0),
            expiredDocuments: Number(t.expiredDocuments || 0),
            draftDocuments: Number(t.draftDocuments || 0),
            expiringSoon: Number(expiringSoon || 0),
            byType,
            byDepartment,
            byStatus,
            approvalsByStatus,
            approvalsDecidedLast30Days: Number(approvalSla?.count || 0),
            avgApprovalTimeHours,
            p95ApprovalTimeHours,
            docsCreatedLast30Days,
            topTags,
            // Not currently tracked at file-level. Keep field for UI compatibility.
            storageUsed: null,
            generatedAt: new Date().toISOString(),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to get analytics stats" });
    }
}
