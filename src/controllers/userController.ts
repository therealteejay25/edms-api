import { Request, Response } from "express";
import User from "../models/User";

export async function listUsers(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const users = await User.find({ org: user.org }).select(
      "name email role department zohoId"
    );
    res.json({ data: users });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to list users" });
  }
}

export async function updateUserRole(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { role } = req.body as { role?: string };
    if (!role || (role !== "admin" && role !== "user"))
      return res.status(400).json({ message: "Invalid role" });
    // @ts-ignore
    const user = req.user;
    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: "Not found" });
    if (String(target.org) !== String(user.org))
      return res.status(403).json({ message: "Forbidden" });
    target.role = role as any;
    await target.save();
    res.json({ ok: true, user: { id: target._id, role: target.role } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to update role" });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    // @ts-ignore
    const currentUser = req.user;
    const { name, email, role, department, password } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    // Check if user already exists
    const existing = await User.findOne({ email, org: currentUser.org });
    if (existing) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    const newUser = new User({
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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to create user" });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, email, role, department, isActive } = req.body;
    // @ts-ignore
    const currentUser = req.user;

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: "User not found" });
    
    if (String(target.org) !== String(currentUser.org)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (name) target.name = name;
    if (email) target.email = email;
    if (role) target.role = role;
    if (department !== undefined) target.department = department;
    if (isActive !== undefined) target.isActive = isActive;

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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to update user" });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const currentUser = req.user;

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: "User not found" });

    if (String(target.org) !== String(currentUser.org)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Prevent deleting yourself
    if (String(target._id) === String(currentUser._id)) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    await User.findByIdAndDelete(id);

    res.json({ ok: true, message: "User deleted successfully" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to delete user" });
  }
}

export default { listUsers, updateUserRole, createUser, updateUser, deleteUser };
