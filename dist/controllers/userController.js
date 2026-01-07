"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.updateUserRole = updateUserRole;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.setMyDepartment = setMyDepartment;
const User_1 = __importDefault(require("../models/User"));
const Organization_1 = __importDefault(require("../models/Organization"));
async function listUsers(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const users = await User_1.default.find({ org: user.org }).select("name email role department zohoId");
        res.json({ data: users });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to list users" });
    }
}
async function updateUserRole(req, res) {
    try {
        const { id } = req.params;
        const { role } = req.body;
        if (!role || (role !== "admin" && role !== "department_lead" && role !== "user"))
            return res.status(400).json({ message: "Invalid role" });
        // @ts-ignore
        const user = req.user;
        const target = await User_1.default.findById(id);
        if (!target)
            return res.status(404).json({ message: "Not found" });
        if (String(target.org) !== String(user.org))
            return res.status(403).json({ message: "Forbidden" });
        target.role = role;
        await target.save();
        res.json({ ok: true, user: { id: target._id, role: target.role } });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to update role" });
    }
}
async function createUser(req, res) {
    try {
        // @ts-ignore
        const currentUser = req.user;
        const { name, email, role, department, password } = req.body;
        if (!name || !email) {
            return res.status(400).json({ message: "Name and email are required" });
        }
        // Check if user already exists
        const existing = await User_1.default.findOne({ email, org: currentUser.org });
        if (existing) {
            return res.status(400).json({ message: "User with this email already exists" });
        }
        const newUser = new User_1.default({
            name,
            email,
            role: role || "user",
            department,
            password: password || email, // Default password is email if not provided
            org: currentUser.org,
            isActive: true,
        });
        await newUser.save();
        res.status(201).json({
            ok: true,
            user: {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                department: newUser.department,
                isActive: newUser.isActive,
            },
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to create user" });
    }
}
async function updateUser(req, res) {
    try {
        const { id } = req.params;
        const { name, email, role, department, isActive } = req.body;
        // @ts-ignore
        const currentUser = req.user;
        const target = await User_1.default.findById(id);
        if (!target)
            return res.status(404).json({ message: "User not found" });
        if (String(target.org) !== String(currentUser.org)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (name)
            target.name = name;
        if (email)
            target.email = email;
        if (role)
            target.role = role;
        if (department !== undefined)
            target.department = department;
        if (isActive !== undefined)
            target.isActive = isActive;
        await target.save();
        res.json({
            ok: true,
            user: {
                _id: target._id,
                name: target.name,
                email: target.email,
                role: target.role,
                department: target.department,
                isActive: target.isActive,
            },
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to update user" });
    }
}
async function deleteUser(req, res) {
    try {
        const { id } = req.params;
        // @ts-ignore
        const currentUser = req.user;
        const target = await User_1.default.findById(id);
        if (!target)
            return res.status(404).json({ message: "User not found" });
        if (String(target.org) !== String(currentUser.org)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        // Prevent deleting yourself
        if (String(target._id) === String(currentUser._id)) {
            return res.status(400).json({ message: "Cannot delete your own account" });
        }
        await User_1.default.findByIdAndDelete(id);
        res.json({ ok: true, message: "User deleted successfully" });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to delete user" });
    }
}
async function setMyDepartment(req, res) {
    try {
        // @ts-ignore
        const currentUser = req.user;
        const { department } = req.body;
        const dept = String(department || "").trim();
        if (!dept)
            return res.status(400).json({ message: "Department is required" });
        const org = await Organization_1.default.findById(currentUser.org).select("departments");
        if (!org)
            return res.status(404).json({ message: "Org not found" });
        const allowed = (org.departments || []).some((d) => String(d).toLowerCase() === dept.toLowerCase());
        if (!allowed) {
            return res.status(400).json({ message: "Invalid department" });
        }
        const user = await User_1.default.findById(currentUser._id);
        if (!user)
            return res.status(404).json({ message: "User not found" });
        user.department = dept;
        await user.save();
        res.json({ ok: true, user: { _id: user._id, department: user.department } });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        res.status(500).json({ message: "Failed to set department" });
    }
}
exports.default = {
    listUsers,
    updateUserRole,
    createUser,
    updateUser,
    deleteUser,
    setMyDepartment,
};
