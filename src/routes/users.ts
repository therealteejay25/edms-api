import { Router } from "express";
import { auth } from "../middlewares/auth";
import { isAdmin } from "../middlewares/isAdmin";
import { listUsers, updateUserRole } from "../controllers/userController";

const router = Router();

router.use(auth);

router.get("/", listUsers);
router.post("/:id/role", isAdmin, updateUserRole);

export default router;
